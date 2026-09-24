import { Alert, Card, Table, Tabs, Tag } from 'antd';
import { useEffect, useState } from 'react';

import { apiRequest } from '../../api/client';

type Stage = { code: string; name: string; phase: string };
type Playbook = { id: string; code: string | null; name: string; applies_to_type: string; status: string; published_version: number | null };

const ManagementPage = () => {
  const [stages, setStages] = useState<Stage[]>([]);
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([apiRequest<Stage[]>('/api/management/stages'), apiRequest<Playbook[]>('/api/management/playbooks')])
      .then(([loadedStages, loadedPlaybooks]) => { setStages(loadedStages); setPlaybooks(loadedPlaybooks); })
      .catch(() => setError(true));
  }, []);

  if (error) return <Alert type="error" message="Не удалось загрузить каталог управления." showIcon />;
  return <Card title="Управление"><Tabs items={[
    { key: 'playbooks', label: 'Плейбуки', children: <Table<Playbook> rowKey="id" dataSource={playbooks} pagination={false} columns={[
      { title: 'Код', dataIndex: 'code' }, { title: 'Название', dataIndex: 'name' }, { title: 'Для типа', dataIndex: 'applies_to_type' },
      { title: 'Статус', dataIndex: 'status', render: (value) => <Tag color={value === 'published' ? 'green' : 'default'}>{value}</Tag> },
      { title: 'Версия', dataIndex: 'published_version', render: (value) => value ?? '—' },
    ]} /> },
    { key: 'stages', label: 'Этапы', children: <Table<Stage> rowKey="code" dataSource={stages} pagination={false} columns={[
      { title: 'Код', dataIndex: 'code' }, { title: 'Название', dataIndex: 'name' }, { title: 'Фаза', dataIndex: 'phase' },
    ]} /> },
  ]} /></Card>;
};

export default ManagementPage;
