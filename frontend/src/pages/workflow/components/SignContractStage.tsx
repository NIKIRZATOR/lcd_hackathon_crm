import { DeleteOutlined, DownloadOutlined, FileImageOutlined, FileOutlined, FilePdfOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, DatePicker, Input, Select, Upload, message } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useRef, useState } from 'react';

import { apiDownload } from '../../../api/client';
import { roleLabel } from '../../organizations/screenModel';
import type { DeskChecklistItem, DeskFile } from '../api';
import { loadStageFacts } from '../api';
import { loadSiteContacts, pickResponsible, type SiteContact } from '../contactSearch';
import { stageDeadline } from '../firstMeeting';
import {
  SIGN_CONTRACT_SLA_DAYS,
  SIGNED_CONTRACT_KIND,
  contractStatuses,
  emptySignDraft,
  parseSignDraft,
  serializeSignDraft,
  signClosePlan,
  signContractChecks,
  type ContractStatus,
  type SignDraft,
} from '../signContract';
import { isAllowedWorkflowFile, workflowFileRejectionMessage } from '../workflowFiles';

import formStyles from './FirstMeetingStage.module.scss';
import tileStyles from './ContactSearchStage.module.scss';
import StageFactTiles from './StageFactTiles';
import StageTaskChecklist from './StageTaskChecklist';

type SignContractStageProps = {
  stageId: string;
  organizationId: string;
  packageStageId: string | null;
  dueAt: string | null;
  ready: boolean;
  items: DeskChecklistItem[];
  files: DeskFile[];
  fallbackPeople: Array<{ id: string; name: string; role: string; roleCode: string }>;
  readOnly: boolean;
  onCommit: (item: DeskChecklistItem, patch: Record<string, unknown>) => void;
  onPlan: (plan: ReturnType<typeof signClosePlan>) => void;
  onUpload: (file: File, kind: string | null) => Promise<DeskFile | void>;
  onUploadProject: (file: File) => Promise<void>;
  onDeleteFile: (file: DeskFile) => Promise<void>;
};

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

