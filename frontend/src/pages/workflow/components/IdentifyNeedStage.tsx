import { Alert, Input, Select, message } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useRef, useState } from 'react';

import { apiRequest } from '../../../api/client';
import { roleLabel } from '../../organizations/screenModel';
import { loadStageFacts, type DeskChecklistItem } from '../api';
import { loadSiteContacts, pickResponsible, type SiteContact } from '../stages/contactSearch';
import { isGeneratedProtocolText, parseMeetingNote, stageDeadline } from '../stages/firstMeeting';
import {
  IDENTIFY_NEED_SLA_DAYS,
  identifyCheckState,
  identifyChecklistItem,
  identifyClosePlan,
  inclusionForms,
  parseIdentifyNote,
  serializeIdentifyNote,
  type IdentifyNote,
} from '../stages/identifyNeed';

import formStyles from './FirstMeetingStage.module.scss';
import tileStyles from './ContactSearchStage.module.scss';
import StageFactTiles from './StageFactTiles';
import StageTaskChecklist from './StageTaskChecklist';

type DeskPerson = { id: string; name: string; role: string; roleCode: string };

type IdentifyNeedStageProps = {
  stageId: string;
  organizationId: string;
  meetingStageId: string | null;
  dueAt: string | null;
  programWindowId: string | null;
  ready: boolean;
  items: DeskChecklistItem[];
  fallbackPeople: DeskPerson[];
  readOnly: boolean;
  onCommit: (item: DeskChecklistItem, patch: Record<string, unknown>) => void;
  onBlockers: (labels: string[]) => void;
  onPlan: (plan: ReturnType<typeof identifyClosePlan>) => void;
};

type AcademicWindow = { id: string; title: string; classes_start_on: string };

const nextCustomId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? `custom-${crypto.randomUUID()}` : `custom-${Date.now()}`);

