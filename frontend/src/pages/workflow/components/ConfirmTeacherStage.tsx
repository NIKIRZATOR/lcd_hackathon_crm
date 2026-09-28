import { DeleteOutlined, DownloadOutlined, FileImageOutlined, FileOutlined, FilePdfOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Input, Select, Upload, message } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useRef, useState } from 'react';

import { apiDownload, apiRequest } from '../../../api/client';
import { roleLabel } from '../../organizations/screenModel';
import type { DeskChecklistItem, DeskFile } from '../api';
import { loadStageFacts } from '../api';
import { loadSiteContacts, pickResponsible, type SiteContact } from '../contactSearch';
import {
  CONFIRM_TEACHER_SLA_DAYS,
  confirmChecks,
  confirmClosePlan,
  emptyConfirmDraft,
  parseConfirmDraft,
  qualificationOpen,
  serializeConfirmDraft,
  type ConfirmDraft,
} from '../confirmTeacher';
import { stageDeadline } from '../firstMeeting';
import { CERTIFICATE_KIND } from '../trainTeacher';
import { isAllowedWorkflowFile, workflowFileRejectionMessage } from '../workflowFiles';

import tileStyles from './ContactSearchStage.module.scss';
import formStyles from './FirstMeetingStage.module.scss';
import StageFactTiles from './StageFactTiles';
import StageTaskChecklist from './StageTaskChecklist';

type ConfirmTeacherStageProps = {
  stageId: string;
  programId: string;
  organizationId: string;
  productName: string;
  trainStageId: string | null;
  programWindowId: string | null;
  dueAt: string | null;
  ready: boolean;
  items: DeskChecklistItem[];
  files: DeskFile[];
  fallbackPeople: Array<{ id: string; name: string; role: string; roleCode: string }>;
  readOnly: boolean;
  onCommit: (item: DeskChecklistItem, patch: Record<string, unknown>) => void;
  onPlan: (plan: ReturnType<typeof confirmClosePlan>) => void;
  onUpload: (file: File, kind: string | null) => Promise<DeskFile | void>;
  onDeleteFile: (file: DeskFile) => Promise<void>;
};

type CarrierRow = { id: string; product_id: string; program_instance_id?: string | null; stakeholder_id?: string | null; full_name: string; status: string; trained_on?: string | null; qualification_until?: string | null };
type AcademicWindow = { id: string; title: string };

const MARK_KIND = 'site_mark';
const nextCustomId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? `custom-${crypto.randomUUID()}` : `custom-${Date.now()}`);
const fileIcon = (name: string) => {
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  if (extension === 'pdf') return { Icon: FilePdfOutlined, pdf: true };
  if (['png', 'jpg', 'jpeg'].includes(extension)) return { Icon: FileImageOutlined, pdf: false };
  return { Icon: FileOutlined, pdf: false };
};
const downloadBlob = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
};
const statusLabel = (status: string | null) => status === 'active' ? 'Ведёт' : status === 'trained' ? 'Обучен' : status === 'left' ? 'Ушёл' : status === 'planned' ? 'К обучению' : 'Не указан';

