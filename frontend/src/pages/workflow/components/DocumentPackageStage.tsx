import { DeleteOutlined, DownloadOutlined, FileImageOutlined, FileOutlined, FilePdfOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Upload, message } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useRef, useState } from 'react';

import { apiDownload, apiRequest } from '../../../api/client';
import { roleLabel } from '../../organizations/screenModel';
import type { DeskChecklistItem, DeskFile } from '../api';
import { loadSiteContacts, pickResponsible, type SiteContact } from '../contactSearch';
import {
  activeFramework,
  DOCUMENT_PACKAGE_SLA_DAYS,
  documentClosePlan,
  documentSlots,
  emptyDocumentTasks,
  parseDocumentTasks,
  serializeDocumentTasks,
  type DocumentSlotKind,
  type DocumentTasks,
  type FrameworkContract,
} from '../documentPackage';
import { stageDeadline } from '../firstMeeting';
import { isAllowedWorkflowFile, workflowFileRejectionMessage } from '../workflowFiles';

import formStyles from './FirstMeetingStage.module.scss';
import tileStyles from './ContactSearchStage.module.scss';
import StageFactTiles from './StageFactTiles';
import StageTaskChecklist from './StageTaskChecklist';

type DocumentPackageStageProps = {
  stageId: string;
  organizationId: string;
  dueAt: string | null;
  ready: boolean;
  items: DeskChecklistItem[];
  files: DeskFile[];
  fallbackPeople: Array<{ id: string; name: string; role: string; roleCode: string }>;
  readOnly: boolean;
  onCommit: (item: DeskChecklistItem, patch: Record<string, unknown>) => void;
  onBlockers: (labels: string[]) => void;
  onPlan: (plan: ReturnType<typeof documentClosePlan>) => void;
  onUpload: (file: File, kind: string | null) => Promise<DeskFile | void>;
  onDeleteFile: (file: DeskFile) => Promise<void>;
};

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