const SignContractStage = ({
  stageId,
  organizationId,
  packageStageId,
  dueAt,
  ready,
  items,
  files,
  fallbackPeople,
  readOnly,
  onCommit,
  onPlan,
  onUpload,
  onUploadProject,
  onDeleteFile,
}: SignContractStageProps) => {
  const gap = organizationId.startsWith('gap-') || stageId.startsWith('gap-');
  const [contacts, setContacts] = useState<SiteContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [draft, setDraft] = useState<SignDraft>(emptySignDraft());
  const [signedOn, setSignedOn] = useState<string | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [projectFile, setProjectFile] = useState<DeskFile | null>(null);
  const savedSignature = useRef('');
  const onCommitRef = useRef(onCommit);
  const onPlanRef = useRef(onPlan);
  const fallbackRef = useRef(fallbackPeople);
  onCommitRef.current = onCommit;
  onPlanRef.current = onPlan;
  fallbackRef.current = fallbackPeople;

  const byCode = (code: string, labelPart: string, kind?: string) => items.find((item) => item.code === code || item.attachmentKind === kind || item.label.toLowerCase().includes(labelPart)) ?? null;

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
    return () => { cancelled = true; };
  }, [gap, organizationId]);

  useEffect(() => {
    if (!packageStageId || packageStageId.startsWith('gap-')) return;
    let cancelled = false;
    loadStageFacts(packageStageId)
      .then((facts) => { if (!cancelled) setProjectFile(facts.files.filter((file) => file.kind === 'project_contract').at(-1) ?? null); })
      .catch(() => { if (!cancelled) setProjectFile(null); });
    return () => { cancelled = true; };
  }, [packageStageId]);

  useEffect(() => {
    if (!ready || draftReady) return;
    const numberItem = byCode('contract_number', 'номер договора');
    const dateItem = byCode('contract_signed_on', 'дата подписания');
    setDraft(parseSignDraft(numberItem?.valueText));
    setSignedOn(dateItem?.valueDate ?? null);
    setDraftReady(true);
  }, [ready, draftReady, items]);

  const signedFiles = files.filter((file) => file.kind === SIGNED_CONTRACT_KIND);
  const latest = signedFiles.at(-1) ?? null;
  const responsible = pickResponsible(contacts, null);
  const pending = !ready || !draftReady || contactsLoading;
  const deadline = stageDeadline(dueAt, SIGN_CONTRACT_SLA_DAYS, dayjs());
  const plan = signClosePlan({
    number: draft.number,
    status: draft.status,
    signedOn,
    hasFile: Boolean(latest),
    validUntil: draft.validUntil,
    signer: draft.signer,
    fileId: latest?.fileId ?? null,
  });
  const done = {
    received: draft.status === 'received',
    number: draft.number.trim().length > 0,
    date: Boolean(signedOn),
    file: Boolean(latest),
  };
  const signature = `${serializeSignDraft(draft)}|${signedOn ?? ''}|${latest?.fileId ?? ''}|${plan.enabled}`;

  useEffect(() => {
    if (pending) return;
    onPlanRef.current(plan);
    const handle = window.setTimeout(() => {
      if (savedSignature.current === signature) return;
      savedSignature.current = signature;
      const numberItem = byCode('contract_number', 'номер договора');
      const dateItem = byCode('contract_signed_on', 'дата подписания');
      const fileItem = byCode('contract_attachment', 'подписанный договор', SIGNED_CONTRACT_KIND);
      const text = serializeSignDraft(draft);
      if (numberItem) onCommitRef.current(numberItem, { value_text: text, value_date: null, attachment_id: null, is_done: plan.enabled, keepLocal: true });
      if (dateItem) onCommitRef.current(dateItem, { value_text: null, value_date: signedOn, attachment_id: null, is_done: plan.enabled, keepLocal: true });
      if (fileItem) onCommitRef.current(fileItem, { value_text: null, value_date: null, attachment_id: latest?.fileId ?? null, is_done: plan.enabled && Boolean(latest), keepLocal: true });
    }, 400);
    return () => window.clearTimeout(handle);
  }, [pending, signature, plan, draft, signedOn, latest, items]);

  const customRows = draft.order.flatMap((id) => {
    const item = draft.custom.find((row) => row.id === id);
    return item ? [item] : [];
  });

  const uploadSigned = (file: File) => {
    if (!isAllowedWorkflowFile(file.name)) {
      message.error(workflowFileRejectionMessage);
      return Upload.LIST_IGNORE;
    }
    void onUpload(file, SIGNED_CONTRACT_KIND).catch(() => message.error('Не удалось приложить файл'));
    return Upload.LIST_IGNORE;
  };

  const uploadProject = (file: File) => {
    if (!isAllowedWorkflowFile(file.name)) {
      message.error(workflowFileRejectionMessage);
      return Upload.LIST_IGNORE;
    }
    void onUploadProject(file).then(() => setProjectFile({ id: `local-${file.name}`, fileId: '', name: file.name, kind: 'project_contract', sizeLabel: '' })).catch(() => message.error('Не удалось добавить версию проекта'));
    return Upload.LIST_IGNORE;
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
      />
      <div className={formStyles.fields}>
        <label className={formStyles.field}>
          <span>Номер</span>
          <Input disabled={readOnly || pending} value={draft.number} onChange={(event) => setDraft((current) => ({ ...current, number: event.target.value }))} />
        </label>
        <label className={formStyles.field}>
          <span>Дата подписания</span>
          <DatePicker
            disabled={readOnly || pending}
            format="D MMMM YYYY"
            value={signedOn ? dayjs(signedOn) : null}
            onChange={(value) => setSignedOn(value ? value.format('YYYY-MM-DD') : null)}
          />
        </label>
        <label className={formStyles.field}>
          <span>Статус</span>
          <Select
            allowClear
            placeholder="Выберите статус"
            disabled={readOnly || pending}
            value={draft.status ?? undefined}
            options={contractStatuses.map((item) => ({ value: item.value, label: item.label }))}
            onChange={(value) => setDraft((current) => ({ ...current, status: (value ?? null) as ContractStatus | null }))}
          />
        </label>
        <label className={formStyles.field}>
          <span>Срок рамки</span>
          <DatePicker
            disabled={readOnly || pending}
            format="D MMMM YYYY"
            value={draft.validUntil ? dayjs(draft.validUntil) : null}
            onChange={(value) => setDraft((current) => ({ ...current, validUntil: value ? value.format('YYYY-MM-DD') : null }))}
          />
        </label>
        <label className={formStyles.field}>
          <span>Кто подписал</span>
          <Input disabled={readOnly || pending} value={draft.signer} onChange={(event) => setDraft((current) => ({ ...current, signer: event.target.value }))} />
        </label>
        <div className={formStyles.field}>
          <span>Подписанный договор</span>
          <div className={formStyles.fileSlot}>
            {signedFiles.map((file, index) => {
              const { Icon, pdf } = fileIcon(file.name);
              return (
                <div key={file.id} className={formStyles.fileCard}>
                  <span className={`${formStyles.fileMark} ${pdf ? formStyles.fileMarkPdf : ''}`} aria-hidden="true"><Icon /></span>
                  <span className={formStyles.fileName} title={file.name}>{file.name}</span>
                  <span className={formStyles.fileMeta}>{index === signedFiles.length - 1 ? 'текущая версия' : `версия ${index + 1}`}</span>
                  <span className={formStyles.fileActions}>
                    <Button type="text" aria-label="Скачать" icon={<DownloadOutlined />} onClick={() => void apiDownload(`/api/workflows/attachments/${file.id}/download`).then((blob) => downloadBlob(blob, file.name))} />
                    {!readOnly && <Button type="text" danger aria-label="Удалить файл" icon={<DeleteOutlined />} onClick={() => void onDeleteFile(file)} />}
                  </span>
                </div>
              );
            })}
            {!readOnly && (
              <Upload accept=".png,.jpeg,.jpg,.pdf,.zip,.gz,.gzip,.rar,.doc,.docx,.xls,.xlsx" showUploadList={false} beforeUpload={uploadSigned}>
                <Button type="dashed" icon={<PlusOutlined />}>Добавить версию</Button>
              </Upload>
            )}
            {projectFile && <Button type="link" onClick={() => { if (projectFile.id.startsWith('local-')) return; void apiDownload(`/api/workflows/attachments/${projectFile.id}/download`).then((blob) => downloadBlob(blob, projectFile.name)); }}>Скачать проект</Button>}
            {!readOnly && draft.status === 'returned' && (
              <Upload accept=".png,.jpeg,.jpg,.pdf,.zip,.gz,.gzip,.rar,.doc,.docx,.xls,.xlsx" showUploadList={false} beforeUpload={uploadProject}>
                <Button type="dashed" icon={<PlusOutlined />}>Новая версия проекта</Button>
              </Upload>
            )}
          </div>
        </div>
      </div>
      <StageTaskChecklist
        readOnly={readOnly}
        system={signContractChecks.map((item) => ({ id: item.id, label: item.label, done: done[item.id], required: true }))}
        custom={customRows}
        onAdd={(label) => {
          const id = nextCustomId();
          setDraft((current) => ({ ...current, custom: [...current.custom, { id, label, done: false }], order: [...current.order, id] }));
        }}
        onReorder={(order) => setDraft((current) => ({ ...current, order }))}
        onToggle={(id) => setDraft((current) => ({ ...current, custom: current.custom.map((row) => row.id === id ? { ...row, done: !row.done } : row) }))}
        onDelete={(id) => setDraft((current) => ({ ...current, custom: current.custom.filter((row) => row.id !== id), order: current.order.filter((item) => item !== id) }))}
        onRename={(id, label) => setDraft((current) => ({ ...current, custom: current.custom.map((row) => row.id === id ? { ...row, label } : row) }))}
      />
    </div>
  );
};

export default SignContractStage;
