import { ClockCircleOutlined, EnvironmentOutlined, FilterOutlined, SearchOutlined, WarningOutlined } from '@ant-design/icons';
import { Alert, Button, Collapse, DatePicker, Empty, Input, Select, Spin, Table } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../auth';
import PageLayout from '../../components/pageLayout/PageLayout';
import HealthMark from '../organizations/components/HealthMark';
import { hiddenRowDetails, useTableLayout, visibleColumns, type ResponsiveColumn } from '../organizations/components/tableLayout';
import { loadJournal, type JournalPreset, type JournalProgram } from './api';

import styles from './WorkflowPage.module.scss';

const presets: Array<{ key: JournalPreset; label: string }> = [
  { key: 'all', label: 'Все' },
  { key: 'overdue', label: 'Просрочено' },
  { key: 'semester', label: 'Семестр' },
  { key: 'renewal', label: 'Продление' },
  { key: 'lms_silence', label: 'Тишина LMS' },
];

const presetOf = (value: string | null): JournalPreset => (
  presets.some((item) => item.key === value) ? value as JournalPreset : 'all'
);

const overdueDays = (due: string) => {
  if (!due || !dayjs(due).isValid()) return 0;
  return Math.max(dayjs().startOf('day').diff(dayjs(due), 'day'), 0);
};

const WorkflowPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const seesKam = user?.roles.some((role) => role === 'MANAGER' || role === 'ADMIN') ?? false;
  const isAdmin = user?.roles.includes('ADMIN') ?? false;
  const layout = useTableLayout();
  const [params, setParams] = useSearchParams();
  const preset = presetOf(params.get('preset'));
  const search = params.get('search') ?? '';
  const university = params.get('university') ?? '';
  const direction = params.get('direction') ?? '';
  const product = params.get('product') ?? '';
  const stage = params.get('stage') ?? '';
  const playbook = params.get('playbook') ?? '';
  const kam = params.get('kam') ?? '';
  const periodFrom = params.get('periodFrom') ?? '';
  const periodTo = params.get('periodTo') ?? '';
  const [rows, setRows] = useState<JournalProgram[]>([]);
  const [summaryRows, setSummaryRows] = useState<JournalProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadJournal(preset), preset === 'all' ? Promise.resolve(null) : loadJournal('all')])
      .then(([current, all]) => {
        if (cancelled) return;
        setRows(current);
        setSummaryRows(all ?? current);
        setError('');
      })
      .catch(() => { if (!cancelled) setError('Не удалось загрузить журнал'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [preset]);

  const update = (patch: Record<string, string>) => {
    if ('preset' in patch) setLoading(true);
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    setParams(next, { replace: true });
  };

  const filtered = useMemo(() => rows.filter((row) => {
    const query = search.trim().toLowerCase();
    const haystack = `${row.organization} ${row.direction} ${row.product}`.toLowerCase();
    return (!query || haystack.includes(query))
      && (!university || row.organization === university)
      && (!direction || row.direction === direction)
      && (!product || row.product === product)
      && (!stage || row.stage === stage)
      && (!playbook || row.playbook === playbook)
      && (!kam || row.kam === kam)
      && (!periodFrom || (row.due && row.due >= periodFrom))
      && (!periodTo || (row.due && row.due <= periodTo));
  }), [direction, kam, periodFrom, periodTo, playbook, product, rows, search, stage, university]);

  const summary = useMemo(() => ({
    total: summaryRows.length,
    overdue: summaryRows.filter((row) => overdueDays(row.due) > 0).length,
    attention: summaryRows.filter((row) => row.healthBand === 'yellow' || row.healthBand === 'red').length,
    renewal: summaryRows.filter((row) => row.playbook.toLowerCase().includes('продлен')).length,
  }), [summaryRows]);

  const options = (pick: (row: JournalProgram) => string) => [...new Set(rows.map(pick).filter(Boolean))].sort((left, right) => left.localeCompare(right, 'ru'));
  const filtersActive = [search, university, direction, product, stage, playbook, kam, periodFrom, periodTo].some(Boolean);

  if (loading && rows.length === 0) {
    return <PageLayout><div className={styles.loader}><Spin size="large" /></div></PageLayout>;
  }

  const columns: ResponsiveColumn<JournalProgram>[] = [
    { title: 'Вуз', dataIndex: 'organization', show: ['wide', 'mid', 'narrow'] },
    { title: 'Направление', dataIndex: 'direction', show: ['wide', 'mid'] },
    { title: 'ИТ-программа', dataIndex: 'product', show: ['wide', 'mid', 'narrow'] },
    { title: 'Плейбук', dataIndex: 'playbook', show: ['wide'] },
    { title: 'Этап', dataIndex: 'stage', show: ['wide', 'mid', 'narrow'] },
    { title: 'Срок', dataIndex: 'due', show: ['wide', 'mid'], width: 130, render: (value: string, row) => value ? `${dayjs(value).format('DD.MM.YYYY')}${overdueDays(row.due) ? ` · ${overdueDays(row.due)} дн.` : ''}` : 'Срок не задан' },
    { title: 'Здоровье', show: ['wide', 'mid', 'narrow'], width: 150, render: (_, row) => <HealthMark score={row.healthScore} band={row.healthBand} empty="Нет оценки" /> },
    { title: 'Студенты', dataIndex: 'students', show: ['wide'], width: 110 },
    { title: 'Заявки', dataIndex: 'applications', show: ['wide'], width: 100 },
    ...(seesKam ? [{ title: 'KAM', dataIndex: 'kam', show: ['wide', 'mid'] } satisfies ResponsiveColumn<JournalProgram>] : []),
  ];

  return (
    <PageLayout>
      <div className={styles.page}>
        <div className={styles.heading}>
          <h1 className={styles.title}>Воркфлоу</h1>
          <p className={styles.subtitle}>{isAdmin ? 'Все программы. Новая программа создаётся из карточки вуза.' : seesKam ? 'Программы команды. Новая программа создаётся из карточки вуза.' : 'Журнал программ. Новая программа создаётся из карточки вуза.'}</p>
        </div>
        {error && <Alert type="error" showIcon message={error} />}
        <section className={styles.metrics}>
          <div className={styles.metric}><span className={`${styles.metricIcon} ${styles.metricIconPrograms}`}><EnvironmentOutlined /></span><span><span className={styles.metricLabel}>Программ</span><strong className={styles.metricValue}>{summary.total}</strong></span></div>
          <div className={styles.metric}><span className={`${styles.metricIcon} ${styles.metricIconOverdue}`}><ClockCircleOutlined /></span><span><span className={styles.metricLabel}>Просрочен срок</span><strong className={styles.metricValue}>{summary.overdue}</strong></span></div>
          <div className={styles.metric}><span className={`${styles.metricIcon} ${styles.metricIconAttention}`}><WarningOutlined /></span><span><span className={styles.metricLabel}>Жёлтые и красные</span><strong className={styles.metricValue}>{summary.attention}</strong></span></div>
          <div className={styles.metric}><span className={`${styles.metricIcon} ${styles.metricIconRenewal}`}><ClockCircleOutlined /></span><span><span className={styles.metricLabel}>На продлении</span><strong className={styles.metricValue}>{summary.renewal}</strong></span></div>
        </section>
        <div className={styles.presets}>
          {presets.map((item) => (
            <button key={item.key} type="button" className={item.key === preset ? styles.presetActive : styles.preset} onClick={() => update({ preset: item.key === 'all' ? '' : item.key })}>{item.label}</button>
          ))}
        </div>
        {layout === 'narrow' ? (
          <Collapse ghost items={[{ key: 'filters', label: 'Фильтры', extra: <FilterOutlined />, children: <div className={styles.filtersRow}>{filterFields()}</div> }]} />
        ) : <div className={styles.filtersRow}>{filterFields()}</div>}
        {filtered.length === 0 ? (
          <Empty description={rows.length === 0 ? (isAdmin ? 'Программ пока нет' : seesKam ? 'В команде пока нет программ' : 'В портфеле нет программ') : 'По этим фильтрам программ нет'}>
            {rows.length === 0 && <Link to="/organizations">Открыть вузы</Link>}
          </Empty>
        ) : (
          <section className={styles.tableCard}>
            <Table
              rowKey="id"
              size="middle"
              pagination={false}
              dataSource={filtered}
              rowClassName={styles.clickableRow}
              onRow={(row) => ({ onClick: () => navigate(`/workflows/${row.id}`) })}
              columns={visibleColumns(layout, columns)}
              expandable={hiddenRowDetails<JournalProgram>(layout, (row) => (
                <div className={styles.mobileDetails}>
                  <div><span>Направление</span><strong>{row.direction}</strong></div>
                  <div><span>Плейбук</span><strong>{row.playbook}</strong></div>
                  <div><span>Срок</span><strong>{row.due || 'Срок не задан'}</strong></div>
                  <div><span>Студенты</span><strong>{row.students}</strong></div>
                  <div><span>Заявки</span><strong>{row.applications}</strong></div>
                  {seesKam && layout === 'narrow' && <div><span>KAM</span><strong>{row.kam}</strong></div>}
                </div>
              ))}
            />
          </section>
        )}
      </div>
    </PageLayout>
  );

  function filterFields() {
    return (
      <>
        <Input className={styles.search} allowClear prefix={<SearchOutlined />} placeholder="Вуз, направление, ИТ-программа" value={search} onChange={(event) => update({ search: event.target.value })} />
        <Select className={styles.filter} allowClear placeholder="Вуз" value={university || undefined} options={options((row) => row.organization).map((value) => ({ value, label: value }))} onChange={(value) => update({ university: value ?? '' })} />
        <Select className={styles.filter} allowClear placeholder="Направление" value={direction || undefined} options={options((row) => row.direction).map((value) => ({ value, label: value }))} onChange={(value) => update({ direction: value ?? '' })} />
        <Select className={styles.filter} allowClear placeholder="ИТ-программа" value={product || undefined} options={options((row) => row.product).map((value) => ({ value, label: value }))} onChange={(value) => update({ product: value ?? '' })} />
        <Select className={styles.filter} allowClear placeholder="Этап" value={stage || undefined} options={options((row) => row.stage).map((value) => ({ value, label: value }))} onChange={(value) => update({ stage: value ?? '' })} />
        <Select className={styles.filter} allowClear placeholder="Плейбук" value={playbook || undefined} options={options((row) => row.playbook).map((value) => ({ value, label: value }))} onChange={(value) => update({ playbook: value ?? '' })} />
        {seesKam && <Select className={styles.filter} allowClear showSearch placeholder="KAM" value={kam || undefined} options={options((row) => row.kam).filter((value) => value !== 'KAM не назначен').map((value) => ({ value, label: value }))} onChange={(value) => update({ kam: value ?? '' })} />}
        <DatePicker.RangePicker
          placeholder={['Срок с', 'по']}
          format="DD.MM.YYYY"
          value={periodFrom && periodTo ? [dayjs(periodFrom), dayjs(periodTo)] : null}
          onChange={(values) => update({ periodFrom: values?.[0]?.format('YYYY-MM-DD') ?? '', periodTo: values?.[1]?.format('YYYY-MM-DD') ?? '' })}
        />
        <Button type="link" disabled={!filtersActive} onClick={() => update({ search: '', university: '', direction: '', product: '', stage: '', playbook: '', kam: '', periodFrom: '', periodTo: '' })}>Сбросить</Button>
      </>
    );
  }
};

export default WorkflowPage;
