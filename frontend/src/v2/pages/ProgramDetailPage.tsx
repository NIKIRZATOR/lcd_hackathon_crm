import { Alert, Button, Card, Checkbox, DatePicker, Descriptions, Input, InputNumber, List, Select, Space, Spin, Tag, Typography, Upload } from 'antd';
import type { UploadProps } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import { ApiError, apiRequest } from '../../api/client';

type ProgramInstance = { organization_id: string; direction_name: string; product_name: string; playbook_name: string; playbook_code: string | null; status: string; kam_name: string | null; academic_window_title: string | null; current_stage_code: string | null; health_score: number | null; health_band: string };
type Checklist = { id: string; label: string; item_type: 'checkbox' | 'file' | 'date' | 'stakeholder_role' | 'number' | 'text'; required: boolean; required_attachment_kind?: string | null; is_done: boolean; value_text?: string; value_number?: number; value_date?: string; stakeholder_id?: string; attachment_id?: string };
type Stage = { id: string; status: string; due_at: string | null; code: string; name: string; phase_code: string; phase_name: string; order_index: number; is_optional: boolean; is_final: boolean };
type Transition = { id: string; name: string | null; to_stage_name: string };
type Workflow = { stages: Stage[]; current_stage_instance_id: string | null; available_transitions: Transition[]; transition_history?: { id: string; comment: string | null; performed_at: string }[] };
type Comment = { id: string; text: string; created_at: string };
type Attachment = { id: string; file_id: string; original_name: string; attachment_kind?: string | null };
type ProgramMetric = { applications_count: number; students_count: number; streams_count: number; teacher_activity_on: string | null; synced_at: string | null };
type SyncResult = { mapped: number; unmatched: number; errors: number; metrics: ProgramMetric };
type Stakeholder = { id: string; full_name: string; role_code: string };
type License = { transfer_status: string; valid_until: string | null; signed_at: string | null };
type Teacher = { id: string; full_name: string; status: string; last_lms_activity_on: string | null };
type NbaItem = { id: string; program_instance_id: string | null; action: string; severity: string };

