import { Alert, Button, Card, Col, Row, Spin, Statistic, Table, Tag } from 'antd';
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
  due_at: string | null;
  program_instance_id: string | null;
};

const severityColor = { critical: 'red', high: 'volcano', medium: 'gold', low: 'blue' };

const NbaTodayPage = () => {
  const [items, setItems] = useState<NbaItem[] | null>(null);
  const [error, setError] = useState<string>();
  const [summary, setSummary] = useState<{ role: string; cards: Record<string, number> }>();
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([apiRequest<NbaItem[]>('/api/nba/today'), apiRequest<{ role: string; cards: Record<string, number> }>('/api/nba/home')]).then(([loadedItems, loadedSummary]) => { setItems(loadedItems); setSummary(loadedSummary); }).catch(() => setError('Не удалось загрузить рабочий стол.'));
  }, []);

  if (error) return <Alert type="error" showIcon message={error} />;
  if (items === null) return <Spin size="large" />;

  return <><Card title={`Рабочий стол · ${summary?.role ?? ''}`}><Row gutter={16}>{Object.entries(summary?.cards ?? {}).map(([name, value]) => <Col key={name}><Statistic title={name.replaceAll('_', ' ')} value={value} /></Col>)}</Row></Card>
    <Card title="Сегодня" extra={<Tag>{items.length}</Tag>} style={{ marginTop: 16 }}>
    <Table<NbaItem> rowKey="id" dataSource={items} pagination={false} locale={{ emptyText: 'На сегодня нет активных рекомендаций' }} columns={[
      { title: 'Severity', dataIndex: 'severity', render: (value) => <Tag color={severityColor[value]}>{value}</Tag> },
      { title: 'Организация', dataIndex: 'organization_name' },
      { title: 'Продукт', dataIndex: 'product_name', render: (value) => value ?? '—' },
      { title: 'Причина', dataIndex: 'reason' },
      { title: 'Срок', dataIndex: 'due_at', render: (value) => value?.slice(0, 10) ?? '—' },
      { title: 'Действие', render: (_, item) => <Button size="small" disabled={!item.program_instance_id} onClick={() => item.program_instance_id && navigate(`/v2/programs/${item.program_instance_id}`)}>{item.action}</Button> },
    ]} />
  </Card></>;
};

export default NbaTodayPage;
