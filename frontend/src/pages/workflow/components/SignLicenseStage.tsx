import { CopyOutlined, DeleteOutlined, DownloadOutlined, FileImageOutlined, FileOutlined, FilePdfOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, DatePicker, Input, Select, Upload, message } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useRef, useState } from 'react';

import { apiDownload, apiRequest } from '../../../api/client';
import { roleLabel } from '../../organizations/screenModel';
import { loadSiteContacts, pickResponsible, type SiteContact } from '../stages/contactSearch';
import type { DeskChecklistItem, DeskFile } from '../api';
import { stageDeadline } from '../stages/firstMeeting';
import {
  LICENSE_FILE_KIND,
  SIGN_LICENSE_SLA_DAYS,
  emptyLicenseDraft,
  licenseStatuses,
  parseLicenseDraft,
  serializeLicenseDraft,
  signLicenseChecks,
  signLicensePlan,
  type LicenseDraft,
  type LicenseStatus,
} from '../stages/signLicense';
import { isAllowedWorkflowFile, workflowFileRejectionMessage } from '../shared/workflowFiles';

import formStyles from './FirstMeetingStage.module.scss';
import tileStyles from './ContactSearchStage.module.scss';
import StageFactTiles from './StageFactTiles';
import StageTaskChecklist from './StageTaskChecklist';

type SignLicenseStageProps = {
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
  onPlan: (plan: ReturnType<typeof signLicensePlan>) => void;
  onUpload: (file: File, kind: string | null) => Promise<DeskFile | void>;
  onDeleteFile: (file: DeskFile) => Promise<void>;
};

type VendorCard = { company: string; product: string; contact: string; channel: string; email: string };
type TemplateLink = { kind: string; name: string; url: string };

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