const ProgramDetailPage = () => {
  const { id } = useParams();
  const [program, setProgram] = useState<ProgramInstance | null>(null);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [checklist, setChecklist] = useState<Checklist[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [metrics, setMetrics] = useState<ProgramMetric | null>(null);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [license, setLicense] = useState<License | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [nba, setNba] = useState<NbaItem>();
  const [syncResult, setSyncResult] = useState<SyncResult>();
  const [selectedStageId, setSelectedStageId] = useState<string>();
  const [selectedTransition, setSelectedTransition] = useState<string>();
  const [comment, setComment] = useState(() => localStorage.getItem(`program:${id}:transition-comment`) ?? '');
  const [message, setMessage] = useState<string>();
  const [attachmentKind, setAttachmentKind] = useState('');

  const activeStage = useMemo(() => workflow?.stages.find((stage) => stage.id === workflow.current_stage_instance_id), [workflow]);
  const selectedStage = useMemo(() => workflow?.stages.find((stage) => stage.id === selectedStageId) ?? activeStage, [activeStage, selectedStageId, workflow]);
  const currentStage = selectedStage;
  const isViewingCurrentStage = selectedStage?.id === workflow?.current_stage_instance_id;
  const missingRequired = checklist.filter((item) => item.required && !item.is_done).length;

  useEffect(() => { localStorage.setItem(`program:${id}:transition-comment`, comment); }, [comment, id]);

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
    const [loadedProgram, loadedWorkflow, loadedMetrics, loadedLicense, loadedTeachers, loadedNba] = await Promise.all([
      apiRequest<ProgramInstance>(`/api/program-instances/${id}`),
      apiRequest<Workflow>(`/api/program-instances/${id}/workflow`),
      apiRequest<ProgramMetric | null>(`/api/integrations/program-instances/${id}/metrics`),
      apiRequest<License | null>(`/api/program-instances/${id}/license`),
      apiRequest<Teacher[]>(`/api/program-instances/${id}/teachers`),
      apiRequest<NbaItem[]>('/api/nba/today'),
    ]);
    setProgram(loadedProgram); setWorkflow(loadedWorkflow); setMetrics(loadedMetrics);
    setLicense(loadedLicense); setTeachers(loadedTeachers); setNba(loadedNba.find((item) => item.program_instance_id === id));
    setStakeholders(await apiRequest<Stakeholder[]>(`/api/organizations/${loadedProgram.organization_id}/stakeholders`));
    setSelectedTransition(loadedWorkflow.available_transitions[0]?.id);
    if (loadedWorkflow.current_stage_instance_id) {
      await loadStage(loadedWorkflow.current_stage_instance_id);
    }
  };

  useEffect(() => { void load().catch(() => setMessage('Не удалось загрузить workflow программы.')); }, [id]);

  const closeStage = async (skipCurrent = false) => {
    if (!id || !isViewingCurrentStage || (!selectedTransition && !currentStage?.is_final) || !workflow?.current_stage_instance_id) return;
    setMessage(undefined);
    try {
      await apiRequest(`/api/program-instances/${id}/transition`, { method: 'POST', body: JSON.stringify({ transition_id: selectedTransition ?? null, expected_current_stage_instance_id: workflow.current_stage_instance_id, comment: comment.trim() || null, skip_current: skipCurrent }) });
      setComment(''); localStorage.removeItem(`program:${id}:transition-comment`);
      await load();
    } catch (caught) {
      const reasons = caught instanceof ApiError && Array.isArray((caught.payload?.details as { reasons?: { message: string }[] } | undefined)?.reasons)
        ? (caught.payload?.details as { reasons: { message: string }[] }).reasons.map((reason) => reason.message).join('; ')
        : undefined;
      setMessage(reasons || (caught instanceof ApiError ? caught.message : 'Переход заблокирован.'));
    }
  };

  const uploadProps: UploadProps = {
    beforeUpload: async (file) => {
      if (!selectedStage || !isViewingCurrentStage) return Upload.LIST_IGNORE;
      const form = new FormData(); form.append('file', file); if (attachmentKind.trim()) form.append('attachment_kind', attachmentKind.trim());
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
    {nba && <Alert style={{ marginTop: 16 }} type={nba.severity === 'critical' ? 'error' : 'warning'} showIcon message={nba.action} />}
    <Card size="small" title="Текущее состояние" style={{ marginTop: 16 }}><Descriptions size="small" column={{ xs: 1, md: 2 }}><Descriptions.Item label="Лицензия">{license ? `${license.transfer_status} · ${license.valid_until?.slice(0, 10) ?? 'без срока'}` : '—'}</Descriptions.Item><Descriptions.Item label="Преподаватель">{teachers[0] ? `${teachers[0].full_name} · ${teachers[0].status}` : '—'}</Descriptions.Item></Descriptions></Card>
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
        <List dataSource={checklist} locale={{ emptyText: 'Для этапа нет checklist' }} renderItem={(item) => <List.Item><ChecklistInput item={item} disabled={!isViewingCurrentStage} stakeholders={stakeholders} attachments={attachments} onSave={async (payload) => { await apiRequest(`/api/stage-instances/checklist/${item.id}`, { method: 'PATCH', body: JSON.stringify(payload) }); if (selectedStage) await loadStage(selectedStage.id); }} /></List.Item>} />
        {missingRequired > 0 && <Alert type="warning" showIcon message={`Не выполнено обязательных пунктов: ${missingRequired}`} />}
        <Typography.Title level={5}>Комментарии</Typography.Title>
        <List size="small" dataSource={comments} locale={{ emptyText: 'Комментариев пока нет' }} renderItem={(item) => <List.Item>{item.text}</List.Item>} />
        <Input.TextArea disabled={!isViewingCurrentStage} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Комментарий к переходу" rows={2} />
        <Typography.Title level={5}>Файлы</Typography.Title>
        <List size="small" dataSource={attachments} locale={{ emptyText: 'Файлов пока нет' }} renderItem={(item) => <List.Item>{item.original_name}{item.attachment_kind ? ` · ${item.attachment_kind}` : ''}</List.Item>} />
        <Space><Select style={{ width: 240 }} value={attachmentKind || undefined} placeholder="Вид вложения" options={[...new Set(checklist.filter((item) => item.item_type === 'file').map((item) => item.required_attachment_kind).filter(Boolean) as string[])].map((value) => ({ value, label: value }))} onChange={setAttachmentKind} allowClear /><Upload {...uploadProps} disabled={!isViewingCurrentStage}><Button disabled={!isViewingCurrentStage}>Приложить файл</Button></Upload></Space>
        {isViewingCurrentStage && workflow.available_transitions.length > 0 && <div style={{ marginTop: 20 }}><Select style={{ minWidth: 260 }} options={workflow.available_transitions.map((item) => ({ value: item.id, label: item.name ?? item.to_stage_name }))} value={selectedTransition} onChange={setSelectedTransition} /><Button type="primary" disabled={missingRequired > 0 || !selectedTransition} style={{ marginLeft: 8 }} onClick={() => void closeStage()}>Закрыть и перейти к «{transition?.to_stage_name ?? 'следующему этапу'}»</Button>{currentStage?.is_optional && <Button style={{ marginLeft: 8 }} onClick={() => void closeStage(true)}>Пропустить</Button>}</div>}
        {isViewingCurrentStage && currentStage?.is_final && workflow.available_transitions.length === 0 && <Button type="primary" disabled={missingRequired > 0} style={{ marginTop: 20 }} onClick={() => void closeStage()}>Завершить программу</Button>}
        <Typography.Title level={5}>История переходов</Typography.Title>
        <List size="small" dataSource={workflow.transition_history ?? []} locale={{ emptyText: 'Переходов пока нет' }} renderItem={(item) => <List.Item>{item.performed_at?.slice(0, 16) ?? '—'} · {item.comment || 'без комментария'}</List.Item>} />
      </Card>
    </div>
  </>;
};

const ChecklistInput = ({ item, disabled, stakeholders, attachments, onSave }: { item: Checklist; disabled: boolean; stakeholders: Stakeholder[]; attachments: Attachment[]; onSave: (payload: Record<string, unknown>) => Promise<void> }) => {
  const label = <span>{item.label}{item.required ? ' *' : ''}</span>;
  if (item.item_type === 'checkbox') return <Checkbox disabled={disabled} checked={item.is_done} onChange={(event) => void onSave({ is_done: event.target.checked })}>{label}</Checkbox>;
  const save = (field: string, value: unknown) => void onSave({ is_done: value !== null && value !== undefined && value !== '', [field]: value });
  return <div style={{ width: '100%' }}><Typography.Text>{label}</Typography.Text>
    {item.item_type === 'text' && <Input disabled={disabled} defaultValue={item.value_text} onBlur={(event) => save('value_text', event.target.value)} />}
    {item.item_type === 'number' && <InputNumber disabled={disabled} value={item.value_number} onChange={(value) => save('value_number', value)} style={{ width: '100%' }} />}
    {item.item_type === 'date' && <DatePicker disabled={disabled} value={item.value_date ? dayjs(item.value_date) : null} onChange={(value) => save('value_date', value?.format('YYYY-MM-DD') ?? null)} style={{ width: '100%' }} />}
    {item.item_type === 'stakeholder_role' && <Select disabled={disabled} value={item.stakeholder_id} options={stakeholders.map((person) => ({ value: person.id, label: `${person.full_name} · ${person.role_code}` }))} onChange={(value) => save('stakeholder_id', value)} style={{ width: '100%' }} />}
    {item.item_type === 'file' && <Select disabled={disabled} value={item.attachment_id} options={attachments.filter((file) => !item.required_attachment_kind || file.attachment_kind === item.required_attachment_kind).map((file) => ({ value: file.file_id, label: file.original_name }))} onChange={(value) => save('attachment_id', value)} placeholder={item.required_attachment_kind ? `Загрузите файл вида ${item.required_attachment_kind}` : 'Сначала приложите файл к этапу'} style={{ width: '100%' }} />}
  </div>;
};

export default ProgramDetailPage;
