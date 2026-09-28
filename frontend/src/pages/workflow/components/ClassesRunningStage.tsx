import { DeleteOutlined, DownloadOutlined, FileOutlined, FilePdfOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Input, Select, Upload, message } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';

import { apiDownload, apiRequest } from '../../../api/client';
import { roleLabel } from '../../organizations/screenModel';
import type { DeskFile } from '../api';
import { loadSiteContacts, pickResponsible, type SiteContact } from '../stages/contactSearch';
import { classesClosePlan, emptyRunningDraft, signalTone, streamStatuses, CLASSES_RUNNING_SLA_DAYS, type RunningDraft, type StreamStatus } from '../stages/classesRunning';
import { stageDeadline } from '../stages/firstMeeting';
import { isAllowedWorkflowFile, workflowFileRejectionMessage } from '../shared/workflowFiles';

import tileStyles from './ContactSearchStage.module.scss';
import formStyles from './FirstMeetingStage.module.scss';
import StageFactTiles from './StageFactTiles';
import StageTaskChecklist from './StageTaskChecklist';

type ClassesRunningStageProps = {
  stageId: string;
  programId: string;
  organizationId: string;
  productName: string;
  windowTitle: string;
  healthLabel: string;
  dueAt: string | null;
  files: DeskFile[];
  fallbackPeople: Array<{ id: string; name: string; role: string; roleCode: string }>;
  readOnly: boolean;
  onPlan: (plan: ReturnType<typeof classesClosePlan>) => void;
  onUpload: (file: File, kind: string | null) => Promise<DeskFile | void>;
  onDeleteFile: (file: DeskFile) => Promise<void>;
};

type CarrierRow = { product_id: string; program_instance_id?: string | null; full_name: string; status: string };
const FILE_KIND = 'class_note';
const storageKey = (stageId: string) => `rtk-eduflow:classes-running:${stageId}`;
const nextCustomId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? `custom-${crypto.randomUUID()}` : `custom-${Date.now()}`);
const downloadBlob = (blob: Blob, name: string) => { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url); };

