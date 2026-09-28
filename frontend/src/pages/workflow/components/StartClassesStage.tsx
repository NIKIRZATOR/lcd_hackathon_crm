import { DeleteOutlined, DownloadOutlined, FileOutlined, FilePdfOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, DatePicker, Input, Upload, message } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useRef, useState } from 'react';

import { apiDownload, apiRequest } from '../../../api/client';
import { roleLabel } from '../../organizations/screenModel';
import type { DeskChecklistItem, DeskFile } from '../api';
import { loadSiteContacts, pickResponsible, type SiteContact } from '../stages/contactSearch';
import { stageDeadline } from '../stages/firstMeeting';
import {
  START_CLASSES_SLA_DAYS,
  START_SHIFT_DAYS,
  emptyStartDraft,
  parseStartDraft,
  serializeStartDraft,
  startChecks,
  startClosePlan,
  type StartDraft,
} from '../stages/startClasses';
import { isAllowedWorkflowFile, workflowFileRejectionMessage } from '../shared/workflowFiles';

import tileStyles from './ContactSearchStage.module.scss';
import formStyles from './FirstMeetingStage.module.scss';
import StageFactTiles from './StageFactTiles';
import StageTaskChecklist from './StageTaskChecklist';

type StartClassesStageProps = {
  stageId: string;
  programId: string;
  organizationId: string;
  productName: string;
  programWindowId: string | null;
  planClosed: boolean;
  dueAt: string | null;
  ready: boolean;
  items: DeskChecklistItem[];
  files: DeskFile[];
  fallbackPeople: Array<{ id: string; name: string; role: string; roleCode: string }>;
  readOnly: boolean;
  onCommit: (item: DeskChecklistItem, patch: Record<string, unknown>) => void;
  onPlan: (plan: ReturnType<typeof startClosePlan>) => void;
  onUpload: (file: File, kind: string | null) => Promise<DeskFile | void>;
  onDeleteFile: (file: DeskFile) => Promise<void>;
};

type CarrierRow = { product_id: string; program_instance_id?: string | null; full_name: string; status: string };
type Metrics = { students_count?: number; last_lms_signal_at?: string | null; last_website_signal_at?: string | null } | null;
const FILE_KIND = 'schedule';
const nextCustomId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? `custom-${crypto.randomUUID()}` : `custom-${Date.now()}`);
const downloadBlob = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
};

