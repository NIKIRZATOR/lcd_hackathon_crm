import { DeleteOutlined, DownloadOutlined, FileImageOutlined, FileOutlined, FilePdfOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Input, Select, Upload, message } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useRef, useState } from 'react';

import { apiDownload, apiRequest } from '../../../api/client';
import { roleLabel } from '../../organizations/screenModel';
import type { DeskChecklistItem, DeskFile } from '../api';
import { loadSiteContacts, pickResponsible, type SiteContact } from '../contactSearch';
import {
  CURRICULUM_NOTE_MIN,
  CURRICULUM_SLA_DAYS,
  PLAN_FILE_KIND,
  curriculumChecks,
  curriculumClosePlan,
  emptyCurriculumDraft,
  parseCurriculumDraft,
  serializeCurriculumDraft,
  type CurriculumDraft,
} from '../curriculum';
import { stageDeadline } from '../firstMeeting';
import { isAllowedWorkflowFile, workflowFileRejectionMessage } from '../workflowFiles';

import tileStyles from './ContactSearchStage.module.scss';
import formStyles from './FirstMeetingStage.module.scss';
import StageFactTiles from './StageFactTiles';
import StageTaskChecklist from './StageTaskChecklist';

type CurriculumStageProps = {
  stageId: string;
  programId: string;
  organizationId: string;
  productName: string;
  programWindowId: string | null;
  dueAt: string | null;
  ready: boolean;
  items: DeskChecklistItem[];
  files: DeskFile[];
  fallbackPeople: Array<{ id: string; name: string; role: string; roleCode: string }>;
  readOnly: boolean;
  onCommit: (item: DeskChecklistItem, patch: Record<string, unknown>) => void;
  onPlan: (plan: ReturnType<typeof curriculumClosePlan>) => void;
  onUpload: (file: File, kind: string | null) => Promise<DeskFile | void>;
  onDeleteFile: (file: DeskFile) => Promise<void>;
};

type CarrierRow = { product_id: string; program_instance_id?: string | null; full_name: string; status: string };
type AcademicWindow = { id: string; title: string; plan_cutoff_on: string };
type TemplateLink = { kind: string; name: string; url: string };

const MARK_KIND = 'site_mark';
const planExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx'];
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