const ClassesRunningStage = ({ stageId, programId, organizationId, productName, windowTitle, healthLabel, dueAt, files, fallbackPeople, readOnly, onPlan, onUpload, onDeleteFile }: ClassesRunningStageProps) => {
  const gap = organizationId.startsWith('gap-') || stageId.startsWith('gap-');
  const [contacts, setContacts] = useState<SiteContact[]>([]);
  const [pending, setPending] = useState(true);
  const [carrier, setCarrier] = useState<CarrierRow | null>(null);
  const [accessText, setAccessText] = useState('');
  const [students, setStudents] = useState<number | null>(null);
  const [signalAt, setSignalAt] = useState<string | null>(null);
  const [draft, setDraft] = useState<RunningDraft>(() => {
    try { return { ...emptyRunningDraft(), ...JSON.parse(localStorage.getItem(storageKey(stageId)) || '{}') }; } catch { return emptyRunningDraft(); }
  });

  useEffect(() => {
    let cancelled = false;
    if (gap) { setPending(false); return () => { cancelled = true; }; }
    loadSiteContacts(organizationId).then((rows) => { if (!cancelled) setContacts(rows); }).catch(() => undefined);
    apiRequest<{ product_id?: string }>(`/api/program-instances/${programId}`).then(async (program) => {
      if (cancelled || !program.product_id) return;
      const rows = await apiRequest<CarrierRow[]>(`/api/organizations/${organizationId}/teachers`).catch(() => []);
      const own = rows.filter((row) => row.product_id === program.product_id);
      if (!cancelled) setCarrier(own.find((row) => row.program_instance_id === programId) ?? own[0] ?? null);
    }).catch(() => undefined);
    apiRequest<{ product_access?: string | null; transfer_status?: string | null } | null>(`/api/program-instances/${programId}/license`).then((row) => { if (!cancelled) setAccessText(row?.transfer_status === 'transferred' ? (row.product_access?.trim() || 'Доступ передан') : 'Доступ не передан'); }).catch(() => undefined);
    apiRequest<{ students_count?: number; last_lms_signal_at?: string | null; last_website_signal_at?: string | null } | null>(`/api/integrations/program-instances/${programId}/metrics`).then((row) => {
      if (cancelled) return;
      setStudents(row?.students_count ?? null);
      setSignalAt(row?.last_lms_signal_at ?? row?.last_website_signal_at ?? null);
    }).catch(() => { if (!cancelled) { setStudents(null); setSignalAt(null); } }).finally(() => { if (!cancelled) setPending(false); });
    return () => { cancelled = true; };
  }, [gap, organizationId, programId]);

  useEffect(() => { localStorage.setItem(storageKey(stageId), JSON.stringify(draft)); }, [stageId, draft]);

  const silence = signalAt ? dayjs().startOf('day').diff(dayjs(signalAt).startOf('day'), 'day') : null;
  const tone = signalTone(students, silence);
  const hasCarrier = Boolean(carrier && carrier.status !== 'left');
  const commentNeeded = tone !== 'green' || draft.status === 'issues' || draft.status === 'failed';
  const plan = classesClosePlan({ hasCarrier, tone, students, silenceDays: silence, status: draft.status, comment: draft.comment });
  const responsible = pickResponsible(contacts, null);
  const deadline = stageDeadline(dueAt, CLASSES_RUNNING_SLA_DAYS, dayjs());
  const notes = files.filter((file) => file.kind === FILE_KIND);
  const delta = (limit: number) => silence !== null && silence <= limit;
  const customRows = draft.order.flatMap((id) => draft.custom.filter((row) => row.id === id));

  useEffect(() => { onPlan(plan); }, [plan.enabled, plan.button]);

  return (
    <div className={tileStyles.root}>
      <StageFactTiles tiles={[
        { kind: 'person', label: 'Ответственный', value: responsible?.name ?? '', empty: 'Ответственный не найден', hint: responsible ? roleLabel(responsible.roleCode) : undefined, pending },
        { kind: 'phone', label: 'Телефон', value: responsible?.phone ?? '', empty: 'Телефон не найден', pending },
        { kind: 'mail', label: 'Почта', value: responsible?.email ?? '', empty: 'Почта не найдена', pending },
        { kind: 'due', label: 'Срок', value: deadline.date.format('D MMMM YYYY'), hint: `${deadline.caption} · ${deadline.origin}`, dueState: deadline.daysLeft < 0 ? 'late' : deadline.daysLeft === 0 ? 'today' : 'ok' },
      ]}>
        <div className={tileStyles.factGrid}>
          <div className={tileStyles.factCell}><span>Преподаватель</span><b>{carrier?.full_name || 'Не найден'}</b><small>{carrier?.status === 'active' ? 'Ведёт' : 'Не ведёт'}</small></div>
          <div className={tileStyles.factCell}><span>Продукт</span><b>{productName || 'Не указан'}</b></div>
          <div className={tileStyles.factCell}><span>Доступ</span><b>{accessText || 'Не передан'}</b></div>
          <div className={tileStyles.factCell}><span>Окно</span><b>{windowTitle}</b></div>
          <div className={tileStyles.factCell}><span>Здоровье</span><b>{healthLabel}</b></div>
          <div className={tileStyles.factCell}><span>Студенты</span><b>{students ?? 'Нет сигнала'}</b></div>
          <div className={tileStyles.factCell}><span>Последнее событие</span><b>{signalAt ? dayjs(signalAt).format('D MMMM YYYY') : 'Нет события'}</b></div>
          <div className={tileStyles.factCell}><span>Сигнал</span><b style={{ color: tone === 'green' ? '#137333' : tone === 'yellow' ? '#a16207' : '#c24155' }}>{tone === 'green' ? 'Зелёный' : tone === 'yellow' ? 'Жёлтый' : 'Красный'}</b><small>7 {delta(7) ? 'есть' : 'тишина'} · 14 {delta(14) ? 'есть' : 'тишина'} · 30 {delta(30) ? 'есть' : 'тишина'}</small></div>
        </div>
      </StageFactTiles>
      <div className={formStyles.fields}>
        <label className={formStyles.field}>
          <span>Статус потока</span>
          <Select allowClear placeholder="Выберите статус" disabled={readOnly || pending} value={draft.status ?? undefined} options={streamStatuses.map((item) => ({ value: item.value, label: item.label }))} onChange={(value) => setDraft((current) => ({ ...current, status: (value ?? null) as StreamStatus | null }))} />
        </label>
        <div className={formStyles.field}>
          <Button disabled={readOnly || draft.replacement} onClick={() => { setDraft((current) => ({ ...current, replacement: true })); message.success('Замена преподавателя запущена. Этап не закрыт.'); }}>Запустить замену преподавателя</Button>
        </div>
        <label className={formStyles.field}>
          <span>Комментарий</span>
          <Input.TextArea disabled={readOnly || pending} autoSize={{ minRows: 2, maxRows: 5 }} value={draft.comment} placeholder={commentNeeded ? 'нужен при жёлтом или красном сигнале и при проблемах или срыве' : 'необязательно'} onChange={(event) => setDraft((current) => ({ ...current, comment: event.target.value }))} />
        </label>
        <div className={formStyles.field}>
          <span>Файл</span>
          <div className={formStyles.fileSlot}>
            {notes.map((file, index) => (
              <div key={file.id} className={formStyles.fileCard}>
                <span className={`${formStyles.fileMark} ${file.name.toLowerCase().endsWith('.pdf') ? formStyles.fileMarkPdf : ''}`} aria-hidden="true">{file.name.toLowerCase().endsWith('.pdf') ? <FilePdfOutlined /> : <FileOutlined />}</span>
                <span className={formStyles.fileName}>{file.name}</span>
                <span className={formStyles.fileMeta}>{index === notes.length - 1 ? 'текущая версия' : `версия ${index + 1}`}</span>
                <span className={formStyles.fileActions}>
                  <Button type="text" aria-label="Скачать" icon={<DownloadOutlined />} onClick={() => void apiDownload(`/api/workflows/attachments/${file.id}/download`).then((blob) => downloadBlob(blob, file.name))} />
                  {!readOnly && <Button type="text" danger aria-label="Удалить файл" icon={<DeleteOutlined />} onClick={() => void onDeleteFile(file)} />}
                </span>
              </div>
            ))}
            {!readOnly && <Upload showUploadList={false} beforeUpload={(file) => { if (!isAllowedWorkflowFile(file.name)) { message.error(workflowFileRejectionMessage); return Upload.LIST_IGNORE; } void onUpload(file, FILE_KIND).catch(() => message.error('Не удалось приложить файл')); return Upload.LIST_IGNORE; }}><Button type="dashed" icon={<PlusOutlined />}>Добавить версию</Button></Upload>}
          </div>
        </div>
      </div>
      <StageTaskChecklist
        readOnly={readOnly}
        system={[
          { id: 'carrier', label: 'Носитель на месте', done: hasCarrier, required: true },
          { id: 'signal', label: 'Можно закрыть успешно', done: plan.enabled && plan.mode === 'success', required: draft.status !== 'failed' },
          { id: 'comment', label: 'Комментарий указан', done: draft.comment.trim().length > 0, required: commentNeeded },
        ]}
        custom={customRows}
        onAdd={(label) => { const id = nextCustomId(); setDraft((current) => ({ ...current, custom: [...current.custom, { id, label, done: false }], order: [...current.order, id] })); }}
        onReorder={(order) => setDraft((current) => ({ ...current, order }))}
        onToggle={(id) => setDraft((current) => ({ ...current, custom: current.custom.map((row) => row.id === id ? { ...row, done: !row.done } : row) }))}
        onDelete={(id) => setDraft((current) => ({ ...current, custom: current.custom.filter((row) => row.id !== id), order: current.order.filter((item) => item !== id) }))}
        onRename={(id, label) => setDraft((current) => ({ ...current, custom: current.custom.map((row) => row.id === id ? { ...row, label } : row) }))}
      />
    </div>
  );
};

export default ClassesRunningStage;