const StartClassesStage = ({
  stageId, programId, organizationId, productName, programWindowId, planClosed, dueAt, ready, items, files, fallbackPeople, readOnly, onCommit, onPlan, onUpload, onDeleteFile,
}: StartClassesStageProps) => {
  const gap = organizationId.startsWith('gap-') || stageId.startsWith('gap-');
  const [contacts, setContacts] = useState<SiteContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [carrier, setCarrier] = useState<CarrierRow | null>(null);
  const [accessReady, setAccessReady] = useState(false);
  const [accessText, setAccessText] = useState('');
  const [windowStart, setWindowStart] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Metrics>(null);
  const [startedOn, setStartedOn] = useState<string | null>(null);
  const [draft, setDraft] = useState<StartDraft>(emptyStartDraft());
  const [draftReady, setDraftReady] = useState(false);
  const savedSignature = useRef('');
  const onCommitRef = useRef(onCommit);
  const onPlanRef = useRef(onPlan);
  const fallbackRef = useRef(fallbackPeople);
  onCommitRef.current = onCommit;
  onPlanRef.current = onPlan;
  fallbackRef.current = fallbackPeople;

  const dateItem = () => items.find((item) => item.code === 'classes_started_on' || item.itemType === 'date') ?? null;
  const textItem = () => items.find((item) => item.code === 'classes_started' || item.label.toLowerCase().includes('подтверждение')) ?? null;

  useEffect(() => {
    let cancelled = false;
    setContactsLoading(true);
    if (gap) {
      setContacts(fallbackRef.current.map((person, index) => ({ id: person.id, name: person.name, roleCode: person.roleCode || 'other', position: '', email: '', phone: '', primary: index === 0, active: true })));
      setContactsLoading(false);
      return () => { cancelled = true; };
    }
    loadSiteContacts(organizationId).then((loaded) => { if (!cancelled) setContacts(loaded); }).catch(() => { if (!cancelled) message.error('Не удалось прочитать контакты площадки'); }).finally(() => { if (!cancelled) setContactsLoading(false); });
    apiRequest<{ product_id?: string }>(`/api/program-instances/${programId}`).then(async (program) => {
      if (cancelled || !program.product_id) return;
      const rows = await apiRequest<CarrierRow[]>(`/api/organizations/${organizationId}/teachers`).catch(() => []);
      const own = rows.filter((row) => row.product_id === program.product_id);
      if (!cancelled) setCarrier(own.find((row) => row.program_instance_id === programId && row.status === 'active') ?? own.find((row) => row.status === 'active') ?? null);
    }).catch(() => undefined);
    apiRequest<{ product_access?: string | null; transfer_status?: string | null } | null>(`/api/program-instances/${programId}/license`).then((row) => {
      if (cancelled) return;
      setAccessText(row?.product_access?.trim() ?? '');
      setAccessReady(Boolean(row?.product_access?.trim()) || row?.transfer_status === 'transferred');
    }).catch(() => { if (!cancelled) setAccessReady(false); });
    apiRequest<Array<{ id: string; classes_start_on: string }>>('/api/academic-windows').then((rows) => {
      if (!cancelled) setWindowStart(rows.find((item) => item.id === programWindowId)?.classes_start_on ?? null);
    }).catch(() => undefined);
    apiRequest<Metrics>(`/api/integrations/program-instances/${programId}/metrics`).then((row) => { if (!cancelled) setMetrics(row); }).catch(() => { if (!cancelled) setMetrics(null); });
    return () => { cancelled = true; };
  }, [gap, organizationId, programId, programWindowId]);

  useEffect(() => {
    if (!ready || draftReady) return;
    setDraft(parseStartDraft(textItem()?.valueText));
    setStartedOn(dateItem()?.valueDate ?? null);
    setDraftReady(true);
  }, [ready, draftReady, items]);

  useEffect(() => {
    if (!draftReady || startedOn || !windowStart) return;
    setStartedOn(windowStart.slice(0, 10));
  }, [draftReady, startedOn, windowStart]);

  const signalAt = metrics?.last_lms_signal_at ?? metrics?.last_website_signal_at ?? null;
  const students = metrics?.students_count ?? null;
  const shift = startedOn && windowStart ? Math.abs(dayjs(startedOn).startOf('day').diff(dayjs(windowStart).startOf('day'), 'day')) : 0;
  const lmsGap = Boolean(signalAt && startedOn && Math.abs(dayjs(startedOn).startOf('day').diff(dayjs(signalAt).startOf('day'), 'day')) > START_SHIFT_DAYS);
  const lmsEmpty = students === null || students === 0 || !signalAt;
  const commentRequired = shift > START_SHIFT_DAYS || lmsGap || lmsEmpty;
  const proofs = files.filter((file) => file.kind === FILE_KIND);
  const responsible = pickResponsible(contacts, null);
  const pending = !ready || !draftReady || contactsLoading;
  const deadline = stageDeadline(dueAt, START_CLASSES_SLA_DAYS, dayjs());
  const plan = startClosePlan({ carrierActive: carrier?.status === 'active', accessReady, planClosed, startedOn, confirmed: draft.confirmed, comment: draft.comment, commentRequired });
  const done = { carrier: carrier?.status === 'active', access: accessReady, plan: planClosed, date: Boolean(startedOn), confirmed: draft.confirmed };
  const signature = `${serializeStartDraft(draft)}|${startedOn ?? ''}|${plan.enabled}`;

  useEffect(() => {
    if (pending) return;
    onPlanRef.current(plan);
    const handle = window.setTimeout(() => {
      if (savedSignature.current === signature) return;
      savedSignature.current = signature;
      const date = dateItem();
      const text = textItem();
      if (date) onCommitRef.current(date, { value_text: null, value_date: startedOn, is_done: plan.enabled, keepLocal: true });
      if (text) onCommitRef.current(text, { value_text: serializeStartDraft(draft), value_date: null, is_done: plan.enabled, keepLocal: true });
    }, 400);
    return () => window.clearTimeout(handle);
  }, [pending, signature, plan, draft, startedOn, items]);

  const customRows = draft.order.flatMap((id) => draft.custom.filter((row) => row.id === id));

  return (
    <div className={tileStyles.root}>
      <StageFactTiles tiles={[
        { kind: 'person', label: 'Ответственный', value: responsible?.name ?? '', empty: 'Ответственный не найден', hint: responsible ? roleLabel(responsible.roleCode) : undefined, pending },
        { kind: 'phone', label: 'Телефон', value: responsible?.phone ?? '', empty: 'Телефон не найден', pending },
        { kind: 'mail', label: 'Почта', value: responsible?.email ?? '', empty: 'Почта не найдена', pending },
        { kind: 'due', label: 'Срок', value: deadline.date.format('D MMMM YYYY'), hint: `${deadline.caption} · ${deadline.origin}`, dueState: deadline.daysLeft < 0 ? 'late' : deadline.daysLeft === 0 ? 'today' : 'ok' },
      ]}>
        <div className={tileStyles.vendorRow}>
          <div className={tileStyles.vendorHalf}><span className={tileStyles.tileLabel}>Преподаватель</span><strong className={tileStyles.tileValue}>{carrier?.full_name || 'Носитель не найден'}</strong></div>
          <div className={tileStyles.vendorHalf}><span className={tileStyles.tileLabel}>Продукт</span><strong className={tileStyles.tileValue}>{productName || 'Не указан'}</strong></div>
          <div className={tileStyles.vendorFoot}>
            <span>{carrier?.status === 'active' ? 'Ведёт' : 'Не ведёт'}</span>
            <span>{accessReady ? (accessText || 'Доступ передан') : 'Доступ не передан'}</span>
            <span>{planClosed ? 'План закрыт' : 'План не закрыт'}</span>
          </div>
        </div>
      </StageFactTiles>
      <div className={formStyles.fields}>
        <label className={formStyles.field}>
          <span>Дата старта</span>
          <DatePicker disabled={readOnly || pending} format="D MMMM YYYY" value={startedOn ? dayjs(startedOn) : null} onChange={(value) => setStartedOn(value ? value.format('YYYY-MM-DD') : null)} />
        </label>
        <div className={formStyles.field}>
          <Button type={draft.confirmed ? 'primary' : 'default'} disabled={readOnly || pending} onClick={() => setDraft((current) => ({ ...current, confirmed: !current.confirmed }))}>Подтвердить, что занятия начались</Button>
        </div>
        <label className={formStyles.field}>
          <span>Комментарий</span>
          <Input.TextArea disabled={readOnly || pending} autoSize={{ minRows: 2, maxRows: 5 }} value={draft.comment} placeholder={commentRequired ? 'нужен: дата сдвинута больше чем на 7 дней или сигнал LMS не сходится' : 'необязательно'} onChange={(event) => setDraft((current) => ({ ...current, comment: event.target.value }))} />
        </label>
        <div className={formStyles.field}>
          <span>Расписание или скрин</span>
          <div className={formStyles.fileSlot}>
            {proofs.map((file, index) => (
              <div key={file.id} className={formStyles.fileCard}>
                <span className={`${formStyles.fileMark} ${file.name.toLowerCase().endsWith('.pdf') ? formStyles.fileMarkPdf : ''}`} aria-hidden="true">{file.name.toLowerCase().endsWith('.pdf') ? <FilePdfOutlined /> : <FileOutlined />}</span>
                <span className={formStyles.fileName}>{file.name}</span>
                <span className={formStyles.fileMeta}>{index === proofs.length - 1 ? 'текущая версия' : `версия ${index + 1}`}</span>
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
        system={[...startChecks.map((item) => ({ id: item.id, label: item.label, done: done[item.id], required: true })), ...(commentRequired ? [{ id: 'comment', label: 'Комментарий к сдвигу или сигналу', done: draft.comment.trim().length > 0, required: true }] : [])]}
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

export default StartClassesStage;