const CurriculumStage = ({
  stageId, programId, organizationId, productName, programWindowId, dueAt, ready, items, files, fallbackPeople, readOnly, onCommit, onPlan, onUpload, onDeleteFile,
}: CurriculumStageProps) => {
  const gap = organizationId.startsWith('gap-') || stageId.startsWith('gap-');
  const [contacts, setContacts] = useState<SiteContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [carrier, setCarrier] = useState<CarrierRow | null>(null);
  const [accessReady, setAccessReady] = useState(false);
  const [accessText, setAccessText] = useState('');
  const [windows, setWindows] = useState<AcademicWindow[]>([]);
  const [templateUrl, setTemplateUrl] = useState<string | null>(null);
  const [draft, setDraft] = useState<CurriculumDraft>(emptyCurriculumDraft());
  const [draftReady, setDraftReady] = useState(false);
  const savedSignature = useRef('');
  const onCommitRef = useRef(onCommit);
  const onPlanRef = useRef(onPlan);
  const fallbackRef = useRef(fallbackPeople);
  onCommitRef.current = onCommit;
  onPlanRef.current = onPlan;
  fallbackRef.current = fallbackPeople;

  const fact = () => items.find((item) => item.code === 'curriculum' || item.label.toLowerCase().includes('учебный план')) ?? null;

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
        if (!cancelled) setCarrier(own.find((row) => row.program_instance_id === programId && row.status === 'active') ?? own.find((row) => row.status === 'active') ?? null);
      })
      .catch(() => undefined);
    apiRequest<{ product_access?: string | null; transfer_status?: string | null } | null>(`/api/program-instances/${programId}/license`)
      .then((row) => {
        if (cancelled) return;
        setAccessText(row?.product_access?.trim() ?? '');
        setAccessReady(Boolean(row?.product_access?.trim()) || row?.transfer_status === 'transferred');
      })
      .catch(() => { if (!cancelled) setAccessReady(false); });
    apiRequest<AcademicWindow[]>('/api/academic-windows')
      .then((rows) => { if (!cancelled) setWindows(rows); })
      .catch(() => { if (!cancelled) setWindows([]); });
    apiRequest<TemplateLink[]>('/api/document-templates')
      .then((rows) => { if (!cancelled) setTemplateUrl(rows.find((item) => item.kind === PLAN_FILE_KIND)?.url ?? null); })
      .catch(() => { if (!cancelled) setTemplateUrl(null); });
    return () => { cancelled = true; };
  }, [gap, organizationId, programId]);

  useEffect(() => {
    if (!ready || draftReady) return;
    const saved = parseCurriculumDraft(fact()?.valueText);
    setDraft({ ...saved, windowId: saved.windowId ?? programWindowId });
    setDraftReady(true);
  }, [ready, draftReady, items, programWindowId]);

  const plans = files.filter((file) => file.kind === PLAN_FILE_KIND);
  const marks = files.filter((file) => file.kind === MARK_KIND);
  const latestPlan = plans.at(-1) ?? null;
  const responsible = pickResponsible(contacts, null);
  const pending = !ready || !draftReady || contactsLoading;
  const cutoff = windows.find((item) => item.id === draft.windowId)?.plan_cutoff_on ?? null;
  const deadline = stageDeadline(cutoff ?? dueAt, CURRICULUM_SLA_DAYS, dayjs());
  const plan = curriculumClosePlan({
    carrierActive: carrier?.status === 'active', accessReady, hasPlan: Boolean(latestPlan), comment: draft.comment, windowId: draft.windowId,
  });
  const done = {
    carrier: carrier?.status === 'active',
    access: accessReady,
    plan: Boolean(latestPlan) || draft.comment.trim().length >= CURRICULUM_NOTE_MIN,
    window: Boolean(draft.windowId),
  };
  const signature = `${serializeCurriculumDraft(draft)}|${latestPlan?.fileId ?? ''}|${plan.enabled}`;

  useEffect(() => {
    if (pending) return;
    onPlanRef.current(plan);
    const handle = window.setTimeout(() => {
      if (savedSignature.current === signature) return;
      savedSignature.current = signature;
      const item = fact();
      if (item) onCommitRef.current(item, { value_text: serializeCurriculumDraft(draft), value_date: null, attachment_id: null, is_done: plan.enabled, keepLocal: true });
    }, 400);
    return () => window.clearTimeout(handle);
  }, [pending, signature, plan, draft, items]);

  const customRows = draft.order.flatMap((id) => {
    const item = draft.custom.find((row) => row.id === id);
    return item ? [item] : [];
  });
  const upload = (kind: string, limited: boolean) => (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (limited ? !planExtensions.includes(extension) : !isAllowedWorkflowFile(file.name)) {
      message.error(limited ? 'Для плана подойдут pdf, doc, docx, xls, xlsx' : workflowFileRejectionMessage);
      return Upload.LIST_IGNORE;
    }
    void onUpload(file, kind).catch(() => message.error('Не удалось приложить файл'));
    return Upload.LIST_IGNORE;
  };
  const fileRow = (file: DeskFile, index: number, total: number) => {
    const { Icon, pdf } = fileIcon(file.name);
    return (
      <div key={file.id} className={formStyles.fileCard}>
        <span className={`${formStyles.fileMark} ${pdf ? formStyles.fileMarkPdf : ''}`} aria-hidden="true"><Icon /></span>
        <span className={formStyles.fileName} title={file.name}>{file.name}</span>
        <span className={formStyles.fileMeta}>{index === total - 1 ? 'текущая версия' : `версия ${index + 1}`}</span>
        <span className={formStyles.fileActions}>
          <Button type="text" aria-label="Скачать" icon={<DownloadOutlined />} onClick={() => void apiDownload(`/api/workflows/attachments/${file.id}/download`).then((blob) => downloadBlob(blob, file.name))} />
          {!readOnly && <Button type="text" danger aria-label="Удалить файл" icon={<DeleteOutlined />} onClick={() => void onDeleteFile(file)} />}
        </span>
      </div>
    );
  };

  return (
    <div className={tileStyles.root}>
      <StageFactTiles
        tiles={[
          { kind: 'person', label: 'Ответственный', value: responsible?.name ?? '', empty: 'Ответственный не найден', hint: responsible ? roleLabel(responsible.roleCode) : undefined, pending },
          { kind: 'phone', label: 'Телефон', value: responsible?.phone ?? '', empty: 'Телефон не найден', pending },
          { kind: 'mail', label: 'Почта', value: responsible?.email ?? '', empty: 'Почта не найдена', pending },
          { kind: 'due', label: 'Срок', value: deadline.date.format('D MMMM YYYY'), hint: `${deadline.caption} · ${cutoff ? 'отсечение плана' : deadline.origin}`, dueState: deadline.daysLeft < 0 ? 'late' : deadline.daysLeft === 0 ? 'today' : 'ok' },
        ]}
      >
        <div className={tileStyles.vendorRow}>
          <div className={tileStyles.vendorHalf}><span className={tileStyles.tileLabel}>Преподаватель</span><strong className={tileStyles.tileValue}>{carrier?.full_name || 'Носитель не найден'}</strong></div>
          <div className={tileStyles.vendorHalf}><span className={tileStyles.tileLabel}>Продукт</span><strong className={tileStyles.tileValue}>{productName || 'Не указан'}</strong></div>
          <div className={tileStyles.vendorFoot}>
            <span>{carrier?.status === 'active' ? 'Ведёт' : 'Не ведёт'}</span>
            <span>{accessReady ? (accessText || 'Доступ передан') : 'Доступ не передан'}</span>
          </div>
        </div>
      </StageFactTiles>
      <div className={formStyles.fields}>
        <label className={formStyles.field}>
          <span>Учебное окно</span>
          <Select allowClear showSearch optionFilterProp="label" placeholder="Окно захода" disabled={readOnly || pending} value={draft.windowId ?? undefined} options={windows.map((item) => ({ value: item.id, label: item.title }))} onChange={(value) => setDraft((current) => ({ ...current, windowId: value ?? null }))} />
        </label>
        <div className={formStyles.field}>
          <span>План</span>
          <div className={formStyles.fileSlot}>
            {plans.map((file, index) => fileRow(file, index, plans.length))}
            {!readOnly && <Upload accept=".pdf,.doc,.docx,.xls,.xlsx" showUploadList={false} beforeUpload={upload(PLAN_FILE_KIND, true)}><Button type="dashed" icon={<PlusOutlined />}>Добавить версию</Button></Upload>}
            {templateUrl && <Button type="link" href={templateUrl} target="_blank" rel="noreferrer">Скачать шаблон</Button>}
          </div>
        </div>
        <label className={formStyles.field}>
          <span>Комментарий согласования</span>
          <Input.TextArea disabled={readOnly || pending} autoSize={{ minRows: 3, maxRows: 6 }} value={draft.comment} placeholder={latestPlan ? 'необязательно' : `не короче ${CURRICULUM_NOTE_MIN} знаков, если плана нет`} onChange={(event) => setDraft((current) => ({ ...current, comment: event.target.value }))} />
        </label>
        <div className={formStyles.field}>
          <span>Отметка площадки</span>
          <div className={formStyles.fileSlot}>
            {marks.map((file, index) => fileRow(file, index, marks.length))}
            {!readOnly && <Upload accept=".png,.jpeg,.jpg,.pdf,.zip,.gz,.gzip,.rar,.doc,.docx,.xls,.xlsx" showUploadList={false} beforeUpload={upload(MARK_KIND, false)}><Button type="dashed" icon={<PlusOutlined />}>Добавить версию</Button></Upload>}
          </div>
        </div>
      </div>
      <StageTaskChecklist
        readOnly={readOnly}
        system={curriculumChecks.map((item) => ({ id: item.id, label: item.label, done: done[item.id], required: item.required }))}
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

export default CurriculumStage;
