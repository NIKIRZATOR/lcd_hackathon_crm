import dayjs, { type Dayjs } from 'dayjs';

import { apiRequest } from '../../../api/client';

/**
 * Срок «Поиск контакта» в сиде плейбука: default_duration_days = 3.
 * Бэк ставит due_at = started_at + это число, когда этап становится текущим.
 * Константа нужна только если due_at ещё не пришёл.
 */
export const FIND_CONTACT_SLA_DAYS = 3;

export const contactChecks = [
  { code: 'responsible', label: 'Ответственный найден', required: true },
  { code: 'channel', label: 'Есть телефон или почта', required: true },
  { code: 'role', label: 'Роль указана', required: false },
  { code: 'primary', label: 'Основной контакт выбран', required: false },
  { code: 'source', label: 'Источник контакта указан', required: false },
] as const;

export type ContactCheckCode = (typeof contactChecks)[number]['code'];

export type SiteContact = {
  id: string;
  name: string;
  roleCode: string;
  position: string;
  email: string;
  phone: string;
  primary: boolean;
  active: boolean;
};

export type CustomChecklistItem = {
  id: string;
  label: string;
  done: boolean;
};

export type ContactNote = {
  source: string | null;
  order: string[];
  custom: CustomChecklistItem[];
};

export type ChecklistRow =
  | { kind: 'system'; code: ContactCheckCode; label: string; required: boolean; done: boolean }
  | { kind: 'custom'; id: string; label: string; done: boolean };

export const contactSources = [
  { value: 'university_card', label: 'Карточка вуза' },
  { value: 'call', label: 'Звонок' },
  { value: 'email', label: 'Письмо' },
  { value: 'site', label: 'Сайт' },
  { value: 'event', label: 'Мероприятие' },
  { value: 'referral', label: 'Рекомендация' },
  { value: 'other', label: 'Другое' },
] as const;

const systemCodes = new Set<string>(contactChecks.map((item) => item.code));

export const daysWord = (amount: number) => {
  const abs = Math.abs(amount) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return 'дней';
  if (last === 1) return 'день';
  if (last >= 2 && last <= 4) return 'дня';
  return 'дней';
};

export const deadlineCaption = (daysLeft: number) => {
  if (daysLeft === 0) return 'Последний день';
  const amount = Math.abs(daysLeft);
  const word = daysWord(amount);
  if (daysLeft < 0) return `Просрочен на ${amount} ${word}`;
  const verb = amount % 10 === 1 && amount % 100 !== 11 ? 'Остался' : 'Осталось';
  return `${verb} ${amount} ${word}`;
};

export const contactDeadline = (dueAt: string | null | undefined, now: Dayjs = dayjs()) => {
  const parsed = dueAt && dayjs(dueAt).isValid() ? dayjs(dueAt) : null;
  const date = (parsed ?? now.startOf('day').add(FIND_CONTACT_SLA_DAYS, 'day')).startOf('day');
  const daysLeft = date.diff(now.startOf('day'), 'day');
  return {
    date,
    daysLeft,
    fromServer: Boolean(parsed),
    caption: deadlineCaption(daysLeft),
    origin: parsed ? 'От старта этапа' : `${FIND_CONTACT_SLA_DAYS} ${daysWord(FIND_CONTACT_SLA_DAYS)} от сегодня`,
  };
};

export const emptyContactNote = (): ContactNote => ({
  source: null,
  order: contactChecks.map((item) => item.code),
  custom: [],
});

const isCustomItem = (value: unknown): value is CustomChecklistItem => {
  if (!value || typeof value !== 'object') return false;
  const item = value as CustomChecklistItem;
  return typeof item.id === 'string' && item.id.trim() !== '' && !systemCodes.has(item.id) && typeof item.label === 'string' && typeof item.done === 'boolean';
};

