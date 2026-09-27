import { Alert, Button, Card, Col, List, Row, Spin, Statistic, Table, Tag } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { apiRequest } from '../../api/client';

type NbaItem = {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  organization_name: string;
  product_name: string | null;
  reason: string;
  action: string;
  priority: string;
  action_target: string | null;
  due_at: string | null;
  program_instance_id: string | null;
};

type HomeSummary = {
  role: 'MANAGER' | 'ADMIN';
  cards: Record<string, number>;
  b2c?: { applications: number; payment_records: number; students: number; streams: number };
  critical_by_kam?: Array<{ kam: string; count: number }>;
  links?: Array<{ key: string; label: string; path: string }>;
  system_events?: Array<{ id: string; action: string; result: string; created_at: string }>;
};

const severityColor = { critical: 'red', high: 'volcano', medium: 'gold', low: 'blue' };

const NbaTodayPage = () => {
  const [items, setItems] = useState<NbaItem[] | null>(null);
  const [error, setError] = useState<string>();
  const [summary, setSummary] = useState<HomeSummary>();
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([apiRequest<NbaItem[]>('/api/nba/today'), apiRequest<HomeSummary>('/api/nba/home')])
      .then(([loadedItems, loadedSummary]) => { setItems(loadedItems); setSummary(loadedSummary); })
      .catch(() => setError('Не удалось загрузить рабочий стол.'));
  }, []);

  if (error) return <Alert type="error" showIcon message={error} />;
  if (items === null) return <Spin size="large" />;

  const linkFor = (key: string) => summary?.links?.find((link) => link.key === key);
  return <>
    <Card title={`Рабочий стол · ${summary?.role ?? ''}`}>
      <Row gutter={[16, 16]}>{Object.entries(summary?.cards ?? {}).map(([name, value]) => {
        const link = linkFor(name);
        return <Col key={name}><Statistic title={`* ${link?.label ?? name.replaceAll('_', ' ')}`} value={value} /><Button type="link" size="small" disabled={!link} onClick={() => link && navigate(link.path)}>Открыть *</Button></Col>;
      })}</Row>
    </Card>
    {summary?.role === 'MANAGER' && <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
      <Col xs={24} md={12}><Card title="* Critical по KAM"><List size="small" dataSource={summary.critical_by_kam ?? []} locale={{ emptyText: 'Критичных задач нет' }} renderItem={(item) => <List.Item>{item.kam}<Tag color="red">{item.count}</Tag></List.Item>} /></Card></Col>
      <Col xs={24} md={12}><Card title="* B2C summary"><Statistic title="Заявки" value={summary.b2c?.applications ?? 0} /><Statistic title="Заказы" value={summary.b2c?.payment_records ?? 0} /><Statistic title="Студенты" value={summary.b2c?.students ?? 0} /><Statistic title="Потоки" value={summary.b2c?.streams ?? 0} /></Card></Col>
    </Row>}
    {summary?.role === 'ADMIN' && <Card title="* Системные события" style={{ marginTop: 16 }}><List size="small" dataSource={summary.system_events ?? []} locale={{ emptyText: 'Событий нет' }} renderItem={(item) => <List.Item><Tag color={item.result === 'FAILED' ? 'red' : 'blue'}>{item.result}</Tag>{item.action}<span style={{ marginLeft: 'auto' }}>{item.created_at.slice(0, 16).replace('T', ' ')}</span></List.Item>} /></Card>}
    <Card title="Сегодня" extra={<Tag>{items.length}</Tag>} style={{ marginTop: 16 }}>
      <Table<NbaItem> rowKey="id" dataSource={items.slice(0, 10)} pagination={false} locale={{ emptyText: 'На сегодня нет активных рекомендаций' }} columns={[
        { title: 'Приоритет', dataIndex: 'priority', render: (value) => <Tag color={value === 'P0' ? 'red' : value === 'P1' ? 'volcano' : value === 'P2' ? 'green' : 'blue'}>{value}</Tag> },
        { title: 'Severity', dataIndex: 'severity', render: (value) => <Tag color={severityColor[value]}>{value}</Tag> },
        { title: 'Организация', dataIndex: 'organization_name' },
        { title: 'Продукт', dataIndex: 'product_name', render: (value) => value ?? '—' },
        { title: 'Причина', dataIndex: 'reason' },
        { title: 'Срок', dataIndex: 'due_at', render: (value) => value?.slice(0, 10) ?? '—' },
        { title: 'Действие', render: (_, item) => <Button size="small" disabled={!item.program_instance_id} onClick={() => item.program_instance_id && navigate(`/programs/${item.program_instance_id}?focus=${item.action_target ?? 'program'}`)}>{item.action}</Button> },
      ]} />
      {items.length > 10 && <Tag style={{ marginTop: 12 }}>ещё {items.length - 10}</Tag>}
    </Card>
  </>;
};

export default NbaTodayPage;
