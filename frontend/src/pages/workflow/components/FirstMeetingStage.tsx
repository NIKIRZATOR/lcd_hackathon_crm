import { DeleteOutlined, DownloadOutlined, FileImageOutlined, FileOutlined, FilePdfOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, DatePicker, Input, Select, Upload, message } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useRef, useState } from 'react';

import { ApiError, apiDownload, apiRequest } from '../../../api/client';
import { createStakeholder } from '../../organizations/api';
import { roleLabel } from '../../organizations/screenModel';
import type { DeskChecklistItem, DeskFile } from '../api';
import type { SiteContact } from '../stages/contactSearch';
import {
  MEETING_NOTE_MIN,
  MEETING_PROTOCOL_KIND,
  emptyMeetingNote,
  meetingChecklistItems,
  meetingClosePlan,
  meetingDeadline,
  meetingOutcomes,
  meetingRequired,
  meetingWhen,
  parseMeetingNote,
  isGeneratedProtocolText,
  protocolFileText,
  serializeMeetingNote,
  type MeetingNote,
  type MeetingOutcome,
} from '../stages/firstMeeting';
import { isAllowedWorkflowFile, workflowFileRejectionMessage } from '../shared/workflowFiles';

import SiteContactModal, { type SiteContactFormValues } from './SiteContactModal';
import StageFactTiles from './StageFactTiles';
import StageTaskChecklist from './StageTaskChecklist';

import tileStyles from './ContactSearchStage.module.scss';
import styles from './FirstMeetingStage.module.scss';

type DeskPerson = { id: string; name: string; role: string; roleCode: string };

type FirstMeetingStageProps = {
  stageId: string;
  organizationId: string;
  dueAt: string | null;
  ready: boolean;
  items: DeskChecklistItem[];
  files: DeskFile[];
  fallbackPeople: DeskPerson[];
  readOnly: boolean;
  onCommit: (item: DeskChecklistItem, patch: Record<string, unknown>) => void;
  onBlockers: (labels: string[]) => void;
  onPlan: (plan: ReturnType<typeof meetingClosePlan>) => void;
  onUpload: (file: File, kind: string | null) => Promise<DeskFile | void>;
  onDeleteFile: (file: DeskFile) => Promise<void>;
  onPeopleChange: (people: DeskPerson[]) => void;
};

type ApiStakeholder = {
  id: string;
  full_name?: string | null;
  role_code?: string | null;
  position?: string | null;
  email?: string | null;
  phone?: string | null;
  is_primary?: boolean;
  is_active?: boolean;
};

const mapContact = (row: ApiStakeholder): SiteContact => ({
  id: row.id,
  name: row.full_name?.trim() ?? '',
  roleCode: row.role_code?.trim() || 'other',
  position: row.position?.trim() ?? '',
  email: row.email?.trim() ?? '',
  phone: row.phone?.trim() ?? '',
  primary: Boolean(row.is_primary),
  active: row.is_active !== false,
});

const nextCustomId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? `custom-${crypto.randomUUID()}` : `custom-${Date.now()}`);