const DocumentPackageStage = ({
  stageId,
  organizationId,
  dueAt,
  ready,
  items,
  files,
  fallbackPeople,
  readOnly,
  onCommit,
  onBlockers,
  onPlan,
  onUpload,
  onDeleteFile,
}: DocumentPackageStageProps) => {
  const gap = organizationId.startsWith('gap-') || stageId.startsWith('gap-');
  const [contacts, setContacts] = useState<SiteContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [framework, setFramework] = useState<FrameworkContract | null>(null);
  const [templates, setTemplates] = useState<TemplateLink[]>([]);
  const [tasks, setTasks] = useState<DocumentTasks>(emptyDocumentTasks());
  const [tasksReady, setTasksReady] = useState(false);
  const savedSignature = useRef('');
  const onCommitRef = useRef(onCommit);
  const onBlockersRef = useRef(onBlockers);
  const onPlanRef = useRef(onPlan);
  const fallbackRef = useRef(fallbackPeople);
  onCommitRef.current = onCommit;
  onBlockersRef.current = onBlockers;
  onPlanRef.current = onPlan;
  fallbackRef.current = fallbackPeople;

  const slotItem = (kind: DocumentSlotKind) => {
    const spec = documentSlots.find((slot) => slot.kind === kind);
    const title = spec?.title.toLowerCase() ?? '';
    return items.find((item) => item.attachmentKind === kind || item.code === spec?.code || item.label.toLowerCase().includes(title) || (kind === 'direction_materials' && item.label.toLowerCase().includes('материал'))) ?? null;
  };

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
    apiRequest<Array<{ id: string; number: string; status?: string | null; valid_until?: string | null; attachment_id?: string | null }>>(`/api/organizations/${organizationId}/contracts`)
      .then((rows) => {
        if (cancelled) return;
        setFramework(activeFramework(rows.map((row) => ({
          id: row.id,
          number: row.number,
          status: row.status ?? null,
          validUntil: row.valid_until ?? null,
          attachmentId: row.attachment_id ?? null,
        }))));
      })
      .catch(() => { if (!cancelled) setFramework(null); });
    apiRequest<TemplateLink[]>('/api/document-templates')
      .then((rows) => { if (!cancelled) setTemplates(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (!cancelled) setTemplates([]); });
    return () => { cancelled = true; };
  }, [gap, organizationId]);

  useEffect(() => {
    if (!ready || tasksReady) return;
    const contractItem = slotItem('project_contract');
    setTasks(parseDocumentTasks(contractItem?.valueText));
    setTasksReady(true);
  }, [ready, tasksReady, items]);

  const versions = (kind: DocumentSlotKind) => files.filter((file) => file.kind === kind);
  const filled = {
    project_contract: versions('project_contract').length > 0 || Boolean(framework),
    direction_materials: versions('direction_materials').length > 0,
    product_description: versions('product_description').length > 0,
  } satisfies Record<DocumentSlotKind, boolean>;
  const responsible = pickResponsible(contacts, null);
  const pending = !ready || !tasksReady || contactsLoading;
  const deadline = stageDeadline(dueAt, DOCUMENT_PACKAGE_SLA_DAYS, dayjs());
  const plan = documentClosePlan(filled);
  const signature = `${serializeDocumentTasks(tasks)}|${filled.project_contract}|${filled.direction_materials}|${filled.product_description}`;

  useEffect(() => {
    if (pending) return;
    onBlockersRef.current(plan.hint ? [plan.hint] : []);
    onPlanRef.current(plan);
    const handle = window.setTimeout(() => {
      if (savedSignature.current === signature) return;
      savedSignature.current = signature;
      const tasksText = serializeDocumentTasks(tasks);
      documentSlots.forEach((slot) => {
        const item = slotItem(slot.kind);
        const latest = versions(slot.kind).at(-1);
        if (!item || !latest) return;
        onCommitRef.current(item, {
          attachment_id: latest.fileId,
          is_done: true,
          value_text: slot.kind === 'project_contract' ? tasksText : null,
          keepLocal: true,
        });
      });
    }, 400);
    return () => window.clearTimeout(handle);
  }, [pending, signature, plan, tasks, files, items]);

  const customRows = tasks.order.flatMap((id) => {
    const item = tasks.custom.find((row) => row.id === id);
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
      />
      <div className={formStyles.fields}>
        {documentSlots.map((slot) => {
          const rows = versions(slot.kind);
          const template = templates.find((item) => item.kind === slot.kind);
          return (
            <div key={slot.kind} className={formStyles.field}>
              <span>{slot.title}</span>
              <div className={formStyles.fileSlot}>
                {slot.kind === 'project_contract' && framework && (
                  <div className={formStyles.fileCard}>
                    <span className={formStyles.fileMark} aria-hidden="true"><FileOutlined /></span>
                    <span className={formStyles.fileName} title={`Рамка ${framework.number}`}>Рамка {framework.number}</span>
                    <span className={formStyles.fileMeta}>действующая рамка</span>
                  </div>
                )}
                {rows.map((file, index) => {
                  const { Icon, pdf } = fileIcon(file.name);
                  return (
                    <div key={file.id} className={formStyles.fileCard}>
                      <span className={`${formStyles.fileMark} ${pdf ? formStyles.fileMarkPdf : ''}`} aria-hidden="true"><Icon /></span>
                      <span className={formStyles.fileName} title={file.name}>{file.name}</span>
                      <span className={formStyles.fileMeta}>{index === rows.length - 1 ? 'текущая версия' : `версия ${index + 1}`}</span>
                      <span className={formStyles.fileActions}>
                        <Button type="text" aria-label="Скачать" icon={<DownloadOutlined />} onClick={() => void apiDownload(`/api/workflows/attachments/${file.id}/download`).then((blob) => downloadBlob(blob, file.name))} />
                        {!readOnly && <Button type="text" danger aria-label="Удалить файл" icon={<DeleteOutlined />} onClick={() => void onDeleteFile(file)} />}
                      </span>
                    </div>
                  );
                })}
                <div className={formStyles.fileActions}>
                  {!readOnly && (
                    <Upload
                      accept=".png,.jpeg,.jpg,.pdf,.zip,.gz,.gzip,.rar,.doc,.docx,.xls,.xlsx"
                      showUploadList={false}
                      beforeUpload={(file) => {
                        if (!isAllowedWorkflowFile(file.name)) {
                          message.error(workflowFileRejectionMessage);
                          return Upload.LIST_IGNORE;
                        }
                        void onUpload(file, slot.kind).catch(() => message.error('Не удалось приложить файл'));
                        return Upload.LIST_IGNORE;
                      }}
                    >
                      <Button type="dashed" icon={<PlusOutlined />}>Добавить версию</Button>
                    </Upload>
                  )}
                  {template && <Button type="link" href={template.url} target="_blank" rel="noreferrer">Скачать шаблон</Button>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <StageTaskChecklist
        readOnly={readOnly}
        system={documentSlots.map((slot) => ({ id: slot.kind, label: slot.check, done: filled[slot.kind], required: true }))}
        custom={customRows}
        onAdd={(label) => {
          const id = nextCustomId();
          setTasks((current) => ({ ...current, custom: [...current.custom, { id, label, done: false }], order: [...current.order, id] }));
        }}
        onReorder={(order) => setTasks((current) => ({ ...current, order }))}
        onToggle={(id) => setTasks((current) => ({ ...current, custom: current.custom.map((row) => row.id === id ? { ...row, done: !row.done } : row) }))}
        onDelete={(id) => setTasks((current) => ({ ...current, custom: current.custom.filter((row) => row.id !== id), order: current.order.filter((item) => item !== id) }))}
        onRename={(id, label) => setTasks((current) => ({ ...current, custom: current.custom.map((row) => row.id === id ? { ...row, label } : row) }))}
      />
    </div>
  );
};

export default DocumentPackageStage;
