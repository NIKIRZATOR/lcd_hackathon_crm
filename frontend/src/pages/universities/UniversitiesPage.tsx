import {
  BankOutlined,
  CheckCircleFilled,
  EnvironmentOutlined,
  FilterOutlined,
  PauseCircleFilled,
  PlusOutlined,
  SearchOutlined,
  UploadOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { Button, Collapse, DatePicker, Grid, Input, Select, Spin, Table, Tag, Tooltip, message } from 'antd';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';

import PageLayout from '../../components/pageLayout/PageLayout';
import CatalogImportModal from './components/CatalogImportModal';
import UniversityCreateModal from './components/UniversityCreateModal';
import { filterUniversities, hasActiveUniversityFilters, summarizeUniversities } from './domain/filters';
import { listUniversities, rememberUniversity } from './api';
import { emptyUniversityFilters, universityStatusLabels, universityTypeLabels } from './types';
import type { UniversityDraft, UniversityFilters, UniversityItem, UniversityStatus } from './types';

import styles from './UniversitiesPage.module.scss';

const { useBreakpoint } = Grid;

const intermediateViewportQuery = '(min-width: 986px) and (max-width: 1246px)';

const badgePalette = [
  { color: '#5b4bdb', background: '#ece9ff' },
  { color: '#0f7a4b', background: '#e5f6ee' },
  { color: '#b45309', background: '#fff1df' },
  { color: '#1d4ed8', background: '#e7efff' },
  { color: '#9f1239', background: '#ffe4ea' },
  { color: '#0f766e', background: '#e6f7f4' },
];

const statusClassName: Record<UniversityStatus, string> = {
  active: styles.statusActive,
  progress: styles.statusProgress,
  paused: styles.statusPaused,
};

const statusDotClassName: Record<UniversityStatus, string> = {
  active: styles.statusDotActive,
  progress: styles.statusDotProgress,
  paused: styles.statusDotPaused,
};

const subscribeToIntermediateViewport = (onChange: () => void) => {
  const mediaQuery = window.matchMedia(intermediateViewportQuery);
  mediaQuery.addEventListener('change', onChange);

  return () => mediaQuery.removeEventListener('change', onChange);
};

const getIntermediateViewportSnapshot = () => window.matchMedia(intermediateViewportQuery).matches;

const getInitials = (value: string) => value.replace(/[^A-Za-zА-Яа-яЁё]/g, '').slice(0, 2).toUpperCase();

const getManagerInitials = (value: string) =>
  value
    .split(' ')
    .map((part) => part.replace(/[^A-Za-zА-Яа-яЁё]/g, '')[0])
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase();

const formatActivityDate = (value: string) => dayjs(value).locale('ru').format('D MMM YYYY');

const uniqueSorted = (values: string[]) => [...new Set(values)].sort((left, right) => left.localeCompare(right, 'ru'));

const UniversitiesPage = () => {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isTableCompact = !screens.lg;
  const isIntermediateViewport = useSyncExternalStore(
    subscribeToIntermediateViewport,
    getIntermediateViewportSnapshot,
    () => false,
  );
  const isCompactVisual = isTableCompact || isIntermediateViewport;
  const [universities, setUniversities] = useState(listUniversities);
  const [filters, setFilters] = useState<UniversityFilters>(emptyUniversityFilters);
  const [visibleCount, setVisibleCount] = useState(20);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const filteredUniversities = useMemo(() => filterUniversities(universities, filters), [filters, universities]);
  const summary = useMemo(() => summarizeUniversities(universities), [universities]);
  const regionOptions = useMemo(() => uniqueSorted(universities.map((item) => item.region)), [universities]);
  const profileOptions = useMemo(() => uniqueSorted(universities.map((item) => item.profile)), [universities]);
  const productOptions = useMemo(() => uniqueSorted(universities.map((item) => item.product).filter(Boolean)), [universities]);
  const managerOptions = useMemo(() => uniqueSorted(universities.map((item) => item.manager)), [universities]);

  useEffect(() => {
    const loadMoreNode = loadMoreRef.current;

    if (!loadMoreNode || visibleCount >= filteredUniversities.length) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isLoadingMore) {
          setIsLoadingMore(true);
          window.setTimeout(() => {
            setVisibleCount((current) => current + 20);
            setIsLoadingMore(false);
          }, 350);
        }
      },
      { rootMargin: '240px' },
    );

    observer.observe(loadMoreNode);

    return () => observer.disconnect();
  }, [filteredUniversities.length, isLoadingMore, visibleCount]);

  const updateFilter = <Key extends keyof UniversityFilters>(key: Key, value: UniversityFilters[Key]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setVisibleCount(20);
  };

  const renderUniversity = (item: UniversityItem) => {
    const palette = badgePalette[item.id % badgePalette.length];

    return (
      <div className={styles.universityCell}>
        <span className={styles.badge} style={{ color: palette.color, background: palette.background }}>
          {getInitials(item.shortName)}
        </span>
        <span className={styles.universityName}>{item.shortName}</span>
      </div>
    );
  };

  const renderStatus = (status: UniversityStatus, compact = false) => {
    const label = universityStatusLabels[status];

    if (compact) {
      return (
        <Tooltip title={label}>
          <span className={`${styles.statusDot} ${statusDotClassName[status]}`} aria-label={label} />
        </Tooltip>
      );
    }

    return <Tag className={`${styles.status} ${statusClassName[status]}`}>{label}</Tag>;
  };

  const renderManager = (manager: string) => (
    <div className={styles.managerCell}>
      <span className={`${styles.badge} ${styles.managerBadge}`}>{getManagerInitials(manager)}</span>
      <span className={styles.managerName}>{manager}</span>
    </div>
  );

  const renderActivity = (item: UniversityItem) => (
    <div className={styles.activity}>
      <span className={styles.activityDate}>{formatActivityDate(item.activityAt)}</span>
      <span className={styles.activityText}>{item.activityText}</span>
    </div>
  );

  const tableLayout = isTableCompact ? 'narrow' : isIntermediateViewport ? 'mid' : 'wide';
  const columns = ([
    {
      title: 'Название вуза',
      dataIndex: 'shortName',
      key: 'name',
      show: ['wide', 'mid', 'narrow'],
      sorter: (left: UniversityItem, right: UniversityItem) => left.shortName.localeCompare(right.shortName, 'ru'),
      render: (_value: string, item: UniversityItem) => renderUniversity(item),
    },
    {
      title: 'Город',
      dataIndex: 'city',
      key: 'city',
      show: ['wide', 'mid'],
      sorter: (left: UniversityItem, right: UniversityItem) => left.city.localeCompare(right.city, 'ru'),
    },
    {
      title: 'Тип',
      dataIndex: 'type',
      key: 'type',
      show: ['wide'],
      sorter: (left: UniversityItem, right: UniversityItem) => universityTypeLabels[left.type].localeCompare(universityTypeLabels[right.type], 'ru'),
      render: (type: UniversityItem['type']) => universityTypeLabels[type],
    },
    { title: 'Взаимодействия', dataIndex: 'interactions', key: 'interactions', show: ['wide'], sorter: (left: UniversityItem, right: UniversityItem) => left.interactions - right.interactions },
    { title: 'Программы', dataIndex: 'programs', key: 'programs', show: ['wide'], sorter: (left: UniversityItem, right: UniversityItem) => left.programs - right.programs },
    { title: 'Потоки', dataIndex: 'streams', key: 'streams', show: ['wide'], sorter: (left: UniversityItem, right: UniversityItem) => left.streams - right.streams },
    {
      title: 'Менеджер',
      dataIndex: 'manager',
      key: 'manager',
      show: ['wide', 'mid', 'narrow'],
      width: tableLayout === 'narrow' ? 120 : tableLayout === 'mid' ? 132 : undefined,
      sorter: (left: UniversityItem, right: UniversityItem) => left.manager.localeCompare(right.manager, 'ru'),
      render: (manager: string) => renderManager(manager),
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      show: ['wide', 'mid', 'narrow'],
      width: tableLayout === 'wide' ? undefined : 112,
      align: tableLayout === 'wide' ? 'left' as const : 'center' as const,
      sorter: (left: UniversityItem, right: UniversityItem) => universityStatusLabels[left.status].localeCompare(universityStatusLabels[right.status], 'ru'),
      render: (status: UniversityStatus) => renderStatus(status, isCompactVisual),
    },
    {
      title: 'Последняя активность',
      dataIndex: 'activityAt',
      key: 'activity',
      show: ['wide'],
      sorter: (left: UniversityItem, right: UniversityItem) => left.activityAt.localeCompare(right.activityAt),
      render: (_value: string, item: UniversityItem) => renderActivity(item),
    },
  ]).filter((column) => column.show.includes(tableLayout)).sort((left, right) => {
    const order = tableLayout === 'wide'
      ? ['name', 'city', 'type', 'interactions', 'programs', 'streams', 'status', 'manager', 'activity']
      : tableLayout === 'mid'
        ? ['name', 'city', 'manager', 'status']
        : ['name', 'manager', 'status'];
    return order.indexOf(String(left.key)) - order.indexOf(String(right.key));
  }).map((column) => {
    const visible = { ...column } as Omit<typeof column, 'show'> & { show?: string[] };
    delete visible.show;
    return visible;
  });

  const handleCreate = (draft: UniversityDraft) => {
    const created: UniversityItem = {
      ...draft,
      id: Math.max(0, ...universities.map((item) => item.id)) + 1,
      interactions: 0,
      programs: 0,
      streams: 0,
      activityAt: dayjs().format('YYYY-MM-DD'),
      activityText: 'Вуз добавлен',
    };

    rememberUniversity(created);
    setUniversities((current) => [created, ...current]);
    setFilters(emptyUniversityFilters);
    setVisibleCount(20);
    message.success(`Вуз «${draft.shortName}» добавлен`);
  };

  const filterControls = (
    <>
      <Input
        className={styles.search}
        prefix={<SearchOutlined />}
        placeholder="Поиск по вузу, городу или менеджеру"
        value={filters.search}
        allowClear
        onChange={(event) => updateFilter('search', event.target.value)}
      />
      <Select
        className={styles.filter}
        placeholder="Статус"
        value={filters.status || undefined}
        allowClear
        options={(Object.entries(universityStatusLabels) as Array<[UniversityStatus, string]>).map(([value, label]) => ({ value, label }))}
        onChange={(value) => updateFilter('status', value ?? '')}
      />
      <Select
        className={styles.filter}
        placeholder="Регион"
        value={filters.region || undefined}
        allowClear
        showSearch
        optionFilterProp="label"
        options={regionOptions.map((value) => ({ value, label: value }))}
        onChange={(value) => updateFilter('region', value ?? '')}
      />
      <Select
        className={styles.filter}
        placeholder="Тип"
        value={filters.type || undefined}
        allowClear
        options={(Object.keys(universityTypeLabels) as UniversityItem['type'][]).map((value) => ({
          value,
          label: universityTypeLabels[value],
        }))}
        onChange={(value) => updateFilter('type', value ?? '')}
      />
      <Select
        className={styles.filter}
        placeholder="ИТ-направление"
        value={filters.profile || undefined}
        allowClear
        showSearch
        optionFilterProp="label"
        options={profileOptions.map((value) => ({ value, label: value }))}
        onChange={(value) => updateFilter('profile', value ?? '')}
      />
      <Select
        className={styles.filter}
        placeholder="ИТ-продукт"
        value={filters.product || undefined}
        allowClear
        showSearch
        optionFilterProp="label"
        options={productOptions.map((value) => ({ value, label: value }))}
        onChange={(value) => updateFilter('product', value ?? '')}
      />
      <DatePicker.RangePicker
        placeholder={['Период с', 'Период по']}
        format="DD.MM.YYYY"
        value={filters.period ? [dayjs(filters.period[0]), dayjs(filters.period[1])] : null}
        onChange={(values) => {
          if (!values?.[0] || !values[1]) {
            updateFilter('period', null);
            return;
          }
          updateFilter('period', [values[0].format('YYYY-MM-DD'), values[1].format('YYYY-MM-DD')]);
        }}
      />
      <Select
        className={styles.filter}
        placeholder="Менеджер"
        value={filters.manager || undefined}
        allowClear
        showSearch
        optionFilterProp="label"
        options={managerOptions.map((value) => ({ value, label: value }))}
        onChange={(value) => updateFilter('manager', value ?? '')}
      />
      <Button
        className={styles.resetButton}
        type="link"
        disabled={!hasActiveUniversityFilters(filters)}
        onClick={() => {
          setFilters(emptyUniversityFilters);
          setVisibleCount(20);
        }}
      >
        Сбросить фильтры
      </Button>
    </>
  );

  return (
    <PageLayout>
      <div className={styles.page}>
        <div className={styles.headingRow}>
          <header className={styles.heading}>
            <h1 className={styles.title}>Вузы</h1>
            <p className={styles.subtitle}>Все учебные заведения и информация о текущем состоянии взаимодействия</p>
          </header>
          <div className={styles.headingActions}>
            <Button icon={<UploadOutlined />} onClick={() => setIsImportOpen(true)}>Загрузить каталог</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsCreateOpen(true)}>Добавить вуз</Button>
          </div>
        </div>

        <section className={styles.metrics} aria-label="Сводка по вузам">
          <div className={styles.metric}>
            <span className={`${styles.metricIcon} ${styles.metricIconTotal}`}><BankOutlined /></span>
            <span><span className={styles.metricLabel}>Всего вузов</span><strong className={styles.metricValue}>{summary.total}</strong></span>
          </div>
          <div className={styles.metric}>
            <span className={`${styles.metricIcon} ${styles.metricIconActive}`}><CheckCircleFilled /></span>
            <span><span className={styles.metricLabel}>Активных</span><strong className={styles.metricValue}>{summary.active}</strong></span>
          </div>
          <div className={styles.metric}>
            <span className={`${styles.metricIcon} ${styles.metricIconProgress}`}><SyncOutlined /></span>
            <span><span className={styles.metricLabel}>В процессе</span><strong className={styles.metricValue}>{summary.progress}</strong></span>
          </div>
          <div className={styles.metric}>
            <span className={`${styles.metricIcon} ${styles.metricIconPaused}`}><PauseCircleFilled /></span>
            <span><span className={styles.metricLabel}>На паузе</span><strong className={styles.metricValue}>{summary.paused}</strong></span>
          </div>
          <div className={styles.metric}>
            <span className={`${styles.metricIcon} ${styles.metricIconRegions}`}><EnvironmentOutlined /></span>
            <span><span className={styles.metricLabel}>Регионов</span><strong className={styles.metricValue}>{summary.regions}</strong></span>
          </div>
          <div className={styles.metric}>
            <span className={`${styles.metricIcon} ${styles.metricIconFederal}`}><BankOutlined /></span>
            <span><span className={styles.metricLabel}>Федеральных</span><strong className={styles.metricValue}>{summary.federal}</strong></span>
          </div>
        </section>

        <section aria-label="Фильтры вузов">
          {isTableCompact ? (
            <div className={styles.filtersToggle}>
              <Collapse
                ghost
                items={[{
                  key: 'filters',
                  label: 'Фильтры',
                  extra: <FilterOutlined />,
                  children: <div className={styles.filtersRow}>{filterControls}</div>,
                }]}
              />
            </div>
          ) : (
            <div className={styles.filtersRow}>{filterControls}</div>
          )}
        </section>

        <section className={styles.tableCard} aria-label="Список вузов">
          <Table
            sticky
            rowKey="id"
            size="middle"
            columns={columns}
            dataSource={filteredUniversities.slice(0, visibleCount)}
            pagination={false}
            locale={{ emptyText: 'Вузы не найдены' }}
            rowClassName={styles.clickableRow}
            onRow={(item) => ({
              onClick: (event) => {
                const target = event.target as HTMLElement;
                if (target.closest('.ant-table-row-expand-icon, .ant-table-row-expand-icon-cell')) return;
                navigate(`/universities/${item.id}`);
              },
            })}
            expandable={isTableCompact || isIntermediateViewport ? {
              columnWidth: 36,
              expandedRowRender: (item) => (
                <div className={styles.mobileDetails}>
                  {isTableCompact && (
                    <div className={styles.mobileDetail}><span className={styles.mobileDetailLabel}>Город</span><span>{item.city}</span></div>
                  )}
                  <div className={styles.mobileDetail}><span className={styles.mobileDetailLabel}>Статус</span><span>{universityStatusLabels[item.status]}</span></div>
                  <div className={styles.mobileDetail}><span className={styles.mobileDetailLabel}>Тип</span><span>{universityTypeLabels[item.type]}</span></div>
                  <div className={styles.mobileDetail}><span className={styles.mobileDetailLabel}>Профиль</span><span>{item.profile}</span></div>
                  <div className={styles.mobileDetail}><span className={styles.mobileDetailLabel}>Взаимодействия</span><span>{item.interactions}</span></div>
                  <div className={styles.mobileDetail}><span className={styles.mobileDetailLabel}>Программы</span><span>{item.programs}</span></div>
                  <div className={styles.mobileDetail}><span className={styles.mobileDetailLabel}>Потоки</span><span>{item.streams}</span></div>
                  <div className={styles.mobileDetail}><span className={styles.mobileDetailLabel}>Активность</span>{renderActivity(item)}</div>
                </div>
              ),
            } : undefined}
          />
          {visibleCount < filteredUniversities.length && (
            <div ref={loadMoreRef} className={styles.loadMore} aria-live="polite">
              <Spin size="small" />
              <span>Загружаем ещё вузы...</span>
            </div>
          )}
        </section>
      </div>

      <UniversityCreateModal open={isCreateOpen} onClose={() => setIsCreateOpen(false)} onCreate={handleCreate} />
      <CatalogImportModal
        open={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onApplied={() => {
          setUniversities([...listUniversities()]);
          setVisibleCount(20);
        }}
      />
    </PageLayout>
  );
};

export default UniversitiesPage;
