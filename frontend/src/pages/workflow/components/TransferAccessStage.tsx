import { CopyOutlined, DeleteOutlined, DownloadOutlined, FileImageOutlined, FileOutlined, FilePdfOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, DatePicker, Input, Select, Upload, message } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useRef, useState } from 'react';

import { apiDownload, apiRequest } from '../../../api/client';
import { roleLabel } from '../../organizations/screenModel';
import type { DeskChecklistItem, DeskFile } from '../api';
import { loadSiteContacts, pickResponsible, type SiteContact } from '../contactSearch';
import { stageDeadline } from '../firstMeeting';
import {
  TRANSFER_FILE_KIND,
  TRANSFER_SLA_DAYS,
  emptyTransferDraft,
  parseTransferDraft,
  serializeTransferDraft,
  transferChecks,
  transferClosePlan,
  transferStatuses,
  type TransferDraft,
  type TransferStatus,
} from '../transferAccess';
import { isAllowedWorkflowFile, workflowFileRejectionMessage } from '../workflowFiles';

import tileStyles from './ContactSearchStage.module.scss';
import formStyles from './FirstMeetingStage.module.scss';
import StageFactTiles from './StageFactTiles';
import StageTaskChecklist from './StageTaskChecklist';

type TransferAccessStageProps = {
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
  onPlan: (plan: ReturnType<typeof transferClosePlan>) => void;
  onUpload: (file: File, kind: string | null) => Promise<DeskFile | void>;
  onDeleteFile: (file: DeskFile) => Promise<void>;
};

type VendorCard = { company: string; product: string; contact: string; email: string };
type ProgramLicense = { id?: string; license_number?: string | null; valid_until?: string | null } | null;

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

