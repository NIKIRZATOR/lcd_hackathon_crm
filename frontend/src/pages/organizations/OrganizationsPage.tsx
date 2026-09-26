import {
  BankOutlined,
  EnvironmentOutlined,
  SearchOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Alert, Empty, Input, Select, Spin, Table, Tag } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../auth';
import { apiRequest } from '../../api/client';

import HealthMark from './organizations/components/HealthMark';

import styles from './organizations/OrganizationsPage.module.scss';

type Page<T> = { items: T[]; total: number };

type OrganizationApi = {
  id: string;
  name: string;
  short_name: string | null;
  region: string | null;
  city: string | null;
  status: string;
  type_name: string;
  kam_name: string | null;
  active_programs_count: number;
  worst_health_score: number | null;
  worst_health_band: 'green' | 'yellow' | 'red' | null;
  nearest_risk: string | null;
  no_activity: boolean;
  updated_at: string;
};

type JournalRow = {
  id: string;
  organization_name: string;
  direction_name: string;
  product_name: string;
};

type OrganizationRow = OrganizationApi & {
  shortName: string;
  directions: string[];
  products: string[];
};

type Filters = {
  search: string;
  region: string;
  type: string;
  direction: string;
  product: string;
  kam: string;
};

const normalize = (value: string) => value.trim().toLocaleLowerCase('ru');

const loadAllOrganizations = async () => {
  const first = await apiRequest<Page<OrganizationApi>>('/api/organizations?limit=100&offset=0');
  const items = [...first.items];

  for (let offset = items.length; offset < first.total; offset += 100) {
    const next = await apiRequest<Page<OrganizationApi>>(`/api/organizations?limit=100&offset=${offset}`);
    items.push(...next.items);
  }

  return items;
};

const OrganizationsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState<OrganizationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const seesTeam = user?.roles.some((role) => role === 'MANAGER' || role === 'ADMIN') ?? false;

  const filters: Filters = {
    search: params.get('search') ?? '',
    region: params.get('region') ?? '',
    type: params.get('type') ?? '',
    direction: params.get('direction') ?? '',
    product: params.get('product') ?? '',
    kam: params.get('kam') ?? '',
  };

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      loadAllOrganizations(),
      apiRequest<JournalRow[]>('/api/workflow-journal?preset=all').catch(() => []),
    ])
      .then(([organizations, journal]) => {
        if (cancelled) return;

        const journalByOrganization = new Map<string, JournalRow[]>();
        journal.forEach((row) => {
          const key = normalize(row.organization_name);
          journalByOrganization.set(key, [...(journalByOrganization.get(key) ?? []), row]);
        });

        setItems(organizations.map((organization) => {
          const byName = journalByOrganization.get(normalize(organization.name)) ?? [];
          const byShortName = organization.short_name
            ? journalByOrganization.get(normalize(organization.short_name)) ?? []
            : [];
          const rows = [...new Map([...byName, ...byShortName].map((row) => [row.id, row])).values()];

          return {
            ...organization,
            shortName: organization.short_name || organization.name,
            directions: [...new Set(rows.map((row) => row.direction_name).filter(Boolean))],
            products: [...new Set(rows.map((row) => row.product_name).filter(Boolean))],
          };
        }));
      })
      .catch(() => { if (!cancelled) setError('Не удалось загрузить организации.'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  const updateFilters = (patch: Partial<Filters>) => {
    const next = { ...filters, ...patch };
    const nextParams = new URLSearchParams();
    Object.entries(next).forEach(([key, value]) => { if (value) nextParams.set(key, value); });
    setParams(nextParams, { replace: true });
  };

  const options = useMemo(() => ({
    regions: [...new Set(items.map((item) => item.region).filter((value): value is string => Boolean(value)))].sort(),
    types: [...new Set(items.map((item) => item.type_name).filter(Boolean))].sort(),
    directions: [...new Set(items.flatMap((item) => item.directions))].sort(),
    products: [...new Set(items.flatMap((item) => item.products))].sort(),
    kams: [...new Set(items.map((item) => item.kam_name).filter((value): value is string => Boolean(value)))].sort(),
  }), [items]);

  const filtered = useMemo(() => items.filter((item) => {
    const search = filters.search.trim().toLocaleLowerCase('ru');
    return (!search || `${item.name} ${item.shortName} ${item.city ?? ''}`.toLocaleLowerCase('ru').includes(search))
      && (!filters.region || item.region === filters.region)
      && (!filters.type || item.type_name === filters.type)
      && (!filters.direction || item.directions.includes(filters.direction))
      && (!filters.product || item.products.includes(filters.product))
      && (!filters.kam || item.kam_name === filters.kam);
  }), [filters, items]);

  const summary = useMemo(() => ({
    total: items.length,
    programs: items.reduce((sum, item) => sum + item.active_programs_count, 0),
    attention: items.filter((item) => item.worst_health_band === 'yellow' || item.worst_health_band === 'red').length,
    empty: items.filter((item) => item.no_activity).length,
  }), [items]);

  if (loading) return <div className={styles.loader}><Spin size="large" /></div>;

  return (
    <div className={styles.page}>
      <div className={styles.headingRow}>
        <div className={styles.heading}>
          <h1 className={styles.title}>Организации</h1>
          <p className={styles.subtitle}>{seesTeam ? 'Площадки команды и их программы.' : 'Площадки вашего портфеля и их программы.'}</p>
        </div>
      </div>

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}

      <section className={styles.metrics} aria-label="Сводка портфеля">
        <div className={styles.metric}><span className={`${styles.metricIcon} ${styles.metricIconTotal}`}><BankOutlined /></span><span><span className={styles.metricLabel}>Площадок</span><strong className={styles.metricValue}>{summary.total}</strong></span></div>
        <div className={styles.metric}><span className={`${styles.metricIcon} ${styles.metricIconRegions}`}><EnvironmentOutlined /></span><span><span className={styles.metricLabel}>Программ</span><strong className={styles.metricValue}>{summary.programs}</strong></span></div>
        <div className={styles.metric}><span className={`${styles.metricIcon} ${styles.metricIconPaused}`}><WarningOutlined /></span><span><span className={styles.metricLabel}>Жёлтые и красные</span><strong className={styles.metricValue}>{summary.attention}</strong></span></div>
        <div className={styles.metric}><span className={`${styles.metricIcon} ${styles.metricIconProgress}`}><BankOutlined /></span><span><span className={styles.metricLabel}>Без активности</span><strong className={styles.metricValue}>{summary.empty}</strong></span></div>
      </section>

      <section className={styles.filtersRow} aria-label="Фильтры организаций">
        <Input className={styles.search} prefix={<SearchOutlined />} allowClear placeholder="Поиск по организации или городу" value={filters.search} onChange={(event) => updateFilters({ search: event.target.value })} />
        <Select className={styles.filter} allowClear placeholder="Регион" value={filters.region || undefined} options={options.regions.map((value) => ({ value, label: value }))} onChange={(value) => updateFilters({ region: value ?? '' })} />
        <Select className={styles.filter} allowClear placeholder="Тип" value={filters.type || undefined} options={options.types.map((value) => ({ value, label: value }))} onChange={(value) => updateFilters({ type: value ?? '' })} />
        <Select className={styles.filter} allowClear showSearch placeholder="Направление" value={filters.direction || undefined} options={options.directions.map((value) => ({ value, label: value }))} onChange={(value) => updateFilters({ direction: value ?? '' })} />
        <Select className={styles.filter} allowClear showSearch placeholder="Продукт" value={filters.product || undefined} options={options.products.map((value) => ({ value, label: value }))} onChange={(value) => updateFilters({ product: value ?? '' })} />
        {seesTeam && <Select className={styles.filter} allowClear showSearch placeholder="KAM" value={filters.kam || undefined} options={options.kams.map((value) => ({ value, label: value }))} onChange={(value) => updateFilters({ kam: value ?? '' })} />}
      </section>

      {filtered.length === 0 ? <Empty description={items.length === 0 ? 'Организаций пока нет.' : 'По этим фильтрам организаций нет.'} /> : (
        <section className={styles.tableCard}>
          <Table<OrganizationRow>
            rowKey="id"
            dataSource={filtered}
            pagination={{ pageSize: 20, showSizeChanger: false }}
            rowClassName={styles.clickableRow}
            onRow={(item) => ({ onClick: () => navigate(`/organizations/${item.id}`) })}
            columns={[
              { title: 'Организация', dataIndex: 'shortName', render: (value) => <strong>{value}</strong> },
              { title: 'Город', dataIndex: 'city', render: (value) => value ?? '—' },
              { title: 'Тип', dataIndex: 'type_name' },
              ...(seesTeam ? [{ title: 'KAM', dataIndex: 'kam_name', render: (value: string | null) => value ?? <Tag>не назначен</Tag> }] : []),
              { title: 'Программы', dataIndex: 'active_programs_count' },
              { title: 'Здоровье', render: (_, item) => <HealthMark score={item.worst_health_score} band={item.worst_health_band} /> },
              { title: 'Ближайший риск', dataIndex: 'nearest_risk', render: (value, item) => value ? <Tag color="orange">{value}</Tag> : item.no_activity ? <Tag color="gold">без активности</Tag> : '—' },
            ]}
          />
        </section>
      )}
    </div>
  );
};

export default OrganizationsPage;
