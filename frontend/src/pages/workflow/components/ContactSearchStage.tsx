import { PlusOutlined } from '@ant-design/icons';
import { Alert, Tooltip, message } from 'antd';
import { useEffect, useRef, useState } from 'react';

import { ApiError, apiRequest } from '../../../api/client';
import { createStakeholder, updateStakeholder, type StakeholderDraft } from '../../organizations/api';
import { roleLabel, stakeholderRoles } from '../../organizations/screenModel';
import type { DeskChecklistItem } from '../api';
import {
  checklistRows,
  contactBlockerLabels,
  contactDeadline,
  contactChecks,
  contactInitials,
  emptyContactNote,
  evaluateContactChecks,
  isStoredChecklistId,
  normalizeContactNote,
  parseContactNote,
  pickResponsible,
  readContactNoteCache,
  serializeContactNote,
  writeContactNoteCache,
  type ContactNote,
  type SiteContact,
} from '../stages/contactSearch';

import SiteContactModal, { type SiteContactFormValues } from './SiteContactModal';
import StageFactTiles from './StageFactTiles';
import StageTaskChecklist from './StageTaskChecklist';

import styles from './ContactSearchStage.module.scss';

type DeskPerson = { id: string; name: string; role: string; roleCode: string };

type ContactSearchStageProps = {
  stageId: string;
  organizationId: string;
  dueAt: string | null;
  ready: boolean;
  contactItem: DeskChecklistItem | null;
  fallbackPeople: DeskPerson[];
  readOnly: boolean;
  onCommit: (item: DeskChecklistItem, patch: Record<string, unknown>) => void;
  onBlockers: (labels: string[]) => void;
  onPeopleChange: (people: DeskPerson[]) => void;
};

type EditorState = { mode: 'create' } | { mode: 'edit'; id: string };

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

const errorText = (error: unknown) => {
  if (!(error instanceof ApiError)) return 'Не удалось сохранить контакт';
  const payload = error.payload as { message?: string; detail?: string | { message?: string } } | undefined;
  if (typeof payload?.detail === 'string') return payload.detail;
  if (payload?.detail && typeof payload.detail === 'object' && payload.detail.message) return payload.detail.message;
  return payload?.message || error.message;
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

const toDeskPerson = (contact: SiteContact): DeskPerson => ({
  id: contact.id,
  name: contact.name,
  role: contact.roleCode,
  roleCode: contact.roleCode,
});

const draftOf = (contact: Pick<SiteContact, 'roleCode' | 'name' | 'position' | 'email' | 'phone' | 'primary'>): StakeholderDraft => ({
  roleCode: stakeholderRoles.some((role) => role.value === contact.roleCode) ? contact.roleCode : 'other',
  name: contact.name,
  position: contact.position,
  email: contact.email,
  phone: contact.phone,
  isPrimary: contact.primary,
});

const nextCustomId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? `custom-${crypto.randomUUID()}` : `custom-${Date.now()}`);

const loadContacts = (organizationId: string) => apiRequest<ApiStakeholder[]>(`/api/organizations/${organizationId}/stakeholders`)
  .then((rows) => rows.map(mapContact).filter((contact) => contact.active));

