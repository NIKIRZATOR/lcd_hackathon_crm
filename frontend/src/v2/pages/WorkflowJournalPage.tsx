import { Alert, Card, Segmented, Spin, Table, Tag } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { apiRequest } from '../../api/client';

type Row = { id: string; organization_name: string; direction_name: string; product_name: string; playbook_name: string; current_stage_name: string | null; due_at: string | null; health_score: number | null; health_band: string; kam_name: string | null; students_count: number | null; applications_count: number | null };
const colors = { green: 'green', yellow: 'gold', red: 'red' };

const WorkflowJournalPage = () => {
  const [preset, setPreset] = useState('all'); const [rows, setRows] = useState<Row[] | null>(null); const [error, setError] = useState<string>(); const navigate = useNavigate();
  useEffect(() => { setRows(null); apiRequest<Row[]>(`/api/workflow-journal?preset=${preset}`).then(setRows).catch(() => setError('Не удалось загрузить журнал программ.')); }, [preset]);
  if (error) return <Alert type="error" showIcon message={error} />;
  return <Card title="Журнал workflow"><Segmented value={preset} onChange={(value) => setPreset(String(value))} options={[['all', 'Все'], ['overdue', 'Просрочено'], ['semester', 'Семестр'], ['renewal', 'Продление'], ['lms_silence', 'LMS silence']].map(([value, label]) => ({ value, label }))} style={{ marginBottom: 16 }} />{rows === null ? <Spin /> : <Table<Row> rowKey="id" dataSource={rows} pagination={false} onRow={(row) => ({ onClick: () => navigate(`/v2/programs/${row.id}`), style: { cursor: 'pointer' } })} columns={[{ title: 'Организация', dataIndex: 'organization_name' }, { title: 'Направление', dataIndex: 'direction_name' }, { title: 'Продукт', dataIndex: 'product_name' }, { title: 'Плейбук', dataIndex: 'playbook_name' }, { title: 'Этап', dataIndex: 'current_stage_name', render: (value) => value ?? '—' }, { title: 'SLA', dataIndex: 'due_at', render: (value) => value?.slice(0, 10) ?? '—' }, { title: 'Health', render: (_, row) => <Tag color={colors[row.health_band]}>{row.health_score ?? '—'} · {row.health_band}</Tag> }, { title: 'KAM', dataIndex: 'kam_name', render: (value) => value ?? '—' }, { title: 'Студенты', dataIndex: 'students_count', render: (value) => value ?? '—' }, { title: 'Заявки', dataIndex: 'applications_count', render: (value) => value ?? '—' }]} />}</Card>;
};
export default WorkflowJournalPage;
