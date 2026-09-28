import { CopyOutlined, DeleteOutlined, DownloadOutlined, FileImageOutlined, FileOutlined, FilePdfOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, DatePicker, Select, Upload, message } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useRef, useState } from 'react';

import { apiDownload, apiRequest } from '../../../api/client';
import { createStakeholder } from '../../organizations/api';
import { roleLabel } from '../../organizations/screenModel';
import type { DeskChecklistItem, DeskFile } from '../api';
import { loadSiteContacts, pickResponsible, type SiteContact } from '../contactSearch';
import { stageDeadline } from '../firstMeeting';
import {
  CERTIFICATE_KIND,
  TRAIN_TEACHER_SLA_DAYS,
  carrierStatuses,
  emptyTrainDraft,
  parseTrainDraft,
  serializeTrainDraft,
  trainChecks,
  trainClosePlan,
  trainFormats,
  type CarrierStatus,
  type TrainDraft,
  type TrainFormat,
} from '../trainTeacher';
import { isAllowedWorkflowFile, workflowFileRejectionMessage } from '../workflowFiles';

import tileStyles from './ContactSearchStage.module.scss';
import formStyles from './FirstMeetingStage.module.scss';
import SiteContactModal, { type SiteContactFormValues } from './SiteContactModal';
import StageFactTiles from './StageFactTiles';
import StageTaskChecklist from './StageTaskChecklist';

type TrainTeacherStageProps = {
  stageId: string;
  programId: string;
  organizationId: string;
  productName: string;
  dueAt: string | null;
  ready: boolean;
  items: DeskChecklistItem[];
  files: DeskFile[];
  fallbackPeople: Array<{ id: string; name: string; role: string; roleCode: string }>;
  readOnly: boolean;
  onCommit: (item: DeskChecklistItem, patch: Record<string, unknown>) => void;
  onPlan: (plan: ReturnType<typeof trainClosePlan>) => void;
  onUpload: (file: File, kind: string | null) => Promise<DeskFile | void>;
  onDeleteFile: (file: DeskFile) => Promise<void>;
};

type VendorCard = { company: string; product: string; contact: string; email: string };
type CarrierRow = { id: string; product_id: string; stakeholder_id?: string | null; full_name: string; status: string; trained_on?: string | null; qualification_until?: string | null };

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