const FirstMeetingStage = ({
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
  onPeopleChange,
}: FirstMeetingStageProps) => {
  const gap = organizationId.startsWith('gap-') || stageId.startsWith('gap-');
  const slots = meetingChecklistItems(items);
  const [contacts, setContacts] = useState<SiteContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [note, setNote] = useState<MeetingNote>(emptyMeetingNote);
  const [noteReady, setNoteReady] = useState(false);
  const [participantId, setParticipantId] = useState<string | null>(slots.participant?.stakeholderId ?? null);
  const [slot, setSlot] = useState<dayjs.Dayjs | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const savedSignature = useRef('');
  const onCommitRef = useRef(onCommit);
  const onBlockersRef = useRef(onBlockers);
  const onPlanRef = useRef(onPlan);
  const onPeopleChangeRef = useRef(onPeopleChange);
  const fallbackRef = useRef(fallbackPeople);
  onCommitRef.current = onCommit;
  onBlockersRef.current = onBlockers;
  onPlanRef.current = onPlan;
  onPeopleChangeRef.current = onPeopleChange;
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
    apiRequest<ApiStakeholder[]>(`/api/organizations/${organizationId}/stakeholders`)
      .then((rows) => { if (!cancelled) setContacts(rows.map(mapContact).filter((contact) => contact.active)); })
      .catch(() => { if (!cancelled) message.error('Не удалось прочитать контакты площадки'); })
      .finally(() => { if (!cancelled) setContactsLoading(false); });
    return () => { cancelled = true; };
  }, [gap, organizationId]);

  useEffect(() => {
    if (!ready || noteReady) return;
    const parsed = parseMeetingNote(slots.date?.valueText);
    const protocolText = slots.protocol?.valueText?.trim() ?? '';
    if (isGeneratedProtocolText(parsed.note)) parsed.note = '';
    if (!parsed.note && protocolText && !protocolText.startsWith('{') && !isGeneratedProtocolText(protocolText)) parsed.note = protocolText;
    setNote(parsed);
    setSlot(meetingWhen(slots.date?.valueDate, parsed.time));
    setParticipantId(slots.participant?.stakeholderId ?? null);
    setNoteReady(true);
  }, [ready, noteReady, slots.date?.valueText, slots.participant?.stakeholderId, slots.protocol?.valueText]);

  const participant = contacts.find((contact) => contact.id === participantId) ?? null;
  const primary = contacts.find((contact) => contact.primary) ?? null;
  const protocolFiles = files.filter((file) => file.kind === MEETING_PROTOCOL_KIND || file.fileId === slots.protocol?.attachmentId);
  const hasProtocolFile = protocolFiles.length > 0;
  const plan = meetingClosePlan({
    when: slot,
    participantId,
    outcome: note.outcome,
    note: note.note,
    hasProtocolFile,
  });
  const pending = !ready || !noteReady || contactsLoading;
  const deadline = meetingDeadline(dueAt);
  const signature = [
    slot?.format('YYYY-MM-DD HH:mm') ?? '',
    participantId ?? '',
    note.outcome ?? '',
    note.note,
    hasProtocolFile ? 'file' : '',
    serializeMeetingNote(note),
  ].join('|');

  useEffect(() => {
    if (pending) return;
    if (!participantId && primary) setParticipantId(primary.id);
  }, [pending, participantId, primary]);

  useEffect(() => {
    if (pending) return;
    onBlockersRef.current(plan.hint ? [plan.hint] : []);
    onPlanRef.current(plan);
    const handle = window.setTimeout(() => {
      if (savedSignature.current === signature) return;
      savedSignature.current = signature;
    const text = serializeMeetingNote(note);
    if (slots.date) {
      onCommitRef.current(slots.date, {
        value_date: slot ? slot.format('YYYY-MM-DD') : null,
        value_text: text,
        is_done: Boolean(slot),
        keepLocal: true,
      });
    }
    if (slots.participant) {
      onCommitRef.current(slots.participant, {
        stakeholder_id: participantId,
        is_done: Boolean(participantId),
        keepLocal: true,
      });
    }
    if (slots.protocol) {
      const longNote = note.note.trim().length >= MEETING_NOTE_MIN ? note.note.trim() : null;
      const fileText = hasProtocolFile ? protocolFileText(protocolFiles[0]?.name ?? '') : null;
      const protocolText = longNote ?? fileText;
      onCommitRef.current(slots.protocol, {
        value_text: protocolText,
        attachment_id: protocolFiles[0]?.fileId ?? null,
        is_done: Boolean(protocolText),
        keepLocal: true,
      });
    }
    }, 400);
    return () => window.clearTimeout(handle);
  }, [pending, signature, plan, note, slot, participantId, slots.date, slots.participant, slots.protocol, hasProtocolFile, protocolFiles]);

  const personOptions = contacts.map((contact) => ({
    value: contact.id,
    label: `${contact.name || 'Без ФИО'} · ${roleLabel(contact.roleCode)}`,
  }));

  const setOutcome = (value: MeetingOutcome | null) => setNote((current) => ({ ...current, outcome: value }));

  const chooseSlot = (value: dayjs.Dayjs | null) => {
    if (!value) {
      setSlot(null);
      setNote((current) => ({ ...current, time: null }));
      return;
    }
    const minute = Math.round(value.minute() / 15) * 15;
    const snapped = minute >= 60 ? value.add(1, 'hour').minute(0).second(0).millisecond(0) : value.minute(minute).second(0).millisecond(0);
    setSlot(snapped);
    setNote((current) => ({ ...current, time: snapped.format('HH:mm') }));
  };

  const addPerson = async (values: SiteContactFormValues) => {
    const nextContact = {
      roleCode: values.roleCode,
      name: values.name.trim(),
      phone: values.phone.trim(),
      email: values.email.trim(),
      primary: values.primary,
    };
    if (gap) {
      const created: SiteContact = {
        id: `gap-person-${Date.now()}`,
        ...nextContact,
        position: '',
        active: true,
      };
      setContacts((current) => {
        const base = created.primary ? current.map((item) => ({ ...item, primary: false })) : current;
        return [...base, created];
      });
      setParticipantId(created.id);
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      const created = await createStakeholder(organizationId, { ...nextContact, position: '' }) as ApiStakeholder;
      const contact = mapContact({ ...created, full_name: created.full_name || nextContact.name, role_code: created.role_code || nextContact.roleCode, is_primary: nextContact.primary });
      setContacts((current) => {
        const base = contact.primary ? current.map((item) => ({ ...item, primary: false })) : current;
        return [...base, contact];
      });
      onPeopleChangeRef.current([...contacts.filter((item) => !contact.primary || item.id !== contact.id), contact].map((item) => ({
        id: item.id,
        name: item.name,
        role: item.roleCode,
        roleCode: item.roleCode,
      })));
      setParticipantId(contact.id);
      setOpen(false);
      message.success('Контакт добавлен');
    } catch (reason) {
      message.error(reason instanceof ApiError ? reason.message : 'Не удалось добавить контакт');
    } finally {
      setSaving(false);
    }
  };

  const customRows = note.order.flatMap((id) => {
    const item = note.custom.find((row) => row.id === id);
    return item ? [item] : [];
  });

  return (
    <div className={tileStyles.root}>
      <StageFactTiles
        tiles={[
          { kind: 'person', label: 'Участник', value: participant?.name ?? '', empty: 'Участник не выбран', hint: participant ? roleLabel(participant.roleCode) : undefined, pending },
          { kind: 'phone', label: 'Телефон', value: participant?.phone ?? '', empty: 'Телефон не найден', pending },
          { kind: 'mail', label: 'Почта', value: participant?.email ?? '', empty: 'Почта не найдена', pending },
          { kind: 'due', label: 'Срок', value: deadline.date.format('D MMMM YYYY'), hint: `${deadline.caption} · ${deadline.origin}`, dueState: deadline.daysLeft < 0 ? 'late' : deadline.daysLeft === 0 ? 'today' : 'ok' },
        ]}
      />

      <div className={styles.fields}>
        <label className={styles.field}>
          <span>Дата и время встречи</span>
          <DatePicker
            showTime={{ format: 'HH:mm', minuteStep: 15 }}
            format="D MMMM YYYY, HH:mm"
            needConfirm={false}
            style={{ width: '100%' }}
            disabled={readOnly || pending}
            value={slot}
            onChange={chooseSlot}
          />
        </label>
        <label className={styles.field}>
          <span>Участник от вуза</span>
          <div className={styles.participantRow}>
            <Select
              placeholder="Выберите контакт площадки"
              disabled={readOnly || pending}
              value={participantId ?? undefined}
              options={personOptions}
              onChange={(value) => setParticipantId(value)}
            />
            {!readOnly && <Button onClick={() => setOpen(true)}>Добавить контакт</Button>}
          </div>
        </label>
        <label className={styles.field}>
          <span>Итог встречи</span>
          <Select
            placeholder="Выберите итог"
            disabled={readOnly || pending}
            value={note.outcome ?? undefined}
            options={meetingOutcomes.map((item) => ({ value: item.value, label: item.label }))}
            onChange={(value) => setOutcome(value)}
          />
        </label>
        <label className={styles.field}>
          <span>{note.outcome === 'not_relevant' ? 'Причина в заметке' : 'Заметка'}</span>
          <Input.TextArea
            disabled={readOnly || pending}
            value={note.note}
            autoSize={{ minRows: 3, maxRows: 6 }}
            placeholder={note.outcome === 'not_relevant' ? 'Почему встреча не актуальна, не короче 40 знаков' : 'Протокол текстом, не короче 40 знаков, или приложите файл'}
            onChange={(event) => setNote((current) => ({ ...current, note: event.target.value }))}
          />
        </label>
        <div className={styles.field}>
          <span>Протокол</span>
          <div className={styles.fileSlot}>
            {protocolFiles.map((file) => {
              const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
              const image = ['png', 'jpg', 'jpeg'].includes(extension);
              const pdf = extension === 'pdf';
              const FileIcon = pdf ? FilePdfOutlined : image ? FileImageOutlined : FileOutlined;
              return (
                <div key={file.id} className={styles.fileCard}>
                  <span className={`${styles.fileMark} ${pdf ? styles.fileMarkPdf : ''}`} aria-hidden="true"><FileIcon /></span>
                  <span className={styles.fileName} title={file.name}>{file.name}</span>
                  <span className={styles.fileActions}>
                    <Button type="text" aria-label="Скачать" icon={<DownloadOutlined />} onClick={() => void apiDownload(`/api/workflows/attachments/${file.id}/download`).then((blob) => {
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = file.name;
                      link.click();
                      URL.revokeObjectURL(url);
                    })} />
                    {!readOnly && <Button type="text" danger aria-label="Удалить файл" icon={<DeleteOutlined />} onClick={() => void onDeleteFile(file)} />}
                  </span>
                </div>
              );
            })}
            {!readOnly && (
              <Upload
                accept=".png,.jpeg,.jpg,.pdf,.zip,.gz,.gzip,.rar,.doc,.docx,.xls,.xlsx"
                showUploadList={false}
                beforeUpload={(file) => {
                  if (!isAllowedWorkflowFile(file.name)) {
                    message.error(workflowFileRejectionMessage);
                    return Upload.LIST_IGNORE;
                  }
                  void onUpload(file, MEETING_PROTOCOL_KIND).catch(() => message.error('Не удалось приложить файл'));
                  return Upload.LIST_IGNORE;
                }}
              >
                <Button className={styles.addFile} type="dashed" icon={<PlusOutlined />}>Добавить протокол</Button>
              </Upload>
            )}
          </div>
        </div>
      </div>

      <StageTaskChecklist
        readOnly={readOnly}
        system={[
          { id: 'slot', label: 'Дата встречи указана', done: Boolean(slot), required: meetingRequired(note.outcome, 'slot') },
          { id: 'participant', label: 'Участник от вуза выбран', done: Boolean(participantId), required: meetingRequired(note.outcome, 'participant') },
          { id: 'outcome', label: 'Итог встречи указан', done: Boolean(note.outcome), required: true },
          { id: 'proof', label: 'Есть протокол или заметка', done: hasProtocolFile || note.note.trim().length >= MEETING_NOTE_MIN, required: meetingRequired(note.outcome, 'proof') },
        ]}
        custom={customRows}
        onAdd={(label) => {
          const id = nextCustomId();
          setNote((current) => ({ ...current, custom: [...current.custom, { id, label, done: false }], order: [...current.order, id] }));
        }}
        onReorder={(order) => setNote((current) => ({ ...current, order }))}
        onToggle={(id) => setNote((current) => ({
          ...current,
          custom: current.custom.map((row) => row.id === id ? { ...row, done: !row.done } : row),
        }))}
        onDelete={(id) => setNote((current) => ({
          ...current,
          custom: current.custom.filter((row) => row.id !== id),
          order: current.order.filter((item) => item !== id),
        }))}
        onRename={(id, label) => setNote((current) => ({
          ...current,
          custom: current.custom.map((row) => row.id === id ? { ...row, label } : row),
        }))}
      />

      <SiteContactModal
        open={open}
        mode="create"
        saving={saving}
        defaultPrimary={!contacts.some((item) => item.primary)}
        source={note.source}
        onSourceChange={(value) => setNote((current) => ({ ...current, source: value }))}
        onCancel={() => setOpen(false)}
        onSubmit={(values) => void addPerson(values)}
      />
    </div>
  );
};

export default FirstMeetingStage;