const TransferAccessStage = ({
  stageId, programId, organizationId, productName, dueAt, ready, items, files, fallbackPeople, readOnly, onCommit, onPlan, onUpload, onDeleteFile,
}: TransferAccessStageProps) => {
  const gap = organizationId.startsWith('gap-') || stageId.startsWith('gap-');
  const [contacts, setContacts] = useState<SiteContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [vendor, setVendor] = useState<VendorCard>({ company: '', product: productName, contact: '', email: '' });
  const [license, setLicense] = useState<ProgramLicense>(null);
  const [draft, setDraft] = useState<TransferDraft>(emptyTransferDraft());
  const [draftReady, setDraftReady] = useState(false);
  const savedSignature = useRef('');
  const onCommitRef = useRef(onCommit);
  const onPlanRef = useRef(onPlan);
  const fallbackRef = useRef(fallbackPeople);
  onCommitRef.current = onCommit;
  onPlanRef.current = onPlan;
  fallbackRef.current = fallbackPeople;

  const byCode = (code: string, type: string, part: string, kind?: string) => items.find((item) => item.code === code || (kind && item.attachmentKind === kind) || (item.itemType === type && item.label.toLowerCase().includes(part))) ?? null;

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
        const product = await apiRequest<{ name?: string; vendor_id?: string | null }>(`/api/it-products/${program.product_id}`);
        const company = product.vendor_id ? await apiRequest<{ name?: string }>(`/api/vendors/${product.vendor_id}`).catch(() => null) : null;
        if (!cancelled) setVendor((current) => ({ ...current, company: company?.name ?? '', product: product.name || current.product }));
      })
      .catch(() => undefined);
    apiRequest<ProgramLicense>(`/api/program-instances/${programId}/license`)
      .then((row) => { if (!cancelled) setLicense(row); })
      .catch(() => { if (!cancelled) setLicense(null); });
    return () => { cancelled = true; };
  }, [gap, organizationId, programId]);

  useEffect(() => {
    if (!ready || draftReady) return;
    const accessItem = byCode('product_access', 'text', 'доступ');
    setDraft(parseTransferDraft(byCode('transfer_status', 'text', 'подтверждение передачи')?.valueText, accessItem?.valueText));
    setDraftReady(true);
  }, [ready, draftReady, items]);

  const proofFiles = files.filter((file) => file.kind === TRANSFER_FILE_KIND);
  const latest = proofFiles.at(-1) ?? null;
  const responsible = pickResponsible(contacts, null);
  const pending = !ready || !draftReady || contactsLoading;
  const deadline = stageDeadline(dueAt, TRANSFER_SLA_DAYS, dayjs());
  const hasLicense = Boolean(license?.id || license?.license_number);
  const plan = transferClosePlan({
    status: draft.status, recipientId: draft.recipientId, access: draft.access, transferredOn: draft.transferredOn,
    hasFile: Boolean(latest), hasLicense, licenseId: license?.id ?? null, fileId: latest?.fileId ?? null,
  });
  const done = {
    license: hasLicense,
    status: draft.status === 'transferred',
    recipient: Boolean(draft.recipientId),
    access: draft.access.trim().length > 0,
    date: Boolean(draft.transferredOn),
    file: Boolean(latest),
  };
  const signature = `${serializeTransferDraft(draft)}|${latest?.fileId ?? ''}|${hasLicense}|${plan.enabled}`;

  useEffect(() => {
    if (pending) return;
    onPlanRef.current(plan);
    const handle = window.setTimeout(() => {
      if (savedSignature.current === signature) return;
      savedSignature.current = signature;
      const statusItem = byCode('transfer_status', 'text', 'подтверждение передачи');
      const accessItem = byCode('product_access', 'text', 'доступ');
      const fileItem = byCode('transfer_attachment', 'file', 'акт', TRANSFER_FILE_KIND);
      if (statusItem) onCommitRef.current(statusItem, { value_text: serializeTransferDraft(draft), value_date: null, attachment_id: null, is_done: plan.enabled, keepLocal: true });
      if (accessItem) onCommitRef.current(accessItem, { value_text: draft.access.trim() || null, value_date: null, attachment_id: null, is_done: plan.enabled, keepLocal: true });
      if (fileItem) onCommitRef.current(fileItem, { value_text: null, value_date: null, attachment_id: latest?.fileId ?? null, is_done: plan.enabled && Boolean(latest), keepLocal: true });
    }, 400);
    return () => window.clearTimeout(handle);
  }, [pending, signature, plan, draft, latest, items]);

  const customRows = draft.order.flatMap((id) => {
    const item = draft.custom.find((row) => row.id === id);
    return item ? [item] : [];
  });
  const until = license?.valid_until ? dayjs(license.valid_until) : null;

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
          <div className={tileStyles.vendorHalf}>
            <span className={tileStyles.tileLabel}>Продукт</span>
            <strong className={tileStyles.tileValue}>{vendor.product || 'Не указан'}</strong>
          </div>
          <div className={tileStyles.vendorHalf}>
            <span className={tileStyles.tileLabel}>Вендор</span>
            <strong className={tileStyles.tileValue}>{vendor.company || 'Не указан'}</strong>
          </div>
          {(vendor.contact || vendor.email) && (
            <div className={tileStyles.vendorFoot}>
              {vendor.contact && <span>{vendor.contact}</span>}
              {vendor.email && <span>{vendor.email}</span>}
              {vendor.email && <Button type="link" icon={<CopyOutlined />} onClick={() => void navigator.clipboard.writeText(vendor.email).then(() => message.success('Почта скопирована'))}>Копировать</Button>}
            </div>
          )}
        </div>
      </StageFactTiles>
      <p className={formStyles.context}>
        {hasLicense ? `Лицензия ${license?.license_number || 'без номера'}${until?.isValid() ? ` · действует до ${until.format('D MMMM YYYY')}` : ''}` : 'Лицензия захода не заведена'}
      </p>
      <div className={formStyles.fields}>
        <label className={formStyles.field}>
          <span>Статус</span>
          <Select allowClear placeholder="Выберите статус" disabled={readOnly || pending} value={draft.status ?? undefined} options={transferStatuses.map((item) => ({ value: item.value, label: item.label }))} onChange={(value) => setDraft((current) => ({ ...current, status: (value ?? null) as TransferStatus | null }))} />
        </label>
        <label className={formStyles.field}>
          <span>Получатель доступа</span>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Человек площадки"
            disabled={readOnly || pending}
            value={draft.recipientId ?? undefined}
            options={contacts.map((person) => ({ value: person.id, label: `${person.name} · ${roleLabel(person.roleCode)}` }))}
            onChange={(value) => setDraft((current) => ({ ...current, recipientId: value ?? null }))}
          />
        </label>
        <label className={formStyles.field}>
          <span>Сведения о доступе</span>
          <div className={formStyles.participantRow}>
            <Input disabled={readOnly || pending} placeholder="Ссылка, логин или факт выдачи" value={draft.access} onChange={(event) => setDraft((current) => ({ ...current, access: event.target.value }))} />
            <Button type="link" icon={<CopyOutlined />} disabled={!draft.access.trim()} onClick={() => void navigator.clipboard.writeText(draft.access.trim()).then(() => message.success('Скопировано'))}>Копировать</Button>
          </div>
        </label>
        <label className={formStyles.field}>
          <span>Дата передачи</span>
          <DatePicker disabled={readOnly || pending} format="D MMMM YYYY" value={draft.transferredOn ? dayjs(draft.transferredOn) : null} onChange={(value) => setDraft((current) => ({ ...current, transferredOn: value ? value.format('YYYY-MM-DD') : null }))} />
        </label>
        <div className={formStyles.field}>
          <span>Файл подтверждения</span>
          <div className={formStyles.fileSlot}>
            {proofFiles.map((file, index) => {
              const { Icon, pdf } = fileIcon(file.name);
              return (
                <div key={file.id} className={formStyles.fileCard}>
                  <span className={`${formStyles.fileMark} ${pdf ? formStyles.fileMarkPdf : ''}`} aria-hidden="true"><Icon /></span>
                  <span className={formStyles.fileName} title={file.name}>{file.name}</span>
                  <span className={formStyles.fileMeta}>{index === proofFiles.length - 1 ? 'текущая версия' : `версия ${index + 1}`}</span>
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
                void onUpload(file, TRANSFER_FILE_KIND).catch(() => message.error('Не удалось приложить файл'));
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
        system={transferChecks.map((item) => ({ id: item.id, label: item.label, done: done[item.id], required: true }))}
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

export default TransferAccessStage;
