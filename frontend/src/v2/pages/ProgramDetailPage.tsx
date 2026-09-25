import { Alert, Button, Card, Checkbox, Descriptions, Input, List, Select, Spin, Tag, Typography, Upload } from 'antd';
import type { UploadProps } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import { apiRequest } from '../../api/client';

type ProgramInstance = { direction_name: string; product_name: string; playbook_name: string; playbook_code: string | null; status: string; kam_name: string | null; academic_window_title: string | null; current_stage_code: string | null; health_score: number | null; health_band: string };
type Checklist = { id: string; label: string; required: boolean; is_done: boolean };
type Stage = { id: string; status: string; due_at: string | null; code: string; name: string; phase_code: string; phase_name: string; order_index: number; is_optional: boolean; is_final: boolean };
type Transition = { id: string; name: string | null; to_stage_name: string };
type Workflow = { stages: Stage[]; current_stage_instance_id: string | null; available_transitions: Transition[] };
type Comment = { id: string; text: string; created_at: string };
type Attachment = { id: string; original_name: string };
type ProgramMetric = { applications_count: number; students_count: number; streams_count: number; teacher_activity_on: string | null; synced_at: string | null };
type SyncResult = { mapped: number; unmatched: number; errors: number; metrics: ProgramMetric };

const ProgramDetailPage = () => {
  const { id } = useParams();
  const [program, setProgram] = useState<ProgramInstance | null>(null);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [checklist, setChecklist] = useState<Checklist[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [metrics, setMetrics] = useState<ProgramMetric | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult>();
  const [selectedStageId, setSelectedStageId] = useState<string>();
  const [selectedTransition, setSelectedTransition] = useState<string>();
  const [comment, setComment] = useState('');
  const [message, setMessage] = useState<string>();

  const activeStage = useMemo(() => workflow?.stages.find((stage) => stage.id === workflow.current_stage_instance_id), [workflow]);
  const selectedStage = useMemo(() => workflow?.stages.find((stage) => stage.id === selectedStageId) ?? activeStage, [activeStage, selectedStageId, workflow]);
  const currentStage = selectedStage;
  const isViewingCurrentStage = selectedStage?.id === workflow?.current_stage_instance_id;
  const missingRequired = checklist.filter((item) => item.required && !item.is_done).length;

  const loadStage = async (stageId: string) => {
    const [loadedChecklist, loadedComments, loadedAttachments] = await Promise.all([
      apiRequest<Checklist[]>(`/api/stage-instances/${stageId}/checklist`),
      apiRequest<Comment[]>(`/api/workflows/stage-instances/${stageId}/comments`),
      apiRequest<Attachment[]>(`/api/workflows/stage-instances/${stageId}/attachments`),
    ]);
    setSelectedStageId(stageId);
    setChecklist(loadedChecklist);
    setComments(loadedComments);
    setAttachments(loadedAttachments);
  };

  const load = async () => {
    if (!id) return;
    const [loadedProgram, loadedWorkflow, loadedMetrics] = await Promise.all([
      apiRequest<ProgramInstance>(`/api/program-instances/${id}`),
      apiRequest<Workflow>(`/api/program-instances/${id}/workflow`),
      apiRequest<ProgramMetric | null>(`/api/integrations/program-instances/${id}/metrics`),
    ]);
    setProgram(loadedProgram); setWorkflow(loadedWorkflow); setMetrics(loadedMetrics);
    setSelectedTransition(loadedWorkflow.available_transitions[0]?.id);
    if (loadedWorkflow.current_stage_instance_id) {
      await loadStage(loadedWorkflow.current_stage_instance_id);
    }
  };

  useEffect(() => { void load().catch(() => setMessage('Не удалось загрузить workflow программы.')); }, [id]);

  const closeStage = async () => {
    if (!id || !isViewingCurrentStage || (!selectedTransition && !currentStage?.is_final) || !workflow?.current_stage_instance_id) return;
    setMessage(undefined);
    try {
      await apiRequest(`/api/program-instances/${id}/transition`, { method: 'POST', body: JSON.stringify({ transition_id: selectedTransition ?? null, expected_current_stage_instance_id: workflow.current_stage_instance_id }) });
      await load();
    } catch {
      setMessage('Переход заблокирован: заполните обязательные пункты checklist или требуемые артефакты этапа.');
    }
  };

  const addComment = async () => {
    if (!selectedStage || !isViewingCurrentStage || !comment.trim()) return;
    await apiRequest(`/api/workflows/stage-instances/${selectedStage.id}/comments`, { method: 'POST', body: JSON.stringify({ text: comment }) });
    setComment(''); await load();
  };

  const uploadProps: UploadProps = {
    beforeUpload: async (file) => {
      if (!selectedStage || !isViewingCurrentStage) return Upload.LIST_IGNORE;
      const form = new FormData(); form.append('file', file);
      try {
        await apiRequest(`/api/workflows/stage-instances/${selectedStage.id}/attachments`, { method: 'POST', body: form });
        await load();
      } catch { setMessage('Не удалось загрузить файл. Разрешены PDF, DOCX и XLSX.'); }
      return false;
    },
    showUploadList: false,
  };

  const syncMetrics = async () => {
    if (!id) return;
    try {
      const result = await apiRequest<SyncResult>(`/api/integrations/program-instances/${id}/sync`, { method: 'POST' });
      setSyncResult(result); setMetrics(result.metrics); await load();
    } catch {
      setMessage('Не удалось синхронизировать mock-данные программы.');
    }
  };

  if (message && !program) return <Alert type="error" message={message} showIcon />;
  if (!program || !workflow) return <Spin size="large" />;

  const phaseGroups = workflow.stages.reduce<Record<string, { name: string; stages: Stage[] }>>((groups, stage) => {
    groups[stage.phase_code] ??= { name: stage.phase_name, stages: [] }; groups[stage.phase_code].stages.push(stage); return groups;
  }, {});
  const transition = workflow.available_transitions.find((item) => item.id === selectedTransition);

  return <>
    <Card title={`${program.product_name} · ${program.direction_name}`} extra={<Tag>{program.status}</Tag>}>
      <Descriptions size="small" column={{ xs: 1, md: 5 }}><Descriptions.Item label="Плейбук">{program.playbook_name} {program.playbook_code ? `(${program.playbook_code})` : ''}</Descriptions.Item><Descriptions.Item label="KAM">{program.kam_name ?? 'По организации'}</Descriptions.Item><Descriptions.Item label="Учебное окно">{program.academic_window_title ?? 'Не выбрано'}</Descriptions.Item><Descriptions.Item label="Текущий этап">{currentStage?.name ?? 'Не начат'}</Descriptions.Item><Descriptions.Item label="Health"><Tag color={program.health_band === 'green' ? 'green' : program.health_band === 'yellow' ? 'gold' : 'red'}>{program.health_score ?? '—'} · {program.health_band}</Tag></Descriptions.Item></Descriptions>
    </Card>
    <Card size="small" title="Метрики программы" extra={<Button onClick={() => void syncMetrics()}>Синхронизировать</Button>} style={{ marginTop: 16 }}>
      <Descriptions size="small" column={{ xs: 1, md: 4 }}><Descriptions.Item label="Заявки">{metrics?.applications_count ?? '—'}</Descriptions.Item><Descriptions.Item label="Студенты">{metrics?.students_count ?? '—'}</Descriptions.Item><Descriptions.Item label="Потоки">{metrics?.streams_count ?? '—'}</Descriptions.Item><Descriptions.Item label="Активность преподавателя">{metrics?.teacher_activity_on ?? '—'}</Descriptions.Item></Descriptions>
      {syncResult && <Alert type={syncResult.errors ? 'warning' : 'success'} showIcon message={`Синхронизация: mapped ${syncResult.mapped}, unmatched ${syncResult.unmatched}, errors ${syncResult.errors}.`} />}
    </Card>
    {message && <Alert style={{ marginTop: 16 }} type="warning" message={message} showIcon />}
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) minmax(0, 2fr)', gap: 16, marginTop: 16 }}>
      <Card title="Путь программы">
        {Object.entries(phaseGroups).map(([code, group]) => <div key={code} style={{ marginBottom: 16 }}><Typography.Text strong>{group.name}</Typography.Text><List size="small" dataSource={group.stages} renderItem={(stage) => {
          const canOpen = stage.status === 'COMPLETED' || stage.id === workflow.current_stage_instance_id;
          return <List.Item onClick={() => canOpen && void loadStage(stage.id).catch(() => setMessage('Не удалось загрузить данные этапа.'))} style={{ cursor: canOpen ? 'pointer' : 'default', paddingInline: 0, background: stage.id === selectedStage?.id ? '#f9f0ff' : undefined }}><Tag color={stage.id === workflow.current_stage_instance_id ? 'purple' : stage.status === 'COMPLETED' ? 'green' : 'default'}>{stage.status === 'COMPLETED' ? '✓' : stage.order_index}</Tag><span>{stage.name}</span></List.Item>;
        }} /></div>)}
      </Card>
      <Card title={currentStage?.name ?? 'Workflow не запущен'}>
        <Descriptions size="small" column={1}><Descriptions.Item label="SLA / due">{currentStage?.due_at?.slice(0, 10) ?? 'Не задано'}</Descriptions.Item><Descriptions.Item label="Статус">{currentStage?.status ?? '—'}</Descriptions.Item></Descriptions>
        {!isViewingCurrentStage && <Alert type="info" showIcon message="Просмотр закрытого этапа: комментарии и файлы доступны только для чтения." />}
        <Typography.Title level={5}>Checklist</Typography.Title>
        <List dataSource={checklist} locale={{ emptyText: 'Для этапа нет checklist' }} renderItem={(item) => <List.Item><Checkbox disabled={!isViewingCurrentStage} checked={item.is_done} onChange={async (event) => { await apiRequest(`/api/stage-instances/checklist/${item.id}`, { method: 'PATCH', body: JSON.stringify({ is_done: event.target.checked }) }); if (selectedStage) await loadStage(selectedStage.id); }}>{item.label}{item.required ? ' *' : ''}</Checkbox></List.Item>} />
        {missingRequired > 0 && <Alert type="warning" showIcon message={`Не выполнено обязательных пунктов: ${missingRequired}`} />}
        <Typography.Title level={5}>Комментарии</Typography.Title>
        <List size="small" dataSource={comments} locale={{ emptyText: 'Комментариев пока нет' }} renderItem={(item) => <List.Item>{item.text}</List.Item>} />
        <Input.TextArea disabled={!isViewingCurrentStage} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Комментарий к этапу" rows={2} />
        <Button disabled={!isViewingCurrentStage} style={{ marginTop: 8 }} onClick={() => void addComment()}>Сохранить комментарий</Button>
        <Typography.Title level={5}>Файлы</Typography.Title>
        <List size="small" dataSource={attachments} locale={{ emptyText: 'Файлов пока нет' }} renderItem={(item) => <List.Item>{item.original_name}</List.Item>} />
        <Upload {...uploadProps} disabled={!isViewingCurrentStage}><Button disabled={!isViewingCurrentStage}>Приложить файл</Button></Upload>
        {isViewingCurrentStage && workflow.available_transitions.length > 0 && <div style={{ marginTop: 20 }}><Select style={{ minWidth: 260 }} options={workflow.available_transitions.map((item) => ({ value: item.id, label: item.name ?? item.to_stage_name }))} value={selectedTransition} onChange={setSelectedTransition} /><Button type="primary" disabled={missingRequired > 0 || !selectedTransition} style={{ marginLeft: 8 }} onClick={() => void closeStage()}>Закрыть и перейти к «{transition?.to_stage_name ?? 'следующему этапу'}»</Button></div>}
        {isViewingCurrentStage && currentStage?.is_final && workflow.available_transitions.length === 0 && <Button type="primary" disabled={missingRequired > 0} style={{ marginTop: 20 }} onClick={() => void closeStage()}>Завершить программу</Button>}
      </Card>
    </div>
  </>;
};

export default ProgramDetailPage;
