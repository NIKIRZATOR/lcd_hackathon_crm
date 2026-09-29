import { BankOutlined, EnvironmentOutlined, FilterOutlined, SearchOutlined, WarningOutlined } from '@ant-design/icons';
import { Alert, Button, Collapse, DatePicker, Empty, Input, Select, Spin, Table } from 'antd';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../auth';
import PageLayout from '../../components/pageLayout/PageLayout';
import { loadPortfolio } from './api';
import CatalogImportModal from './components/CatalogImportModal';
import HealthMark from './components/HealthMark';
import OrganizationLogo from './components/OrganizationLogo';
import { hiddenRowDetails, useTableLayout, visibleColumns, type ResponsiveColumn } from './components/tableLayout';
import type { PortfolioFilters, PortfolioOrganization } from './screenModel';
import { emptyPortfolioFilters } from './screenModel';

import styles from './UniversitiesPage.module.scss';

const known = (value: string) => value && !value.startsWith('Город не') && !value.startsWith('Регион не');

const readFilters = (params: URLSearchParams): PortfolioFilters => ({
  search: params.get('search') ?? '',
  region: params.get('region') ?? '',
  type: params.get('type') ?? '',
  direction: params.get('direction') ?? '',
  product: params.get('product') ?? '',
  kam: params.get('kam') ?? '',
  unassigned: params.get('unassigned') === '1',
  periodFrom: params.get('periodFrom') ?? '',
  periodTo: params.get('periodTo') ?? '',
});

const writeFilters = (filters: PortfolioFilters) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (key === 'unassigned') {
      if (value) params.set(key, '1');
      return;
    }
    if (value) params.set(key, String(value));
  });
  return params;
};

const matches = (item: PortfolioOrganization, filters: PortfolioFilters) => {
  const query = filters.search.trim().toLowerCase();
  const haystack = `${item.name} ${item.shortName} ${item.city}`.toLowerCase();
  const inPeriod = (!filters.periodFrom || item.updatedAt >= filters.periodFrom)
    && (!filters.periodTo || item.updatedAt <= filters.periodTo);

  return (!query || haystack.includes(query))
    && inPeriod
    && (!filters.region || item.region === filters.region)
    && (!filters.type || item.typeName === filters.type)
    && (!filters.direction || item.directions.includes(filters.direction))
    && (!filters.product || item.products.includes(filters.product))
    && (filters.unassigned ? item.kam === 'KAM не назначен' : !filters.kam || item.kam === filters.kam);
};

const initials = (value: string) => value.split(' ').map((part) => part[0]).filter(Boolean).join('').slice(0, 2).toUpperCase();

const paletteIndex = (id: string) => [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0);

const badgePalette = [
  { color: '#5b4bdb', background: '#ece9ff' },
  { color: '#0f7a4b', background: '#e5f6ee' },
  { color: '#b45309', background: '#fff1df' },
  { color: '#1d4ed8', background: '#e7efff' },
  { color: '#9f1239', background: '#ffe4ea' },
];

const UniversitiesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const seesTeam = user?.roles.some((role) => role === 'MANAGER' || role === 'ADMIN') ?? false;
  const isAdmin = user?.roles.includes('ADMIN') ?? false;
  const layout = useTableLayout();
  const isCompact = layout === 'narrow';
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);
  const [items, setItems] = useState<PortfolioOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadPortfolio()
      .then((loaded) => { if (!cancelled) setItems(loaded); })
      .catch(() => { if (!cancelled) setError('Не удалось загрузить вузы'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => items.filter((item) => matches(item, filters)), [filters, items]);
  const summary = useMemo(() => ({
    total: items.length,
    programs: items.reduce((sum, item) => sum + item.programCount, 0),
    attention: items.filter((item) => item.healthBand === 'yellow' || item.healthBand === 'red').length,
    empty: items.filter((item) => item.noActivity).length,
  }), [items]);
  const options = useMemo(() => ({
    regions: [...new Set(items.map((item) => item.region).filter(known))].sort((left, right) => left.localeCompare(right, 'ru')),
    types: [...new Set(items.map((item) => item.typeName))].sort((left, right) => left.localeCompare(right, 'ru')),
    directions: [...new Set(items.flatMap((item) => item.directions))].sort((left, right) => left.localeCompare(right, 'ru')),
    products: [...new Set(items.flatMap((item) => item.products))].sort((left, right) => left.localeCompare(right, 'ru')),
    kams: [...new Set(items.map((item) => item.kam).filter((value) => value && value !== 'KAM не назначен'))].sort((left, right) => left.localeCompare(right, 'ru')),
  }), [items]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || visibleCount >= filtered.length) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisibleCount((current) => current + 20);
    }, { rootMargin: '240px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [filtered.length, visibleCount]);

  const update = (patch: Partial<PortfolioFilters>) => {
    setParams(writeFilters({ ...filters, ...patch }), { replace: true });
    setVisibleCount(20);
  };

  const filtersActive = Object.values(filters).some(Boolean);

  if (loading && items.length === 0) {
    return <PageLayout><div className={styles.loader}><Spin size="large" /></div></PageLayout>;
  }

  const filterControls = (
    <>
      <Input className={styles.search} prefix={<SearchOutlined />} allowClear placeholder="Поиск по вузу или городу" value={filters.search} onChange={(event) => update({ search: event.target.value })} />
      <Select className={styles.filter} allowClear showSearch placeholder="Регион" value={filters.region || undefined} options={options.regions.map((value) => ({ value, label: value }))} onChange={(value) => update({ region: value ?? '' })} />
      <Select className={styles.filter} allowClear placeholder="Тип" value={filters.type || undefined} options={options.types.map((value) => ({ value, label: value }))} onChange={(value) => update({ type: value ?? '' })} />
      <Select className={styles.filter} allowClear showSearch placeholder="Направление" value={filters.direction || undefined} options={options.directions.map((value) => ({ value, label: value }))} onChange={(value) => update({ direction: value ?? '' })} />
      <Select className={styles.filter} allowClear showSearch placeholder="ИТ-программа" value={filters.product || undefined} options={options.products.map((value) => ({ value, label: value }))} onChange={(value) => update({ product: value ?? '' })} />
      {seesTeam && <Select className={styles.filter} allowClear showSearch placeholder="KAM" value={filters.unassigned ? undefined : filters.kam || undefined} options={options.kams.map((value) => ({ value, label: value }))} onChange={(value) => update({ kam: value ?? '', unassigned: false })} />}
      {isAdmin && <Button type={filters.unassigned ? 'primary' : 'default'} onClick={() => update({ unassigned: !filters.unassigned, kam: '' })}>Без KAM</Button>}
      <DatePicker.RangePicker
        placeholder={['Активность с', 'по']}
        format="DD.MM.YYYY"
        value={filters.periodFrom && filters.periodTo ? [dayjs(filters.periodFrom), dayjs(filters.periodTo)] : null}
        onChange={(values) => update({
          periodFrom: values?.[0] ? values[0].format('YYYY-MM-DD') : '',
          periodTo: values?.[1] ? values[1].format('YYYY-MM-DD') : '',
        })}
      />
      <Button className={styles.resetButton} type="link" disabled={!filtersActive} onClick={() => { setParams(writeFilters(emptyPortfolioFilters), { replace: true }); setVisibleCount(20); }}>Сбросить</Button>
    </>
  );

  return (
    <PageLayout>
      <div className={styles.page}>
        <div className={styles.headingRow}>
          <div className={styles.heading}>
            <h1 className={styles.title}>Вузы</h1>
            <p className={styles.subtitle}>{isAdmin ? 'Все площадки. Статус сделки живёт на программе, не на вузе.' : seesTeam ? 'Площадки команды. Статус сделки живёт на программе, не на вузе.' : 'Ваши площадки. Статус сделки живёт на программе, не на вузе.'}</p>
          </div>
          {isAdmin && <Button onClick={() => setImportOpen(true)}>Загрузить каталог</Button>}
        </div>
        {error && <Alert type="error" showIcon message={error} />}
        <section className={styles.metrics} aria-label="Сводка портфеля">
          <div className={styles.metric}><span className={`${styles.metricIcon} ${styles.metricIconTotal}`}><BankOutlined /></span><span><span className={styles.metricLabel}>Площадок</span><strong className={styles.metricValue}>{summary.total}</strong></span></div>
          <div className={styles.metric}><span className={`${styles.metricIcon} ${styles.metricIconRegions}`}><EnvironmentOutlined /></span><span><span className={styles.metricLabel}>Программ</span><strong className={styles.metricValue}>{summary.programs}</strong></span></div>
          <div className={styles.metric}><span className={`${styles.metricIcon} ${styles.metricIconPaused}`}><WarningOutlined /></span><span><span className={styles.metricLabel}>Жёлтые и красные</span><strong className={styles.metricValue}>{summary.attention}</strong></span></div>
          <div className={styles.metric}><span className={`${styles.metricIcon} ${styles.metricIconProgress}`}><BankOutlined /></span><span><span className={styles.metricLabel}>Без заходов</span><strong className={styles.metricValue}>{summary.empty}</strong></span></div>
        </section>
        <section aria-label="Фильтры вузов">
          {isCompact ? (
            <Collapse ghost items={[{ key: 'filters', label: 'Фильтры', extra: <FilterOutlined />, children: <div className={styles.filtersRow}>{filterControls}</div> }]} />
          ) : <div className={styles.filtersRow}>{filterControls}</div>}
        </section>
        {filtered.length === 0 ? (
          <Empty description={items.length === 0 ? (isAdmin ? 'Площадок пока нет. Загрузите справочник.' : seesTeam ? 'В команде пока нет площадок. Их добавляет администратор.' : 'В вашем портфеле пока нет площадок. Их добавляет администратор.') : 'По этим фильтрам площадок нет'} />
        ) : (
          <section className={styles.tableCard}>
            <Table
              rowKey="id"
              size="middle"
              sticky
              pagination={false}
              dataSource={filtered.slice(0, visibleCount)}
              rowClassName={(item) => `${styles.clickableRow} ${item.status === 'archived' ? styles.archivedRow : ''}`}
              onRow={(item) => ({ onClick: () => navigate(`/organizations/${item.id}`) })}
              columns={visibleColumns(layout, [
                {
                  title: 'Вуз',
                  dataIndex: 'shortName',
                  show: ['wide', 'mid', 'narrow'],
                  width: layout === 'wide' ? (seesTeam ? '22%' : '26%') : undefined,
                  render: (value: string, item) => {
                    const palette = badgePalette[paletteIndex(item.id) % badgePalette.length];
                    return (
                      <div className={styles.universityCell}>
                        <OrganizationLogo
                          organizationId={item.id}
                          logoFileId={item.logoFileId}
                          fallback={initials(value)}
                          className={styles.badge}
                          style={{ color: palette.color, background: palette.background }}
                        />
                        <span className={styles.universityName}>{value}</span>
                      </div>
                    );
                  },
                },
                { title: 'Город', dataIndex: 'city', show: ['wide', 'mid'], width: layout === 'wide' ? (seesTeam ? '13%' : '16%') : 160 },
                { title: 'Тип', dataIndex: 'typeName', show: ['wide'], width: seesTeam ? '9%' : '12%' },
                ...(seesTeam ? [{ title: 'KAM', dataIndex: 'kam', show: ['wide', 'mid'], width: layout === 'wide' ? '14%' : 168 } satisfies ResponsiveColumn<PortfolioOrganization>] : []),
                { title: 'Программы', dataIndex: 'programCount', show: ['wide', 'mid', 'narrow'], width: layout === 'wide' ? (seesTeam ? '9%' : '10%') : 112 },
                { title: 'Здоровье', show: ['wide', 'mid', 'narrow'], width: layout === 'wide' ? (seesTeam ? '13%' : '16%') : 148, render: (_, item) => <HealthMark score={item.healthScore} band={item.healthBand} /> },
                { title: 'Ближайший риск', dataIndex: 'nearestRisk', show: ['wide'], width: '20%' },
              ] satisfies ResponsiveColumn<PortfolioOrganization>[])}
              expandable={hiddenRowDetails<PortfolioOrganization>(layout, (item) => (
                <div className={styles.mobileDetails}>
                  {layout === 'narrow' && <div className={styles.mobileDetail}><span className={styles.mobileDetailLabel}>Город</span><span>{item.city}</span></div>}
                  <div className={styles.mobileDetail}><span className={styles.mobileDetailLabel}>Тип</span><span>{item.typeName}</span></div>
                  {seesTeam && layout === 'narrow' && <div className={styles.mobileDetail}><span className={styles.mobileDetailLabel}>KAM</span><span>{item.kam}</span></div>}
                  <div className={styles.mobileDetail}><span className={styles.mobileDetailLabel}>Риск</span><span>{item.nearestRisk}</span></div>
                </div>
              ))}
            />
            {visibleCount < filtered.length && <div ref={loadMoreRef} className={styles.loadMore}><Spin size="small" /><span>Загружаем ещё вузы...</span></div>}
          </section>
        )}
        <CatalogImportModal open={importOpen} onClose={() => setImportOpen(false)} onApplied={() => { setImportOpen(false); setLoading(true); loadPortfolio().then(setItems).catch(() => setError('Не удалось загрузить вузы')).finally(() => setLoading(false)); }} />
      </div>
    </PageLayout>
  );
};

export default UniversitiesPage;