export const normalizeContactNote = (note: ContactNote): ContactNote => {
  const custom = note.custom.filter((item) => isCustomItem(item) && item.label.trim()).map((item) => ({
    id: item.id,
    label: item.label.trim(),
    done: item.done,
  }));
  const customIds = new Set(custom.map((item) => item.id));
  const order: string[] = [];
  for (const id of note.order) {
    if (order.includes(id)) continue;
    if (systemCodes.has(id) || customIds.has(id)) order.push(id);
  }
  for (const item of contactChecks) if (!order.includes(item.code)) order.push(item.code);
  for (const item of custom) if (!order.includes(item.id)) order.push(item.id);
  const source = note.source?.trim() || null;
  return { source, order, custom };
};

export const parseContactNote = (raw: string | null | undefined): ContactNote => {
  if (!raw?.trim()) return emptyContactNote();
  try {
    const data = JSON.parse(raw) as { v?: number; source?: unknown; order?: unknown; custom?: unknown };
    if (data.v !== 1) return emptyContactNote();
    return normalizeContactNote({
      source: typeof data.source === 'string' ? data.source : null,
      order: Array.isArray(data.order) ? data.order.filter((id): id is string => typeof id === 'string') : [],
      custom: Array.isArray(data.custom) ? data.custom.filter(isCustomItem) : [],
    });
  } catch {
    return emptyContactNote();
  }
};

export const serializeContactNote = (note: ContactNote) => {
  const normalized = normalizeContactNote(note);
  return JSON.stringify({ v: 1, source: normalized.source, order: normalized.order, custom: normalized.custom });
};

export const evaluateContactChecks = (contact: SiteContact | null, source: string | null): Record<ContactCheckCode, boolean> => ({
  responsible: Boolean(contact?.name.trim()),
  channel: Boolean(contact && (contact.phone.trim() || contact.email.trim())),
  role: Boolean(contact?.roleCode.trim()),
  primary: Boolean(contact?.primary),
  source: Boolean(source?.trim()),
});

export const contactBlockerLabels = (checks: Record<ContactCheckCode, boolean>) => contactChecks
  .filter((item) => item.required && !checks[item.code])
  .map((item) => item.label);

export const checklistRows = (note: ContactNote, checks: Record<ContactCheckCode, boolean>): ChecklistRow[] => {
  const normalized = normalizeContactNote(note);
  const customById = new Map(normalized.custom.map((item) => [item.id, item]));
  return normalized.order.flatMap((id): ChecklistRow[] => {
    const system = contactChecks.find((item) => item.code === id);
    if (system) return [{ kind: 'system', code: system.code, label: system.label, required: system.required, done: checks[system.code] }];
    const custom = customById.get(id);
    return custom ? [{ kind: 'custom', id: custom.id, label: custom.label, done: custom.done }] : [];
  });
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

export const loadSiteContacts = (organizationId: string) => apiRequest<ApiStakeholder[]>(`/api/organizations/${organizationId}/stakeholders`)
  .then((rows) => rows
    .map((row): SiteContact => ({
      id: row.id,
      name: row.full_name?.trim() ?? '',
      roleCode: row.role_code?.trim() || 'other',
      position: row.position?.trim() ?? '',
      email: row.email?.trim() ?? '',
      phone: row.phone?.trim() ?? '',
      primary: Boolean(row.is_primary),
      active: row.is_active !== false,
    }))
    .filter((contact) => contact.active));

export const pickResponsible = (contacts: SiteContact[], stakeholderId: string | null) => {
  const active = contacts.filter((item) => item.active);
  return active.find((item) => item.primary) ?? active.find((item) => item.id === stakeholderId) ?? null;
};

export const contactInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');
};

export const isStoredChecklistId = (id?: string | null) => Boolean(id && !id.startsWith('local-') && !id.startsWith('gap-'));

const cacheKey = (stageId: string) => `rtk-eduflow:find-contact:${stageId}`;

export const readContactNoteCache = (stageId: string): ContactNote | null => {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(cacheKey(stageId));
  return raw ? parseContactNote(raw) : null;
};

export const writeContactNoteCache = (stageId: string, note: ContactNote) => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(cacheKey(stageId), serializeContactNote(note));
};

type ChecklistLike = { itemType: string; code: string };

export const findContactChecklistItem = <T extends ChecklistLike>(items: T[]) => items.find((item) => item.itemType === 'stakeholder_role')
  ?? items.find((item) => item.code === 'contact')
  ?? null;
