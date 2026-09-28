import { DeleteOutlined, DownloadOutlined, FileOutlined, FilePdfOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Input, Select, Upload, message } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { apiDownload, apiRequest } from '../../../api/client';
import { roleLabel } from '../../organizations/screenModel';
import type { DeskChecklistItem, DeskFile } from '../api';
import { loadSiteContacts, pickResponsible, type SiteContact } from '../contactSearch';
import { stageDeadline } from '../firstMeeting';
import {
  PERIOD_SLA_DAYS,
  emptyPeriodDraft,
  failReasons,
  parsePeriodDraft,
  periodClosePlan,
  serializePeriodDraft,
  verdicts,
  type FailReason,
  type PeriodDraft,
  type PeriodSnapshot,
  type Verdict,
} from '../periodResults';
import { isAllowedWorkflowFile, workflowFileRejectionMessage } from '../workflowFiles';

import tileStyles from './ContactSearchStage.module.scss';
import formStyles from './FirstMeetingStage.module.scss';
import StageFactTiles from './StageFactTiles';
import StageTaskChecklist from './StageTaskChecklist';

type PeriodResultsStageProps = {
  stageId: string;
  programId: string;
  organizationId: string;
  dueAt: string | null;
  ready: boolean;
  items: DeskChecklistItem[];
  files: DeskFile[];
  fallbackPeople: Array<{ id: string; name: string; role: string; roleCode: string }>;
  readOnly: boolean;
  onCommit: (item: DeskChecklistItem, patch: Record<string, unknown>) => void;
  onPlan: (plan: ReturnType<typeof periodClosePlan> & { early: boolean }) => void;
  onUpload: (file: File, kind: string | null) => Promise<DeskFile | void>;
  onDeleteFile: (file: DeskFile) => Promise<void>;
};

const FILE_KIND = 'period_result';
const carrierLabel = (status: string | null) => status === 'active' ? 'Ведёт' : status === 'trained' ? 'Обучен' : status === 'left' ? 'Ушёл' : status === 'planned' ? 'К обучению' : 'Нет данных';
const nextCustomId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? `custom-${crypto.randomUUID()}` : `custom-${Date.now()}`);
const downloadBlob = (blob: Blob, name: string) => { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url); };