const IdentifyNeedStage = ({
  stageId,
  organizationId,
  meetingStageId,
  dueAt,
  programWindowId,
  ready,
  items,
  fallbackPeople,
  readOnly,
  onCommit,
  onBlockers,
  onPlan,
}: IdentifyNeedStageProps) => {
  const gap = organizationId.startsWith('gap-') || stageId.startsWith('gap-');
  const fact = identifyChecklistItem(items);
  const [contacts, setContacts] = useState<SiteContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [windows, setWindows] = useState<AcademicWindow[]>([]);
  const [note, setNote] = useState<IdentifyNote>(parseIdentifyNote(null));
  const [noteReady, setNoteReady] = useState(false);
  const [meetingNote, setMeetingNote] = useState('');
  const savedSignature = useRef('');
  const prefilled = useRef(false);
  const onCommitRef = useRef(onCommit);
  const onBlockersRef = useRef(onBlockers);
  const onPlanRef = useRef(onPlan);
  const fallbackRef = useRef(fallbackPeople);
  onCommitRef.current = onCommit;
  onBlockersRef.current = onBlockers;
  onPlanRef.current = onPlan;
  fallbackRef.current = fallbackPeople;

  useEffect(() => {
    let cancelled = false;
    setContactsLoading(true);
    if (gap) {
      setContacts(fallbackRef.current.map((person, index) => ({
        id: person.id,
        name: person.name,
        roleCode: person.roleCode || 'other',
        position: '',
        email: '',
        phone: '',
        primary: index === 0,
        active: true,
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
    if (gap || !meetingStageId) return;
    let cancelled = false;
    loadStageFacts(meetingStageId)
      .then((facts) => {
        if (cancelled) return;
        const dateItem = facts.checklist.find((item) => item.code === 'meeting_date' || item.itemType === 'date');
        const parsed = parseMeetingNote(dateItem?.valueText);
        setMeetingNote(isGeneratedProtocolText(parsed.note) ? '' : parsed.note.trim());
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [gap, meetingStageId]);

  useEffect(() => {
    if (gap) return;
    let cancelled = false;
    apiRequest<AcademicWindow[]>('/api/academic-windows')
      .then((rows) => { if (!cancelled) setWindows(rows); })
      .catch(() => { if (!cancelled) message.error('Не удалось загрузить учебные периоды'); });
    return () => { cancelled = true; };
  }, [gap]);

  useEffect(() => {
    if (!ready || noteReady) return;
    const parsed = parseIdentifyNote(fact?.valueText);
    if (!parsed.windowId && programWindowId) parsed.windowId = programWindowId;
    setNote(parsed);
    setNoteReady(true);
  }, [ready, noteReady, fact?.valueText, programWindowId]);

  useEffect(() => {
    if (!noteReady || prefilled.current || !meetingNote || note.reason.trim()) return;
    prefilled.current = true;
    setNote((current) => current.reason.trim() ? current : { ...current, reason: meetingNote });
  }, [noteReady, meetingNote, note.reason]);

  const responsible = pickResponsible(contacts, null);
  const pending = !ready || !noteReady || contactsLoading;
  const deadline = stageDeadline(dueAt, IDENTIFY_NEED_SLA_DAYS, dayjs());
  const checks = identifyCheckState(note);
  const plan = identifyClosePlan(note);
  const signature = serializeIdentifyNote(note);

  useEffect(() => {
    if (pending) return;
    onBlockersRef.current(plan.hint ? [plan.hint] : []);
    onPlanRef.current(plan);
    const handle = window.setTimeout(() => {
      if (savedSignature.current === signature || !fact) return;
      savedSignature.current = signature;
      onCommitRef.current(fact, {
        value_text: signature,
        is_done: plan.enabled,
        keepLocal: true,
      });
    }, 400);
    return () => window.clearTimeout(handle);
  }, [pending, signature, plan, fact]);

  const customRows = note.order.flatMap((id) => {
    const item = note.custom.find((row) => row.id === id);
    return item ? [item] : [];
  });
  const windowOptions = windows.map((item) => ({ value: item.id, label: item.title }));
  if (note.windowId && !windowOptions.some((item) => item.value === note.windowId)) {
    windowOptions.unshift({ value: note.windowId, label: 'Окно захода' });
  }

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
          <span>Обоснование потребности</span>
          <Input.TextArea
            disabled={readOnly || pending}
            value={note.reason}
            autoSize={{ minRows: 4, maxRows: 8 }}
            placeholder="Зачем площадке этот продукт, не короче 40 знаков"
            onChange={(event) => setNote((current) => ({ ...current, reason: event.target.value }))}
          />
        </label>
        <label className={formStyles.field}>
          <span>Форма включения в учебный процесс</span>
          <Select
            placeholder="Выберите форму"
            disabled={readOnly || pending}
            value={note.format ?? undefined}
            options={inclusionForms.map((item) => ({ value: item.value, label: item.label }))}
            onChange={(value) => setNote((current) => ({ ...current, format: value }))}
          />
        </label>
        <label className={formStyles.field}>
          <span>Целевой учебный период</span>
          <Select
            placeholder={windows.length === 0 ? 'Периоды не загрузились' : 'Выберите период'}
            disabled={readOnly || pending || windows.length === 0}
            value={note.windowId ?? undefined}
            options={windowOptions}
            onChange={(value) => setNote((current) => ({ ...current, windowId: value }))}
          />
        </label>
        <label className={formStyles.field}>
          <span>Ограничения и риски</span>
          <Input.TextArea
            disabled={readOnly || pending}
            value={note.limits}
            autoSize={{ minRows: 2, maxRows: 5 }}
            placeholder="Необязательно: что может помешать запуску"
            onChange={(event) => setNote((current) => ({ ...current, limits: event.target.value }))}
          />
        </label>
      </div>
      {!windows.length && !gap && <Alert style={{ marginTop: 12 }} type="warning" showIcon message="Справочник учебных периодов не загрузился. Поле останется пустым, пока сервер не ответит." />}
      <StageTaskChecklist
        readOnly={readOnly}
        system={[
          { id: 'reason', label: 'Обоснование потребности заполнено', done: checks.reason, required: true },
          { id: 'format', label: 'Форма включения указана', done: checks.format, required: true },
          { id: 'window', label: 'Учебный период выбран', done: checks.window, required: true },
          { id: 'limits', label: 'Ограничения зафиксированы', done: checks.limits },
        ]}
        custom={customRows}
        onAdd={(label) => {
          const id = nextCustomId();
          setNote((current) => ({ ...current, custom: [...current.custom, { id, label, done: false }], order: [...current.order, id] }));
        }}
        onReorder={(order) => setNote((current) => ({ ...current, order }))}
        onToggle={(id) => setNote((current) => ({ ...current, custom: current.custom.map((row) => row.id === id ? { ...row, done: !row.done } : row) }))}
        onDelete={(id) => setNote((current) => ({ ...current, custom: current.custom.filter((row) => row.id !== id), order: current.order.filter((item) => item !== id) }))}
        onRename={(id, label) => setNote((current) => ({ ...current, custom: current.custom.map((row) => row.id === id ? { ...row, label } : row) }))}
      />
    </div>
  );
};

export default IdentifyNeedStage;
