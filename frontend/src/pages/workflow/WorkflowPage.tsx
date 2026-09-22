import {
  CheckCircleFilled,
  CheckOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  ExclamationCircleFilled,
  FilterOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { Button, Collapse, DatePicker, Grid, Input, message, Progress, Segmented, Select, Spin, Table, Tag, Tooltip } from 'antd';
import type { TableColumnsType } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../auth';
import PageLayout from '../../components/pageLayout/PageLayout';
import { listWorkflows, summarizeWorkflows } from './api';
import type { WorkflowFilters, WorkflowItem, WorkflowStatus } from './types';

import styles from './WorkflowPage.module.scss';

const { useBreakpoint } = Grid;

const statusConfig: Record<WorkflowStatus, { label: string; className: string }> = {
  active: { label: 'В работе', className: styles.statusActive },
  attention: { label: 'Требует внимания', className: styles.statusAttention },
  completed: { label: 'Завершён', className: styles.statusCompleted },
  overdue: { label: 'Просрочен', className: styles.statusOverdue },
};

const getInitials = (value: string) => value.slice(0, 2).toUpperCase();

const intermediateViewportQuery = '(min-width: 986px) and (max-width: 1246px)';

const subscribeToIntermediateViewport = (onChange: () => void) => {
  const mediaQuery = window.matchMedia(intermediateViewportQuery);
  mediaQuery.addEventListener('change', onChange);

  return () => mediaQuery.removeEventListener('change', onChange);
};

const getIntermediateViewportSnapshot = () => window.matchMedia(intermediateViewportQuery).matches;

const readFiltersFromUrl = (searchParams: URLSearchParams): WorkflowFilters => ({
  search: searchParams.get('search') ?? '',
  university: searchParams.get('university') ?? '',
  program: searchParams.get('program') ?? '',
  product: searchParams.get('product') ?? '',
  stage: searchParams.get('stage') ?? '',
  status: (searchParams.get('status') ?? '') in statusConfig ? searchParams.get('status') ?? '' : '',
  responsible: searchParams.get('responsible') ?? '',
  periodFrom: searchParams.get('periodFrom') ?? '',
  periodTo: searchParams.get('periodTo') ?? '',
});

const renderStatus = (status: WorkflowStatus, compact = false) => {
  const config = statusConfig[status];

  if (compact) {
    return (
      <Tooltip title={config.label}>
        <span className={`${styles.statusDot} ${config.className}`} aria-label={config.label} />
      </Tooltip>
    );
  }

  return <Tag className={`${styles.status} ${config.className}`}>{config.label}</Tag>;
};

const renderProgress = (value: number, compact: boolean) => {
  if (compact) {
    return <span className={styles.progressValue}>{value}%</span>;
  }

  return <Progress className={styles.progress} percent={value} size="small" showInfo />;
};

const renderExpandedProgress = (value: number) => (
  <Progress className={styles.expandedProgress} percent={value} size="small" showInfo />
);

const WorkflowPage = () => {
  const screens = useBreakpoint();
  const isTableCompact = !screens.lg;
  const isIntermediateViewport = useSyncExternalStore(
    subscribeToIntermediateViewport,
    getIntermediateViewportSnapshot,
    () => false,
  );
  const isCompactVisual = isTableCompact || isIntermediateViewport;
  const navigate = useNavigate();
  const { user } = useAuth();
  const workflows = listWorkflows();
  const summary = summarizeWorkflows(workflows);
  const mineNames = useMemo(
    () => [user?.full_name, user?.username].map((value) => value?.trim() ?? '').filter(Boolean),
    [user?.full_name, user?.username],
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => readFiltersFromUrl(searchParams));
  const [view, setView] = useState<'all' | 'mine'>(() => (searchParams.get('view') === 'mine' ? 'mine' : 'all'));
  const [visibleCount, setVisibleCount] = useState(20);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nextParams = new URLSearchParams();

    if (view !== 'all') nextParams.set('view', view);
    Object.entries(filters).forEach(([key, value]) => {
      if (value) nextParams.set(key, value);
    });

    setSearchParams(nextParams, { replace: true });
  }, [filters, setSearchParams, view]);

  const workflowFilterOptions = {
    universities: [...new Set(workflows.map((item) => item.universityShort))].sort((left, right) => left.localeCompare(right, 'ru')),
    programs: [...new Set(workflows.map((item) => item.program))],
    products: [...new Set(workflows.map((item) => item.product))],
    stages: [...new Set(workflows.map((item) => item.stage))],
    responsibles: [...new Set(workflows.map((item) => item.responsible))],
  };

  const query = filters.search.trim().toLowerCase();
  const filteredItems = workflows.filter((item) => {
    const matchesSearch =
      !query ||
      [item.university, item.universityShort, item.program].some((value) =>
        value.toLowerCase().includes(query),
      );
    const matchesView = view === 'all' || mineNames.includes(item.responsible);

    return (
      matchesSearch &&
      matchesView &&
      (!filters.university || item.universityShort === filters.university) &&
      (!filters.program || item.program === filters.program) &&
      (!filters.product || item.product === filters.product) &&
      (!filters.stage || item.stage === filters.stage) &&
      (!filters.status || item.status === filters.status) &&
      (!filters.responsible || item.responsible === filters.responsible) &&
      (!filters.periodFrom || item.deadline >= filters.periodFrom) &&
      (!filters.periodTo || item.deadline <= filters.periodTo)
    );
  });

  useEffect(() => {
    const loadMoreNode = loadMoreRef.current;

    if (!loadMoreNode || visibleCount >= filteredItems.length) {
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
  }, [filteredItems.length, isLoadingMore, visibleCount]);

  const updateFilter = (key: keyof WorkflowFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const handleExport = () => {
    message.success(`Подготовлено к экспорту: ${filteredItems.length} workflow`);
  };

  const tableLayout = isTableCompact ? 'narrow' : isIntermediateViewport ? 'mid' : 'wide';
  const columns = ([
    {
      title: 'ВУЗ',
      dataIndex: 'universityShort',
      key: 'university',
      show: ['wide', 'mid', 'narrow'],
      sorter: (a: WorkflowItem, b: WorkflowItem) => a.university.localeCompare(b.university),
      render: (value: string) => (
        <div className={styles.universityCell}>
          <span className={styles.universityBadge}>{getInitials(value)}</span>
          {value}
        </div>
      ),
    },
    { title: tableLayout === 'wide' ? 'ИТ-программа' : 'Программа', dataIndex: 'program', key: 'program', show: ['wide', 'mid', 'narrow'] },
    { title: 'ИТ-продукт', dataIndex: 'product', key: 'product', show: ['wide'] },
    {
      title: 'Текущий этап',
      dataIndex: 'stage',
      key: 'stage',
      show: ['wide'],
      render: (value: string) => (
        <div className={styles.stageCell}>
          <span className={styles.stageDot} />
          {value}
        </div>
      ),
    },
    {
      title: 'Ответственный',
      dataIndex: 'responsible',
      key: 'responsible',
      show: ['wide'],
      render: (value: string) => (
        <div className={styles.responsibleCell}>
          <span className={styles.responsibleBadge}>{getInitials(value)}</span>
          {value}
        </div>
      ),
    },
    { title: 'Срок', dataIndex: 'deadline', key: 'deadline', show: ['wide'], render: (value: string) => dayjs(value).format('DD.MM.YYYY') },
    { title: 'Статус', dataIndex: 'status', key: 'status', show: ['wide', 'mid', 'narrow'], render: (status: WorkflowStatus) => renderStatus(status, isCompactVisual) },
    {
      title: tableLayout === 'mid' ? '%' : 'Прогресс',
      dataIndex: 'progress',
      key: 'progress',
      show: ['wide', 'mid'],
      render: (value: number) => renderProgress(value, isCompactVisual),
    },
  ] satisfies Array<TableColumnsType<WorkflowItem>[number] & { show: string[] }>)
    .filter((column) => column.show.includes(tableLayout))
    .map((column) => {
      const visible = { ...column } as Omit<typeof column, 'show'> & { show?: string[] };
      delete visible.show;
      return visible;
    });

  const filterControls = (
    <>
      <Input className={styles.search} prefix={<SearchOutlined />} placeholder="Поиск по названию или вузу..." value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} allowClear />
      <Select className={styles.filter} placeholder="Вуз" value={filters.university || undefined} onChange={(value) => updateFilter('university', value ?? '')} allowClear showSearch optionFilterProp="label" options={workflowFilterOptions.universities.map((value) => ({ label: value, value }))} />
      <Select className={styles.filter} placeholder="ИТ-программа" value={filters.program || undefined} onChange={(value) => updateFilter('program', value ?? '')} allowClear options={workflowFilterOptions.programs.map((value) => ({ label: value, value }))} />
      <Select className={styles.filter} placeholder="ИТ-продукт" value={filters.product || undefined} onChange={(value) => updateFilter('product', value ?? '')} allowClear options={workflowFilterOptions.products.map((value) => ({ label: value, value }))} />
      <Select className={styles.filter} placeholder="Этап" value={filters.stage || undefined} onChange={(value) => updateFilter('stage', value ?? '')} allowClear options={workflowFilterOptions.stages.map((value) => ({ label: value, value }))} />
      <Select className={`${styles.filter} ${styles.statusFilter}`} placeholder="Статус" value={filters.status || undefined} onChange={(value) => updateFilter('status', value ?? '')} allowClear options={(Object.keys(statusConfig) as WorkflowStatus[]).map((value) => ({ value, label: statusConfig[value].label }))} />
      <Select className={styles.filter} placeholder="Ответственный" value={filters.responsible || undefined} onChange={(value) => updateFilter('responsible', value ?? '')} allowClear options={workflowFilterOptions.responsibles.map((value) => ({ label: value, value }))} />
      <DatePicker.RangePicker
        className={styles.period}
        placeholder={['Период с', 'Период по']}
        format="DD.MM.YYYY"
        value={filters.periodFrom && filters.periodTo ? [dayjs(filters.periodFrom), dayjs(filters.periodTo)] : null}
        onChange={(values) => {
          const from = values?.[0];
          const to = values?.[1];
          if (!from || !to) {
            setFilters((current) => ({ ...current, periodFrom: '', periodTo: '' }));
            return;
          }
          setFilters((current) => ({
            ...current,
            periodFrom: from.format('YYYY-MM-DD'),
            periodTo: to.format('YYYY-MM-DD'),
          }));
        }}
      />
      <div className={styles.actions}>
        <Button icon={<DownloadOutlined />} onClick={handleExport}>Экспорт</Button>
      </div>
    </>
  );

  return (
    <PageLayout>
      <div className={styles.page}>
        <header className={styles.heading}>
          <h1 className={styles.title}>Все workflow</h1>
          <p className={styles.subtitle}>
            Отслеживайте все взаимодействия с университетами и быстро переходите к нужному workflow.
          </p>
        </header>

        <section className={styles.metrics} aria-label="Сводка workflow">
          <div className={styles.metric}><span className={`${styles.metricIcon} ${styles.metricIconActive}`}><CheckOutlined /></span><span><span className={styles.metricLabel}>Активные</span><strong className={styles.metricValue}>{summary.active}</strong></span></div>
          <div className={styles.metric}><span className={`${styles.metricIcon} ${styles.metricIconAttention}`}><ExclamationCircleFilled /></span><span><span className={styles.metricLabel}>Требуют внимания</span><strong className={styles.metricValue}>{summary.attention}</strong></span></div>
          <div className={styles.metric}><span className={`${styles.metricIcon} ${styles.metricIconCompleted}`}><CheckCircleFilled /></span><span><span className={styles.metricLabel}>Завершены</span><strong className={styles.metricValue}>{summary.completed}</strong></span></div>
          <div className={styles.metric}><span className={`${styles.metricIcon} ${styles.metricIconOverdue}`}><ClockCircleOutlined /></span><span><span className={styles.metricLabel}>Просрочены</span><strong className={styles.metricValue}>{summary.overdue}</strong></span></div>
        </section>

        <section className={styles.toolbar} aria-label="Фильтры workflow">
          <div className={styles.tabsRow}>
            <Segmented
              value={view}
              onChange={(value) => setView(value as 'all' | 'mine')}
              options={[{ label: 'Все workflow', value: 'all' }, { label: 'Мои workflow', value: 'mine' }]}
            />
          </div>
          <div className={`${styles.filtersPanel} ${isTableCompact ? styles.filtersPanelCompact : ''}`}>
            {isTableCompact && (
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
            )}
            {!isTableCompact && <div className={styles.filtersRow}>{filterControls}</div>}
          </div>
        </section>

        <section className={styles.tableCard} aria-label="Список workflow">
          <Table
            sticky
            rowKey="id"
            size="middle"
            columns={columns}
            dataSource={filteredItems.slice(0, visibleCount)}
            pagination={false}
            rowClassName={styles.clickableRow}
            onRow={(item) => ({ onClick: () => navigate(`/workflow/${item.id}`) })}
            expandable={isIntermediateViewport || isTableCompact ? {
              expandedRowRender: (item) => (
                <div className={styles.mobileDetails}>
                  <div className={styles.mobileDetail}><span className={styles.mobileDetailLabel}>Продукт</span><span>{item.product}</span></div>
                  <div className={styles.mobileDetail}><span className={styles.mobileDetailLabel}>Этап</span><span>{item.stage}</span></div>
                  <div className={styles.mobileDetail}><span className={styles.mobileDetailLabel}>Ответственный</span><span>{item.responsible}</span></div>
                  <div className={styles.mobileDetail}><span className={styles.mobileDetailLabel}>Прогресс</span>{renderExpandedProgress(item.progress)}</div>
                </div>
              ),
            } : undefined}
          />
          {visibleCount < filteredItems.length && (
            <div ref={loadMoreRef} className={styles.loadMore} aria-live="polite">
              <Spin size="small" />
              <span>Загружаем ещё workflow...</span>
            </div>
          )}
        </section>
      </div>
    </PageLayout>
  );
};

export default WorkflowPage;