const PeriodResultsStage = ({ stageId, programId, organizationId, dueAt, ready, items, files, fallbackPeople, readOnly, onCommit, onPlan, onUpload, onDeleteFile }: PeriodResultsStageProps) => {
  const navigate = useNavigate();
  const gap = organizationId.startsWith('gap-') || stageId.startsWith('gap-');
  const [contacts, setContacts] = useState<SiteContact[]>([]);
  const [pending, setPending] = useState(true);
  const [draft, setDraft] = useState<PeriodDraft>(emptyPeriodDraft);
  const [draftReady, setDraftReady] = useState(false);
  const [windowEnd, setWindowEnd] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Array<{ key: string; label: string; playbook: string }>>([]);
  const savedSignature = useRef('');
  const onCommitRef = useRef(onCommit);
  const onPlanRef = useRef(onPlan);
  const fallbackRef = useRef(fallbackPeople);
  onCommitRef.current = onCommit;
  onPlanRef.current = onPlan;
  fallbackRef.current = fallbackPeople;

  const fact = () => items.find((item) => item.code === 'period_result' || item.label.toLowerCase().includes('итог')) ?? null;

  useEffect(() => {
    if (!ready || draftReady) return;
    setDraft(parsePeriodDraft(fact()?.valueText));
    setDraftReady(true);
  }, [ready, draftReady, items]);

  useEffect(() => {
    let cancelled = false;
    if (gap) { setPending(false); return () => { cancelled = true; }; }
    loadSiteContacts(organizationId).then((rows) => { if (!cancelled) setContacts(rows); }).catch(() => undefined);
    if (draftReady && draft.snapshot) { setPending(false); return () => { cancelled = true; }; }
    if (!draftReady) return () => { cancelled = true; };
    Promise.all([
      apiRequest<{ product_id?: string; academic_window_id?: string | null }>(`/api/program-instances/${programId}`),
      apiRequest<{ students_count?: number; applications_count?: number; last_lms_signal_at?: string | null; last_website_signal_at?: string | null } | null>(`/api/integrations/program-instances/${programId}/metrics`).catch(() => null),
      apiRequest<{ valid_until?: string | null } | null>(`/api/program-instances/${programId}/license`).catch(() => null),
      apiRequest<Array<{ id: string; classes_end_on: string }>>('/api/academic-windows').catch(() => []),
    ]).then(async ([program, metrics, license, windows]) => {
      if (cancelled) return;
      const end = windows.find((item) => item.id === program.academic_window_id)?.classes_end_on ?? null;
      setWindowEnd(end);
      const teachers = program.product_id ? await apiRequest<Array<{ product_id: string; program_instance_id?: string | null; status: string }>>(`/api/organizations/${organizationId}/teachers`).catch(() => []) : [];
      const carrier = teachers.find((row) => row.product_id === program.product_id && row.program_instance_id === programId) ?? teachers.find((row) => row.product_id === program.product_id);
      const snapshot: PeriodSnapshot = {
        students: metrics?.students_count ?? null,
        applications: metrics?.applications_count ?? null,
        licenseUntil: license?.valid_until ?? null,
        carrierStatus: carrier?.status ?? null,
        signalAt: metrics?.last_lms_signal_at ?? metrics?.last_website_signal_at ?? null,
      };
      setDraft((current) => current.snapshot ? current : { ...current, snapshot });
      const daysLeft = snapshot.licenseUntil ? dayjs(snapshot.licenseUntil).startOf('day').diff(dayjs().startOf('day'), 'day') : null;
      const silence = snapshot.signalAt ? dayjs().startOf('day').diff(dayjs(snapshot.signalAt).startOf('day'), 'day') : null;
      const next: Array<{ key: string; label: string; playbook: string }> = [];
      if (daysLeft !== null && daysLeft <= 90) next.push({ key: 'renewal', label: 'Создать заход «Продление»', playbook: 'license_renewal' });
      if (snapshot.carrierStatus === 'left') next.push({ key: 'replace', label: 'Сначала замена', playbook: 'train_teacher' });
      if ((snapshot.students ?? 0) >= 15 && silence !== null && silence <= 14) next.push({ key: 'expand', label: 'Рассмотреть расширение', playbook: 'expansion' });
      if (!cancelled) setSuggestions(next);
    }).finally(() => { if (!cancelled) setPending(false); });
    return () => { cancelled = true; };
  }, [gap, organizationId, programId, draftReady, draft.snapshot]);

  const shot = draft.snapshot;
  const silence = shot?.signalAt ? dayjs().startOf('day').diff(dayjs(shot.signalAt).startOf('day'), 'day') : null;
  const signalAlive = (shot?.students ?? 0) > 0 && silence !== null && silence <= 14;
  const early = Boolean(windowEnd && dayjs(windowEnd).startOf('day').diff(dayjs().startOf('day'), 'day') > 14 && signalAlive);
  const plan = periodClosePlan({ verdict: draft.verdict, reason: draft.reason, comment: draft.comment });
  const responsible = pickResponsible(contacts, null);
  const deadline = stageDeadline(dueAt, PERIOD_SLA_DAYS, dayjs());
  const proofs = files.filter((file) => file.kind === FILE_KIND);
  const signature = serializePeriodDraft(draft);
  const customRows = draft.order.flatMap((id) => draft.custom.filter((row) => row.id === id));

  useEffect(() => { onPlanRef.current({ ...plan, early }); }, [plan.enabled, plan.button, early]);
  useEffect(() => {
    if (!draftReady || !shot) return;
    const handle = window.setTimeout(() => {
      if (savedSignature.current === signature) return;
      savedSignature.current = signature;
      const item = fact();
      if (item) onCommitRef.current(item, { value_text: signature, is_done: plan.enabled, keepLocal: true });
    }, 400);
    return () => window.clearTimeout(handle);
  }, [draftReady, signature, plan.enabled, shot]);

  const openNext = (playbook: string) => {
    sessionStorage.setItem('rtk-eduflow:next-program', JSON.stringify({ parentProgramId: programId, organizationId, playbook }));
    navigate(`/universities/${organizationId}`);
  };

  return (
    <div className={tileStyles.root}>
      <StageFactTiles tiles={[
        { kind: 'person', label: 'Ответственный', value: responsible?.name ?? '', empty: 'Ответственный не найден', hint: responsible ? roleLabel(responsible.roleCode) : undefined, pending },
        { kind: 'phone', label: 'Телефон', value: responsible?.phone ?? '', empty: 'Телефон не найден', pending },
        { kind: 'mail', label: 'Почта', value: responsible?.email ?? '', empty: 'Почта не найдена', pending },
        { kind: 'due', label: 'Срок', value: deadline.date.format('D MMMM YYYY'), hint: `${deadline.caption} · ${deadline.origin}`, dueState: deadline.daysLeft < 0 ? 'late' : deadline.daysLeft === 0 ? 'today' : 'ok' },
      ]}>
        <div className={tileStyles.factGrid}>
          <div className={tileStyles.factCell}><span>Студенты</span><b>{shot?.students ?? 'Нет снимка'}</b></div>
          <div className={tileStyles.factCell}><span>Заявки</span><b>{shot?.applications ?? 'Нет снимка'}</b></div>
          <div className={tileStyles.factCell}><span>Срок лицензии</span><b>{shot?.licenseUntil ? dayjs(shot.licenseUntil).format('D MMMM YYYY') : 'Нет данных'}</b></div>
          <div className={tileStyles.factCell}><span>Носитель</span><b>{carrierLabel(shot?.carrierStatus ?? null)}</b></div>
          <div className={tileStyles.factCell}><span>Сигнал на закрытии</span><b>{shot?.signalAt ? dayjs(shot.signalAt).format('D MMMM YYYY') : 'Нет события'}</b><small>{signalAlive ? 'Сигнал живой' : 'Сигнал тихий'}</small></div>
        </div>
      </StageFactTiles>
      <div className={formStyles.fields}>
        <label className={formStyles.field}>
          <span>Вердикт захода</span>
          <Select allowClear placeholder="Выберите вердикт" disabled={readOnly || pending} value={draft.verdict ?? undefined} options={verdicts.map((item) => ({ value: item.value, label: item.label }))} onChange={(value) => setDraft((current) => ({ ...current, verdict: (value ?? null) as Verdict | null, reason: value === 'failed' ? current.reason : null }))} />
        </label>
        {draft.verdict === 'failed' && (
          <label className={formStyles.field}>
            <span>Причина срыва</span>
            <Select allowClear placeholder="Выберите причину" disabled={readOnly || pending} value={draft.reason ?? undefined} options={failReasons.map((item) => ({ value: item.value, label: item.label }))} onChange={(value) => setDraft((current) => ({ ...current, reason: (value ?? null) as FailReason | null }))} />
          </label>
        )}
        <label className={formStyles.field}>
          <span>Комментарий</span>
          <Input.TextArea disabled={readOnly || pending} autoSize={{ minRows: 3, maxRows: 6 }} value={draft.comment} placeholder={early ? 'окно ещё идёт — комментарий обязателен' : 'обязательно'} onChange={(event) => setDraft((current) => ({ ...current, comment: event.target.value }))} />
        </label>
        <div className={formStyles.field}>
          <span>Что дальше</span>
          <div className={formStyles.fileActions}>
            {suggestions.length === 0 && <span>Предложений нет. Новый семестр открывается отдельным заходом.</span>}
            {suggestions.map((item) => <Button key={item.key} onClick={() => openNext(item.playbook)}>{item.label}</Button>)}
          </div>
        </div>
        <div className={formStyles.field}>
          <span>Файл итогов</span>
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
        system={[
          { id: 'verdict', label: 'Вердикт выбран', done: Boolean(draft.verdict), required: true },
          { id: 'comment', label: 'Комментарий написан', done: draft.comment.trim().length > 0, required: true },
          ...(draft.verdict === 'failed' ? [{ id: 'reason', label: 'Причина срыва указана', done: Boolean(draft.reason), required: true }] : []),
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

export default PeriodResultsStage;
