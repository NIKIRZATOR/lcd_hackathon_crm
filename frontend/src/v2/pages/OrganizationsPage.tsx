import { Alert, Card, Input, Table, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { apiRequest } from '../../api/client';

type Organization = { id: string; name: string; short_name: string | null; type_name: string; region: string | null; city: string | null; status: string; kam_name: string | null; active_programs_count: number; worst_health_score: number | null; worst_health_band: string | null; nearest_risk: string | null; no_activity: boolean };
type Page<T> = { items: T[]; total: number };

const OrganizationsPage = () => {
  const [data, setData] = useState<Page<Organization>>({ items: [], total: 0 });
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ limit: '50' });
    if (search) params.set('search', search);
    apiRequest<Page<Organization>>(`/api/organizations?${params}`)
      .then(setData)
      .catch(() => setError('Не удалось загрузить организации.'));
  }, [search]);

  return (
    <Card title="Организации">
      <Typography.Paragraph>Реестр доступен в рамках вашего портфеля.</Typography.Paragraph>
      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}
      <Input.Search placeholder="Поиск по названию" allowClear onSearch={setSearch} onChange={(event) => !event.target.value && setSearch('')} style={{ maxWidth: 360, marginBottom: 16 }} />
      <Table<Organization>
        rowKey="id"
        dataSource={data.items}
        pagination={{ total: data.total, pageSize: 50, hideOnSinglePage: true }}
        columns={[
          { title: 'Организация', dataIndex: 'name', render: (name, record) => <Link to={`/v2/organizations/${record.id}`}>{name}</Link> },
          { title: 'Тип', dataIndex: 'type_name' },
          { title: 'Регион', dataIndex: 'region', render: (value) => value ?? '—' },
          { title: 'Город', dataIndex: 'city', render: (value) => value ?? '—' },
          { title: 'Статус', dataIndex: 'status', render: (value) => <Tag color={value === 'active' ? 'green' : 'default'}>{value}</Tag> },
          { title: 'Программы', dataIndex: 'active_programs_count' },
          { title: 'Health', render: (_, record) => record.worst_health_score === null ? '—' : <Tag color={record.worst_health_band === 'green' ? 'green' : record.worst_health_band === 'yellow' ? 'gold' : 'red'}>{record.worst_health_score} · {record.worst_health_band}</Tag> },
          { title: 'Риск / NBA', dataIndex: 'nearest_risk', render: (value, record) => value ? <Tag color="orange">{value}</Tag> : record.no_activity ? <Tag color="gold">без заходов</Tag> : '—' },
          { title: 'KAM', dataIndex: 'kam_name', render: (value) => value ?? <Tag>без KAM</Tag> },
        ]}
      />
    </Card>
  );
};

export default OrganizationsPage;