const TrainTeacherStage = ({
  stageId, programId, organizationId, productName, dueAt, ready, items, files, fallbackPeople, readOnly, onCommit, onPlan, onUpload, onDeleteFile,
}: TrainTeacherStageProps) => {
  const gap = organizationId.startsWith('gap-') || stageId.startsWith('gap-');
  const [contacts, setContacts] = useState<SiteContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [vendor, setVendor] = useState<VendorCard>({ company: '', product: productName, contact: '', email: '' });
  const [productId, setProductId] = useState<string | null>(null);
  const [carriers, setCarriers] = useState<CarrierRow[]>([]);
  const [carrier, setCarrier] = useState<CarrierRow | null>(null);
  const [draft, setDraft] = useState<TrainDraft>(emptyTrainDraft());
  const [draftReady, setDraftReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const savedSignature = useRef('');
  const onCommitRef = useRef(onCommit);
  const onPlanRef = useRef(onPlan);
  const fallbackRef = useRef(fallbackPeople);
  onCommitRef.current = onCommit;
  onPlanRef.current = onPlan;
  fallbackRef.current = fallbackPeople;

  const teacherItem = () => items.find((item) => item.code === 'teacher' || item.itemType === 'stakeholder_role' || item.label.toLowerCase().includes('носитель') || item.label.toLowerCase().includes('преподаватель')) ?? null;
  const dateItem = () => items.find((item) => item.code === 'trained_on' || (item.itemType === 'date' && item.label.toLowerCase().includes('дата'))) ?? null;

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
        setProductId(program.product_id);
        const product = await apiRequest<{ name?: string; vendor_id?: string | null }>(`/api/it-products/${program.product_id}`);
        const company = product.vendor_id ? await apiRequest<{ name?: string }>(`/api/vendors/${product.vendor_id}`).catch(() => null) : null;
        if (!cancelled) setVendor((current) => ({ ...current, company: company?.name ?? '', product: product.name || current.product }));
        const rows = await apiRequest<CarrierRow[]>(`/api/organizations/${organizationId}/teachers`).catch(() => []);
        const known = rows.filter((row) => row.product_id === program.product_id);
        if (!cancelled) setCarriers(known);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [gap, organizationId, programId]);

  useEffect(() => {
    if (!ready || draftReady) return;
    const saved = parseTrainDraft(teacherItem()?.valueText);
    const date = dateItem()?.valueDate ?? null;
    const personId = teacherItem()?.stakeholderId ?? saved.personId;
    setDraft({ ...saved, personId, trainedOn: saved.trainedOn ?? date });
    setDraftReady(true);
  }, [ready, draftReady, items]);

  const fieldsOf = (row: CarrierRow | undefined) => {
    const status = carrierStatuses.find((item) => item.value === row?.status)?.value ?? null;
    return {
      status,
      format: status === 'trained' || status === 'active' ? 'certificate' as const : null,
      trainedOn: row?.trained_on ?? null,
      qualificationUntil: row?.qualification_until ?? null,
    };
  };

  const choosePerson = (personId: string | null) => {
    const row = carriers.find((item) => item.stakeholder_id === personId) ?? null;
    setCarrier(row);
    setDraft((current) => ({ ...current, personId, ...fieldsOf(row ?? undefined) }));
  };

  useEffect(() => {
    if (!draftReady || carriers.length === 0) return;
    if (draft.personId) {
      setCarrier(carriers.find((item) => item.stakeholder_id === draft.personId) ?? null);
      return;
    }
    const row = carriers.find((item) => item.status === 'trained' || item.status === 'active');
    if (!row?.stakeholder_id) return;
    setCarrier(row);
    setDraft((current) => current.personId ? current : { ...current, personId: row.stakeholder_id, ...fieldsOf(row) });
  }, [draftReady, carriers]);

  const certificates = files.filter((file) => file.kind === CERTIFICATE_KIND);
  const latest = certificates.at(-1) ?? null;
  const responsible = pickResponsible(contacts, null);
  const person = contacts.find((item) => item.id === draft.personId) ?? null;
  const pending = !ready || !draftReady || contactsLoading;
  const deadline = stageDeadline(dueAt, TRAIN_TEACHER_SLA_DAYS, dayjs());
  const priorCertificate = draft.format === 'certificate' && Boolean(carrier);
  const plan = trainClosePlan({
    status: draft.status, personId: draft.personId, personName: person?.name ?? carrier?.full_name ?? '', trainedOn: draft.trainedOn,
    qualificationUntil: draft.qualificationUntil, hasFile: Boolean(latest), priorCertificate, productId, carrierId: carrier?.id ?? null,
  });
  const done = {
    person: Boolean(draft.personId),
    status: draft.status === 'trained' || draft.status === 'active',
    date: Boolean(draft.trainedOn),
    proof: Boolean(latest) || priorCertificate,
  };
  const signature = `${serializeTrainDraft(draft)}|${latest?.fileId ?? ''}|${priorCertificate}|${plan.enabled}`;

  useEffect(() => {
    if (pending) return;
    onPlanRef.current(plan);
    const handle = window.setTimeout(() => {
      if (savedSignature.current === signature) return;
      savedSignature.current = signature;
      const teacher = teacherItem();
      const date = dateItem();
      if (teacher) onCommitRef.current(teacher, { value_text: serializeTrainDraft(draft), value_date: null, stakeholder_id: draft.personId, attachment_id: null, is_done: plan.enabled, keepLocal: true });
      if (date) onCommitRef.current(date, { value_text: null, value_date: draft.trainedOn, stakeholder_id: null, attachment_id: null, is_done: plan.enabled, keepLocal: true });
    }, 400);
    return () => window.clearTimeout(handle);
  }, [pending, signature, plan, draft, items]);

  const customRows = draft.order.flatMap((id) => {
    const item = draft.custom.find((row) => row.id === id);
    return item ? [item] : [];
  });

  const addPerson = async (values: SiteContactFormValues) => {
    if (gap) {
      const created: SiteContact = { id: `gap-person-${Date.now()}`, name: values.name.trim(), roleCode: values.roleCode, phone: values.phone.trim(), email: values.email.trim(), position: '', primary: values.primary, active: true };
      setContacts((current) => [...current, created]);
      choosePerson(created.id);
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      const created = await createStakeholder(organizationId, { roleCode: 'teacher', name: values.name.trim(), phone: values.phone.trim(), email: values.email.trim(), position: '', primary: false }) as { id: string };
      const person: SiteContact = { id: created.id, name: values.name.trim(), roleCode: 'teacher', phone: values.phone.trim(), email: values.email.trim(), position: '', primary: false, active: true };
      setContacts((current) => [...current, person]);
      if (!productId) throw new Error('Нет продукта захода');
      const saved = await apiRequest<CarrierRow>(`/api/organizations/${organizationId}/teachers`, {
        method: 'POST',
        body: JSON.stringify({ product_id: productId, program_instance_id: programId, stakeholder_id: created.id, full_name: person.name, status: 'planned' }),
      });
      setCarriers((current) => [...current, saved]);
      setCarrier(saved);
      setDraft((current) => ({ ...current, personId: created.id, ...fieldsOf(saved) }));
      setOpen(false);
    } catch {
      message.error('Не удалось добавить контакт');
    } finally {
      setSaving(false);
    }
  };

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
          <div className={tileStyles.vendorHalf}><span className={tileStyles.tileLabel}>Продукт</span><strong className={tileStyles.tileValue}>{vendor.product || 'Не указан'}</strong></div>
          <div className={tileStyles.vendorHalf}><span className={tileStyles.tileLabel}>Вендор</span><strong className={tileStyles.tileValue}>{vendor.company || 'Не указан'}</strong></div>
          {(vendor.contact || vendor.email) && (
            <div className={tileStyles.vendorFoot}>
              {vendor.contact && <span>{vendor.contact}</span>}
              {vendor.email && <span>{vendor.email}</span>}
              {vendor.email && <Button type="link" icon={<CopyOutlined />} onClick={() => void navigator.clipboard.writeText(vendor.email).then(() => message.success('Почта скопирована'))}>Копировать</Button>}
            </div>
          )}
        </div>
      </StageFactTiles>
      <div className={formStyles.fields}>
        <label className={formStyles.field}>
          <span>Преподаватель</span>
          <div className={formStyles.participantRow}>
            <Select allowClear showSearch optionFilterProp="label" placeholder="Человек площадки" disabled={readOnly || pending} value={draft.personId ?? undefined} options={contacts.map((item) => ({ value: item.id, label: `${item.name} · ${roleLabel(item.roleCode)}` }))} onChange={(value) => choosePerson(value ?? null)} />
            {!readOnly && <Button onClick={() => setOpen(true)}>Добавить преподавателя</Button>}
          </div>
        </label>
        <label className={formStyles.field}>
          <span>Статус носителя</span>
          <Select allowClear placeholder="Выберите статус" disabled={readOnly || pending} value={draft.status ?? undefined} options={carrierStatuses.map((item) => ({ value: item.value, label: item.label }))} onChange={(value) => setDraft((current) => ({ ...current, status: (value ?? null) as CarrierStatus | null }))} />
        </label>
        <label className={formStyles.field}>
          <span>Дата обучения</span>
          <DatePicker disabled={readOnly || pending} format="D MMMM YYYY" value={draft.trainedOn ? dayjs(draft.trainedOn) : null} onChange={(value) => setDraft((current) => ({ ...current, trainedOn: value ? value.format('YYYY-MM-DD') : null }))} />
        </label>
        <label className={formStyles.field}>
          <span>Формат</span>
          <Select allowClear placeholder="Выберите формат" disabled={readOnly || pending} value={draft.format ?? undefined} options={trainFormats.map((item) => ({ value: item.value, label: item.label }))} onChange={(value) => setDraft((current) => ({ ...current, format: (value ?? null) as TrainFormat | null }))} />
        </label>
        <label className={formStyles.field}>
          <span>Срок квалификации</span>
          <DatePicker disabled={readOnly || pending} format="D MMMM YYYY" placeholder="необязательно" value={draft.qualificationUntil ? dayjs(draft.qualificationUntil) : null} onChange={(value) => setDraft((current) => ({ ...current, qualificationUntil: value ? value.format('YYYY-MM-DD') : null }))} />
        </label>
        <div className={formStyles.field}>
          <span>Сертификат</span>
          <div className={formStyles.fileSlot}>
            {certificates.map((file, index) => {
              const { Icon, pdf } = fileIcon(file.name);
              return (
                <div key={file.id} className={formStyles.fileCard}>
                  <span className={`${formStyles.fileMark} ${pdf ? formStyles.fileMarkPdf : ''}`} aria-hidden="true"><Icon /></span>
                  <span className={formStyles.fileName} title={file.name}>{file.name}</span>
                  <span className={formStyles.fileMeta}>{index === certificates.length - 1 ? 'текущая версия' : `версия ${index + 1}`}</span>
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
                void onUpload(file, CERTIFICATE_KIND).catch(() => message.error('Не удалось приложить файл'));
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
        system={trainChecks.map((item) => ({ id: item.id, label: item.label, done: done[item.id], required: true }))}
        custom={customRows}
        onAdd={(label) => { const id = nextCustomId(); setDraft((current) => ({ ...current, custom: [...current.custom, { id, label, done: false }], order: [...current.order, id] })); }}
        onReorder={(order) => setDraft((current) => ({ ...current, order }))}
        onToggle={(id) => setDraft((current) => ({ ...current, custom: current.custom.map((row) => row.id === id ? { ...row, done: !row.done } : row) }))}
        onDelete={(id) => setDraft((current) => ({ ...current, custom: current.custom.filter((row) => row.id !== id), order: current.order.filter((item) => item !== id) }))}
        onRename={(id, label) => setDraft((current) => ({ ...current, custom: current.custom.map((row) => row.id === id ? { ...row, label } : row) }))}
      />
      <SiteContactModal open={open} mode="create" variant="teacher" saving={saving} defaultPrimary={false} source={null} onSourceChange={() => undefined} onCancel={() => setOpen(false)} onSubmit={(values) => void addPerson(values)} />
    </div>
  );
};

export default TrainTeacherStage;
