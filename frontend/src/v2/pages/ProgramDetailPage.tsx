import { Alert, Card, Checkbox, Descriptions, List, Spin, Tag } from 'antd';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { apiRequest } from '../../api/client';

type ProgramInstance = { direction_name: string; product_name: string; status: string; kam_name: string | null; academic_window_title: string | null; current_stage_code: string | null; legacy_interaction_id: string | null };
type Checklist = { id: string; label: string; required: boolean; is_done: boolean };

const ProgramDetailPage = () => {
  const { id } = useParams();
  const [program, setProgram] = useState<ProgramInstance | null>(null);
  const [error, setError] = useState(false);
  const [checklist, setChecklist] = useState<Checklist[]>([]);
  useEffect(() => { if (id) apiRequest<ProgramInstance>(`/api/program-instances/${id}`).then(setProgram).catch(() => setError(true)); }, [id]);
  useEffect(() => { if (!id) return; apiRequest<Checklist[]>(`/api/program-instances/${id}/checklist`).then(setChecklist).catch(() => undefined); }, [id]);
  if (error) return <Alert type="error" message="Не удалось загрузить программу." showIcon />;
  if (!program) return <Spin size="large" />;
  return <Card title={program.product_name} extra={<Tag>{program.status}</Tag>}><Descriptions column={1}>
    <Descriptions.Item label="Направление">{program.direction_name}</Descriptions.Item>
    <Descriptions.Item label="KAM">{program.kam_name ?? 'По организации'}</Descriptions.Item>
    <Descriptions.Item label="Учебное окно">{program.academic_window_title ?? 'Не выбрано'}</Descriptions.Item>
    <Descriptions.Item label="Текущий этап">{program.current_stage_code ?? 'Не начат'}</Descriptions.Item>
  </Descriptions><Card type="inner" title="Checklist текущего этапа" style={{ marginTop: 16 }}><List dataSource={checklist} locale={{ emptyText: 'Для текущего этапа нет checklist' }} renderItem={(item) => <List.Item><Checkbox checked={item.is_done} onChange={async (event) => { await apiRequest(`/api/stage-instances/checklist/${item.id}`, { method: 'PATCH', body: JSON.stringify({ is_done: event.target.checked }) }); setChecklist(checklist.map((value) => value.id === item.id ? { ...value, is_done: event.target.checked } : value)); }}>{item.label}{item.required ? ' *' : ''}</Checkbox></List.Item>} /></Card></Card>;
};

export default ProgramDetailPage;