const ContactSearchStage = ({
  stageId,
  organizationId,
  dueAt,
  ready,
  contactItem,
  fallbackPeople,
  readOnly,
  onCommit,
  onBlockers,
  onPeopleChange,
}: ContactSearchStageProps) => {
  const gap = organizationId.startsWith('gap-') || stageId.startsWith('gap-');
  const [contacts, setContacts] = useState<SiteContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [contactsError, setContactsError] = useState('');
  const [note, setNote] = useState<ContactNote>(emptyContactNote);
  const [noteReady, setNoteReady] = useState(false);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const savedSignature = useRef('');
  const onCommitRef = useRef(onCommit);
  const onBlockersRef = useRef(onBlockers);
  const onPeopleChangeRef = useRef(onPeopleChange);
  const fallbackRef = useRef(fallbackPeople);
  onCommitRef.current = onCommit;
  onBlockersRef.current = onBlockers;
  onPeopleChangeRef.current = onPeopleChange;
  fallbackRef.current = fallbackPeople;

  useEffect(() => {
    let cancelled = false;
    setContactsLoading(true);
    setContactsError('');
    if (gap) {
      setContacts(fallbackRef.current.map((person, index) => ({
        id: person.id,
        name: person.name,
        roleCode: person.roleCode,
        position: '',
        email: '',
        phone: '',
        primary: index === 0,
        active: true,
      })));
      setContactsLoading(false);
      return () => { cancelled = true; };
    }
    loadContacts(organizationId)
      .then((loaded) => { if (!cancelled) setContacts(loaded); })
      .catch(() => { if (!cancelled) setContactsError('Не удалось прочитать контакты площадки'); })
      .finally(() => { if (!cancelled) setContactsLoading(false); });
    return () => { cancelled = true; };
  }, [gap, organizationId]);

  useEffect(() => {
    if (!ready || noteReady) return;
    const fromServer = contactItem?.valueText?.trim();
    setNote(fromServer ? parseContactNote(fromServer) : readContactNoteCache(stageId) ?? emptyContactNote());
    setNoteReady(true);
  }, [ready, noteReady, stageId, contactItem?.valueText]);

  const responsible = pickResponsible(contacts, contactItem?.stakeholderId ?? null);
  const checks = evaluateContactChecks(responsible, note.source);
  const blockers = contactBlockerLabels(checks);
  const rows = checklistRows(note, checks);
  const deadline = contactDeadline(dueAt);
  const pending = !ready || !noteReady || contactsLoading;
  const signature = [
    responsible?.id ?? '',
    responsible?.name ?? '',
    responsible?.phone ?? '',
    responsible?.email ?? '',
    responsible?.roleCode ?? '',
    responsible?.primary ? '1' : '0',
    serializeContactNote(note),
  ].join('|');

  useEffect(() => {
    if (pending) return;
    onBlockersRef.current(blockers);
    if (savedSignature.current === signature) return;
    savedSignature.current = signature;
    const text = serializeContactNote(note);
    const stakeholderId = responsible?.id ?? null;
    const done = checks.responsible && checks.channel;
    if (!contactItem || !isStoredChecklistId(contactItem.id)) writeContactNoteCache(stageId, note);
    if (!contactItem) return;
    const drifted = contactItem.stakeholderId !== stakeholderId || contactItem.done !== done || (contactItem.valueText ?? '') !== text;
    if (!drifted) return;
    onCommitRef.current(contactItem, { stakeholder_id: stakeholderId, value_text: text, is_done: done, keepLocal: true });
  }, [pending, signature, blockers, checks, note, responsible, contactItem, stageId]);

  const publishPeople = (loaded: SiteContact[]) => onPeopleChangeRef.current(loaded.map(toDeskPerson));

  const reloadLive = async () => {
    const loaded = await loadContacts(organizationId);
    setContacts(loaded);
    publishPeople(loaded);
    return loaded;
  };

  const openEditor = () => {
    if (readOnly || pending) return;
    setEditor(responsible ? { mode: 'edit', id: responsible.id } : { mode: 'create' });
  };

  const assign = async (contact: SiteContact) => {
    if (readOnly || saving || (contact.primary && responsible?.id === contact.id)) return;
    if (gap) {
      setContacts((current) => current.map((item) => ({ ...item, primary: item.id === contact.id })));
      publishPeople(contacts.map((item) => ({ ...item, primary: item.id === contact.id })));
      return;
    }
    setSaving(true);
    try {
      await updateStakeholder(contact.id, draftOf({ ...contact, primary: true }));
      await reloadLive();
      message.success('Ответственный обновлён');
    } catch (reason) {
      message.error(errorText(reason));
    } finally {
      setSaving(false);
    }
  };

  const submitContact = async (values: SiteContactFormValues) => {
    const next = {
      roleCode: values.roleCode,
      name: values.name.trim(),
      phone: values.phone.trim(),
      email: values.email.trim(),
      primary: values.primary,
    };
    if (gap) {
      const createdId = `gap-person-${Date.now()}`;
      const nextContacts = editor?.mode === 'edit'
        ? contacts.map((item) => {
          if (item.id !== editor.id) return next.primary ? { ...item, primary: false } : item;
          return { ...item, ...next, position: item.position };
        })
        : [...(next.primary ? contacts.map((item) => ({ ...item, primary: false })) : contacts), { id: createdId, ...next, position: '', active: true }];
      setContacts(nextContacts);
      publishPeople(nextContacts);
      setEditor(null);
      return;
    }
    const editing = editor?.mode === 'edit' ? contacts.find((item) => item.id === editor.id) : null;
    setSaving(true);
    try {
      const draft = draftOf({ ...next, position: editing?.position ?? '' });
      if (editing) await updateStakeholder(editing.id, draft);
      else await createStakeholder(organizationId, draft);
      await reloadLive();
      setEditor(null);
      message.success(editing ? 'Контакт обновлён' : 'Контакт добавлен');
    } catch (reason) {
      message.error(errorText(reason));
    } finally {
      setSaving(false);
    }
  };

  const editorPerson = editor?.mode === 'edit' ? contacts.find((item) => item.id === editor.id) ?? null : null;
  const dueState = deadline.daysLeft < 0 ? 'late' : deadline.daysLeft === 0 ? 'today' : 'ok';
  const customTasks = rows.flatMap((row) => row.kind === 'custom' ? [{ id: row.id, label: row.label, done: row.done }] : []);

  return (
    <div className={styles.root}>
      {contactsError && <Alert style={{ marginBottom: 12 }} type="error" showIcon message={contactsError} />}
      <StageFactTiles
        tiles={[
          {
            kind: 'person',
            label: 'Ответственный',
            value: responsible?.name ?? '',
            empty: responsible ? 'ФИО не найдено' : 'Контакт не найден',
            hint: responsible?.name.trim() ? [roleLabel(responsible.roleCode), responsible.primary ? 'основной' : ''].filter(Boolean).join(' · ') : undefined,
            pending,
            onClick: openEditor,
            disabled: readOnly || pending,
          },
          { kind: 'phone', label: 'Телефон', value: responsible?.phone ?? '', empty: 'Телефон не найден', pending, onClick: openEditor, disabled: readOnly || pending },
          { kind: 'mail', label: 'Почта', value: responsible?.email ?? '', empty: 'Почта не найдена', pending, onClick: openEditor, disabled: readOnly || pending },
          { kind: 'due', label: 'Срок', value: deadline.date.format('D MMMM YYYY'), hint: `${deadline.caption} · ${deadline.origin}`, dueState },
        ]}
      />

      <div className={styles.sectionHead}>
        <div>
          <h3>Контакты площадки</h3>
          <p className={styles.sectionHint}>Основной контакт из карточки вуза подставляется сам. Нажмите на человека, чтобы назначить его ответственным.</p>
        </div>
      </div>
      {pending ? <p className={styles.loadNote}>Загружаем контакты площадки…</p> : (
        <div className={styles.peopleScroll}>
          <div className={styles.people}>
          {contacts.map((contact) => {
            const roleName = roleLabel(contact.roleCode);
            const position = contact.position && contact.position !== roleName ? `${roleName} · ${contact.position}` : roleName;
            const channel = [contact.phone, contact.email].filter(Boolean).join(' · ');
            const current = responsible?.id === contact.id;
            const fullName = contact.name || 'Без ФИО';
            return (
              <Tooltip
                key={contact.id}
                title={(
                  <span className={styles.personTip}>
                    <strong>{fullName}</strong>
                    <span>{position}</span>
                    {contact.phone && <span>{contact.phone}</span>}
                    {contact.email && <span>{contact.email}</span>}
                  </span>
                )}
              >
                <button
                  type="button"
                  className={`${styles.person} ${current ? styles.personCurrent : ''}`}
                  aria-pressed={current}
                  disabled={readOnly || saving}
                  onClick={() => void assign(contact)}
                >
                  <span className={styles.avatar}>{contactInitials(contact.name)}</span>
                  <span className={styles.personBody}>
                    <strong>{fullName}</strong>
                    <span className={styles.personMeta}>{position}</span>
                    {channel && <span className={styles.personMeta}>{channel}</span>}
                    {contact.primary && <span className={styles.pill}>Основной</span>}
                  </span>
                </button>
              </Tooltip>
            );
          })}
          {!readOnly && (
            <button type="button" className={styles.addPerson} onClick={() => setEditor({ mode: 'create' })}>
              <span aria-hidden="true"><PlusOutlined /></span> Добавить контакт
            </button>
          )}
          </div>
        </div>
      )}

      <StageTaskChecklist
        readOnly={readOnly}
        system={rows.flatMap((row) => row.kind === 'system' ? [{ id: row.code, label: row.label, done: row.done, required: row.required }] : [])}
        custom={customTasks}
        onAdd={(label) => {
          const id = nextCustomId();
          setNote((current) => normalizeContactNote({ ...current, custom: [...current.custom, { id, label, done: false }], order: [...current.order, id] }));
        }}
        onReorder={(order) => setNote((current) => ({ ...current, order: [...contactChecks.map((item) => item.code), ...order] }))}
        onToggle={(id) => setNote((current) => ({
          ...current,
          custom: current.custom.map((item) => item.id === id ? { ...item, done: !item.done } : item),
        }))}
        onDelete={(id) => setNote((current) => normalizeContactNote({
          ...current,
          custom: current.custom.filter((item) => item.id !== id),
          order: current.order.filter((item) => item !== id),
        }))}
        onRename={(id, label) => setNote((current) => normalizeContactNote({
          ...current,
          custom: current.custom.map((item) => item.id === id ? { ...item, label } : item),
        }))}
      />

      <SiteContactModal
        open={Boolean(editor)}
        mode={editor?.mode ?? 'create'}
        saving={saving}
        contact={editorPerson}
        defaultPrimary={!contacts.some((item) => item.primary)}
        source={note.source}
        onSourceChange={(value) => setNote((current) => ({ ...current, source: value }))}
        onCancel={() => setEditor(null)}
        onSubmit={(values) => void submitContact(values)}
      />
    </div>
  );
};

export default ContactSearchStage;