const ConfirmTeacherStage = ({
  stageId, programId, organizationId, productName, trainStageId, programWindowId, dueAt, ready, items, files, fallbackPeople, readOnly, onCommit, onPlan, onUpload, onDeleteFile,
}: ConfirmTeacherStageProps) => {
  const gap = organizationId.startsWith('gap-') || stageId.startsWith('gap-');
  const [contacts, setContacts] = useState<SiteContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [carrier, setCarrier] = useState<CarrierRow | null>(null);
  const [certificate, setCertificate] = useState<DeskFile | null>(null);
  const [access, setAccess] = useState('');
  const [windows, setWindows] = useState<AcademicWindow[]>([]);
  const [draft, setDraft] = useState<ConfirmDraft>(emptyConfirmDraft());
  const [draftReady, setDraftReady] = useState(false);
  const savedSignature = useRef('');
  const onCommitRef = useRef(onCommit);
  const onPlanRef = useRef(onPlan);
  const fallbackRef = useRef(fallbackPeople);
  onCommitRef.current = onCommit;
  onPlanRef.current = onPlan;
  fallbackRef.current = fallbackPeople;

  const readyItem = () => items.find((item) => item.code === 'teacher_ready' || item.label.toLowerCase().includes('готовност')) ?? null;

  useEffect(() => {
    let cancelled = false;
    setContactsLoading(true);
    if (gap) {
      setContacts(fallbackRef.current.map((person, index) => ({
        id: person.id, name: person.name, roleCode: person.roleCode || 'other', position: '', email: '', phone: '', primary: index === 0, active: true,
      })));
      setContactsLoading(false);
      return () => { cancelled = true; };
    }
    loadSiteContacts(organizationId)
      .then((loaded) => { if (!cancelled) setContacts(loaded); })
      .catch(() => { if (!cancelled) message.error('Не удалось прочитать контакты площадки'); })
      .finally(() => { if (!cancelled) setContactsLoading(false); });
    apiRequest<{ product_id?: string }>(`/api/program-instances/${programId}`)
      .then(async (program) => {
        if (cancelled || !program.product_id) return;
        const rows = await apiRequest<CarrierRow[]>(`/api/organizations/${organizationId}/teachers`).catch(() => []);
        const own = rows.filter((row) => row.product_id === program.product_id);
        const picked = own.find((row) => row.program_instance_id === programId) ?? own.find((row) => row.status === 'active') ?? own[0] ?? null;
        if (!cancelled) setCarrier(picked);
      })
      .catch(() => undefined);
    apiRequest<{ product_access?: string | null } | null>(`/api/program-instances/${programId}/license`)
      .then((row) => { if (!cancelled) setAccess(row?.product_access?.trim() ?? ''); })
      .catch(() => { if (!cancelled) setAccess(''); });
    apiRequest<AcademicWindow[]>('/api/academic-windows')
      .then((rows) => { if (!cancelled) setWindows(rows); })
      .catch(() => { if (!cancelled) setWindows([]); });
    return () => { cancelled = true; };
  }, [gap, organizationId, programId]);

  useEffect(() => {
    if (!trainStageId || trainStageId.startsWith('gap-')) return;
    let cancelled = false;
    loadStageFacts(trainStageId)
      .then((facts) => { if (!cancelled) setCertificate(facts.files.filter((file) => file.kind === CERTIFICATE_KIND).at(-1) ?? null); })
      .catch(() => { if (!cancelled) setCertificate(null); });
    return () => { cancelled = true; };
  }, [trainStageId]);

  useEffect(() => {
    if (!ready || draftReady) return;
    const saved = parseConfirmDraft(readyItem()?.valueText);
    setDraft({ ...saved, windowId: saved.windowId ?? programWindowId });
    setDraftReady(true);
  }, [ready, draftReady, items, programWindowId]);

  const marks = files.filter((file) => file.kind === MARK_KIND);
  const responsible = pickResponsible(contacts, null);
  const pending = !ready || !draftReady || contactsLoading;
  const deadline = stageDeadline(dueAt, CONFIRM_TEACHER_SLA_DAYS, dayjs());
  const today = dayjs().format('YYYY-MM-DD');
  const plan = confirmClosePlan({
    ready: draft.ready, windowId: draft.windowId, hasCarrier: Boolean(carrier), status: carrier?.status ?? null, qualificationUntil: carrier?.qualification_until ?? null, today,
  });
  const done = {
    carrier: Boolean(carrier),
    active: carrier?.status === 'active',
    qualification: Boolean(carrier) && carrier?.status !== 'left' && qualificationOpen(carrier?.qualification_until ?? null, today),
    ready: draft.ready === 'yes',
    window: Boolean(draft.windowId),
  };
  const signature = `${serializeConfirmDraft(draft)}|${plan.enabled}`;
  const programWindow = windows.find((item) => item.id === programWindowId)?.title ?? '';

  useEffect(() => {
    if (pending) return;
    onPlanRef.current(plan);
    const handle = window.setTimeout(() => {
      if (savedSignature.current === signature) return;
      savedSignature.current = signature;
      const item = readyItem();
      if (item) onCommitRef.current(item, { value_text: serializeConfirmDraft(draft), value_date: null, stakeholder_id: carrier?.stakeholder_id ?? null, attachment_id: null, is_done: plan.enabled, keepLocal: true });
    }, 400);
    return () => window.clearTimeout(handle);
  }, [pending, signature, plan, draft, carrier, items]);

  const customRows = draft.order.flatMap((id) => {
    const item = draft.custom.find((row) => row.id === id);
    return item ? [item] : [];
  });
  const trained = carrier?.trained_on ? dayjs(carrier.trained_on) : null;
  const until = carrier?.qualification_until ? dayjs(carrier.qualification_until) : null;

  return (
    <div className={tileStyles.root}>
      <StageFactTiles
        tiles={[
          { kind: 'person', label: 'Ответственный', value: responsible?.name ?? '', empty: 'Ответственный не найден', hint: responsible ? roleLabel(responsible.roleCode) : undefined, pending },
          { kind: 'phone', label: 'Телефон', value: responsible?.phone ?? '', empty: 'Телефон не найден', pending },
          { kind: 'mail', label: 'Почта', value: responsible?.email ?? '', empty: 'Почта не найдена', pending },
          { kind: 'due', label: 'Срок', value: deadline.date.format('D MMMM YYYY'), hint: `${deadline.caption} · ${deadline.origin}`, dueState: deadline.daysLeft < 0 ? 'late' : deadline.daysLeft === 0 ? 'today' : 'ok' },
        ]}
      >
      <div className={tileStyles.vendorRow}>
        <div className={tileStyles.vendorHalf}><span className={tileStyles.tileLabel}>Преподаватель</span><strong className={tileStyles.tileValue}>{carrier?.full_name || 'Носитель не найден'}</strong></div>
        <div className={tileStyles.vendorHalf}><span className={tileStyles.tileLabel}>Продукт</span><strong className={tileStyles.tileValue}>{productName || 'Не указан'}</strong></div>
        <div className={tileStyles.vendorFoot}>
          <span>{trained?.isValid() ? `Обучение ${trained.format('D MMMM YYYY')}` : 'Дата обучения не указана'}</span>
          <span>{until?.isValid() ? `Квалификация до ${until.format('D MMMM YYYY')}` : 'Срок квалификации не указан'}</span>
          <span>{statusLabel(carrier?.status ?? null)}</span>
          {certificate && <Button type="link" onClick={() => void apiDownload(`/api/workflows/attachments/${certificate.id}/download`).then((blob) => downloadBlob(blob, certificate.name))}>Сертификат</Button>}
        </div>
      </div>
      </StageFactTiles>
      <p className={formStyles.context}>{access ? `Доступ: ${access}` : 'Доступ не передан'}{programWindow ? ` · Окно захода: ${programWindow}` : ''}</p>
      <div className={formStyles.fields}>
        <label className={formStyles.field}>
          <span>Готовность вести</span>
          <Select allowClear placeholder="Выберите" disabled={readOnly || pending} value={draft.ready ?? undefined} options={[{ value: 'yes', label: 'Да' }, { value: 'no', label: 'Нет' }]} onChange={(value) => setDraft((current) => ({ ...current, ready: value ?? null }))} />
        </label>
        {draft.ready === 'no' && (
          <label className={formStyles.field}><span>Причина</span><Input disabled={readOnly || pending} value={draft.reason} onChange={(event) => setDraft((current) => ({ ...current, reason: event.target.value }))} /></label>
        )}
        <label className={formStyles.field}>
          <span>Окно</span>
          <Select allowClear showSearch optionFilterProp="label" placeholder="Учебное окно" disabled={readOnly || pending} value={draft.windowId ?? undefined} options={windows.map((item) => ({ value: item.id, label: item.title }))} onChange={(value) => setDraft((current) => ({ ...current, windowId: value ?? null }))} />
        </label>
        <div className={formStyles.field}>
          <span>Отметка площадки</span>
          <div className={formStyles.fileSlot}>
            {marks.map((file, index) => {
              const { Icon, pdf } = fileIcon(file.name);
              return (
                <div key={file.id} className={formStyles.fileCard}>
                  <span className={`${formStyles.fileMark} ${pdf ? formStyles.fileMarkPdf : ''}`} aria-hidden="true"><Icon /></span>
                  <span className={formStyles.fileName} title={file.name}>{file.name}</span>
                  <span className={formStyles.fileMeta}>{index === marks.length - 1 ? 'текущая версия' : `версия ${index + 1}`}</span>
                  <span className={formStyles.fileActions}>
                    <Button type="text" aria-label="Скачать" icon={<DownloadOutlined />} onClick={() => void apiDownload(`/api/workflows/attachments/${file.id}/download`).then((blob) => downloadBlob(blob, file.name))} />
                    {!readOnly && <Button type="text" danger aria-label="Удалить файл" icon={<DeleteOutlined />} onClick={() => void onDeleteFile(file)} />}
                  </span>
                </div>
              );
            })}
            {!readOnly && (
              <Upload accept=".png,.jpeg,.jpg,.pdf,.zip,.gz,.gzip,.rar,.doc,.docx,.xls,.xlsx" showUploadList={false} beforeUpload={(file) => {
                if (!isAllowedWorkflowFile(file.name)) { message.error(workflowFileRejectionMessage); return Upload.LIST_IGNORE; }
                void onUpload(file, MARK_KIND).catch(() => message.error('Не удалось приложить файл'));
                return Upload.LIST_IGNORE;
              }}
              >
                <Button type="dashed" icon={<PlusOutlined />}>Добавить версию</Button>
              </Upload>
            )}
          </div>
        </div>
      </div>
      <StageTaskChecklist
        readOnly={readOnly}
        system={confirmChecks.map((item) => ({ id: item.id, label: item.label, done: done[item.id], required: true }))}
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

export default ConfirmTeacherStage;