const SignLicenseStage = ({
  stageId, programId, organizationId, productName, dueAt, ready, items, files, fallbackPeople, readOnly, onCommit, onPlan, onUpload, onDeleteFile,
}: SignLicenseStageProps) => {
  const gap = organizationId.startsWith('gap-') || stageId.startsWith('gap-');
  const [contacts, setContacts] = useState<SiteContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [vendor, setVendor] = useState<VendorCard>({ company: '', product: productName, contact: '', channel: '', email: '' });
  const [templateUrl, setTemplateUrl] = useState<string | null>(null);
  const [draft, setDraft] = useState<LicenseDraft>(emptyLicenseDraft());
  const [validUntil, setValidUntil] = useState<string | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const savedSignature = useRef('');
  const onCommitRef = useRef(onCommit);
  const onPlanRef = useRef(onPlan);
  const fallbackRef = useRef(fallbackPeople);
  onCommitRef.current = onCommit;
  onPlanRef.current = onPlan;
  fallbackRef.current = fallbackPeople;

  const byCode = (code: string, labelPart: string, kind?: string) => items.find((item) => item.code === code || (kind && item.attachmentKind === kind) || item.label.toLowerCase().includes(labelPart)) ?? null;

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
    apiRequest<{ product_id?: string; parent_program_id?: string | null }>(`/api/program-instances/${programId}`)
      .then(async (program) => {
        if (cancelled || !program.product_id) return;
        const product = await apiRequest<{ name?: string; vendor_id?: string | null }>(`/api/it-products/${program.product_id}`);
        const company = product.vendor_id ? await apiRequest<{ name?: string }>(`/api/vendors/${product.vendor_id}`).catch(() => null) : null;
        if (!cancelled) setVendor((current) => ({ ...current, company: company?.name ?? '', product: product.name || current.product }));
        if (program.parent_program_id) {
          const parent = await apiRequest<{ license_number?: string | null; signed_at?: string | null; valid_until?: string | null } | null>(`/api/program-instances/${program.parent_program_id}/license`).catch(() => null);
          if (!cancelled && parent?.license_number) {
            setDraft((current) => current.number ? current : { ...current, number: parent.license_number ?? '', signedOn: parent.signed_at?.slice(0, 10) ?? current.signedOn });
            setValidUntil((current) => current ?? parent.valid_until?.slice(0, 10) ?? null);
          }
        }
      })
      .catch(() => undefined);
    apiRequest<TemplateLink[]>('/api/document-templates')
      .then((rows) => { if (!cancelled) setTemplateUrl(rows.find((item) => item.kind === LICENSE_FILE_KIND)?.url ?? null); })
      .catch(() => { if (!cancelled) setTemplateUrl(null); });
    return () => { cancelled = true; };
  }, [gap, organizationId, programId]);

  useEffect(() => {
    if (!ready || draftReady) return;
    setDraft(parseLicenseDraft(byCode('license_number', 'номер лицензии')?.valueText));
    setValidUntil(byCode('license_valid_until', 'срок')?.valueDate ?? null);
    setDraftReady(true);
  }, [ready, draftReady, items]);

  const licenseFiles = files.filter((file) => file.kind === LICENSE_FILE_KIND);
  const latest = licenseFiles.at(-1) ?? null;
  const responsible = pickResponsible(contacts, null);
  const pending = !ready || !draftReady || contactsLoading;
  const deadline = stageDeadline(dueAt, SIGN_LICENSE_SLA_DAYS, dayjs());
  const plan = signLicensePlan({ number: draft.number, status: draft.status, signedOn: draft.signedOn, validUntil, hasFile: Boolean(latest), volume: draft.volume, fileId: latest?.fileId ?? null });
  const done = { received: draft.status === 'received', number: draft.number.trim().length > 0, signed: Boolean(draft.signedOn), term: Boolean(validUntil), file: Boolean(latest) };
  const signature = `${serializeLicenseDraft(draft)}|${validUntil ?? ''}|${latest?.fileId ?? ''}|${plan.enabled}`;

  useEffect(() => {
    if (pending) return;
    onPlanRef.current(plan);
    const handle = window.setTimeout(() => {
      if (savedSignature.current === signature) return;
      savedSignature.current = signature;
      const numberItem = byCode('license_number', 'номер лицензии');
      const termItem = byCode('license_valid_until', 'срок');
      const fileItem = byCode('license_attachment', 'подписанная лицензия', LICENSE_FILE_KIND);
      if (numberItem) onCommitRef.current(numberItem, { value_text: serializeLicenseDraft(draft), value_date: null, attachment_id: null, is_done: plan.enabled, keepLocal: true });
      if (termItem) onCommitRef.current(termItem, { value_text: null, value_date: validUntil, attachment_id: null, is_done: plan.enabled, keepLocal: true });
      if (fileItem) onCommitRef.current(fileItem, { value_text: null, value_date: null, attachment_id: latest?.fileId ?? null, is_done: plan.enabled && Boolean(latest), keepLocal: true });
    }, 400);
    return () => window.clearTimeout(handle);
  }, [pending, signature, plan, draft, validUntil, latest, items]);

  const customRows = draft.order.flatMap((id) => {
    const item = draft.custom.find((row) => row.id === id);
    return item ? [item] : [];
  });

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
            {vendor.email && <Button type="link" icon={<CopyOutlined />} onClick={() => void navigator.clipboard.writeText(vendor.email).then(() => message.success('Почта скопирована'))}>скопировать</Button>}
          </div>
        )}
      </div>
      </StageFactTiles>
      <div className={formStyles.fields}>
        <label className={formStyles.field}><span>Номер</span><Input disabled={readOnly || pending} value={draft.number} onChange={(event) => setDraft((current) => ({ ...current, number: event.target.value }))} /></label>
        <label className={formStyles.field}><span>Дата</span><DatePicker disabled={readOnly || pending} format="D MMMM YYYY" value={draft.signedOn ? dayjs(draft.signedOn) : null} onChange={(value) => setDraft((current) => ({ ...current, signedOn: value ? value.format('YYYY-MM-DD') : null }))} /></label>
        <label className={formStyles.field}><span>Действует до</span><DatePicker disabled={readOnly || pending} format="D MMMM YYYY" value={validUntil ? dayjs(validUntil) : null} onChange={(value) => setValidUntil(value ? value.format('YYYY-MM-DD') : null)} /></label>
        <label className={formStyles.field}>
          <span>Статус</span>
          <Select allowClear placeholder="Выберите статус" disabled={readOnly || pending} value={draft.status ?? undefined} options={licenseStatuses.map((item) => ({ value: item.value, label: item.label }))} onChange={(value) => setDraft((current) => ({ ...current, status: (value ?? null) as LicenseStatus | null }))} />
        </label>
        <label className={formStyles.field}><span>Количество потоков</span><Input disabled={readOnly || pending} placeholder="необязательно" value={draft.volume} onChange={(event) => setDraft((current) => ({ ...current, volume: event.target.value }))} /></label>
        <div className={formStyles.field}>
          <span>Файл лицензии</span>
          <div className={formStyles.fileSlot}>
            {licenseFiles.map((file, index) => {
              const { Icon, pdf } = fileIcon(file.name);
              return (
                <div key={file.id} className={formStyles.fileCard}>
                  <span className={`${formStyles.fileMark} ${pdf ? formStyles.fileMarkPdf : ''}`} aria-hidden="true"><Icon /></span>
                  <span className={formStyles.fileName} title={file.name}>{file.name}</span>
                  <span className={formStyles.fileMeta}>{index === licenseFiles.length - 1 ? 'текущая версия' : `версия ${index + 1}`}</span>
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
                void onUpload(file, LICENSE_FILE_KIND).catch(() => message.error('Не удалось приложить файл'));
                return Upload.LIST_IGNORE;
              }}
              >
                <Button type="dashed" icon={<PlusOutlined />}>{draft.status === 'returned' ? 'Новая версия' : 'Добавить версию'}</Button>
              </Upload>
            )}
            {templateUrl && <Button type="link" href={templateUrl} target="_blank" rel="noreferrer">Скачать шаблон</Button>}
          </div>
        </div>
      </div>
      <StageTaskChecklist
        readOnly={readOnly}
        system={signLicenseChecks.map((item) => ({ id: item.id, label: item.label, done: done[item.id], required: true }))}
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

export default SignLicenseStage;
