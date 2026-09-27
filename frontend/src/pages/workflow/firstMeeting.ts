import dayjs, { type Dayjs } from 'dayjs';

import type { CustomChecklistItem } from './contactSearch';

/** Срок «Первая встреча» в сиде плейбука: default_duration_days = 7. */
export const FIRST_MEETING_SLA_DAYS = 7;
export const MEETING_NOTE_MIN = 40;
export const MEETING_PROTOCOL_KIND = 'meeting_protocol';

export const meetingOutcomes = [
  { value: 'go_product', label: 'Идём в продукт' },
  { value: 'another_meeting', label: 'Нужна ещё встреча' },
  { value: 'not_relevant', label: 'Не актуально' },
] as const;

export type MeetingOutcome = (typeof meetingOutcomes)[number]['value'];

export const meetingChecks = [
  { code: 'slot', label: 'Дата встречи указана', required: true },
  { code: 'participant', label: 'Участник от вуза выбран', required: true },
  { code: 'outcome', label: 'Итог встречи указан', required: false },
  { code: 'proof', label: 'Есть протокол или заметка', required: true },
] as const;

export type MeetingCheckCode = (typeof meetingChecks)[number]['code'];

export type MeetingNote = {
  time: string | null;
  outcome: MeetingOutcome | null;
  note: string;
  source: string | null;
  order: string[];
  custom: CustomChecklistItem[];
};

export const emptyMeetingNote = (): MeetingNote => ({
  time: null,
  outcome: null,
  note: '',
  source: null,
  order: [],
  custom: [],
});

const isOutcome = (value: string): value is MeetingOutcome => meetingOutcomes.some((item) => item.value === value);

export const parseMeetingNote = (raw: string | null | undefined): MeetingNote => {
  if (!raw?.trim()) return emptyMeetingNote();
  try {
    const data = JSON.parse(raw) as { v?: number; time?: unknown; outcome?: unknown; note?: unknown; source?: unknown; order?: unknown; custom?: unknown };
    if (data.v !== 1) return emptyMeetingNote();
    const custom = Array.isArray(data.custom)
      ? data.custom.flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const row = item as CustomChecklistItem;
        if (!row.id || !row.label?.trim()) return [];
        return [{ id: row.id, label: row.label.trim(), done: Boolean(row.done) }];
      })
      : [];
    const known = new Set(custom.map((item) => item.id));
    const order = Array.isArray(data.order)
      ? data.order.filter((id): id is string => typeof id === 'string' && known.has(id))
      : [];
    for (const item of custom) if (!order.includes(item.id)) order.push(item.id);
    return {
      time: typeof data.time === 'string' && /^\d{2}:\d{2}$/.test(data.time) ? data.time : null,
      outcome: typeof data.outcome === 'string' && isOutcome(data.outcome) ? data.outcome : null,
      note: typeof data.note === 'string' ? data.note : '',
      source: typeof data.source === 'string' && data.source.trim() ? data.source : null,
      order,
      custom,
    };
  } catch {
    return emptyMeetingNote();
  }
};

export const serializeMeetingNote = (note: MeetingNote) => JSON.stringify({
  v: 1,
  time: note.time,
  outcome: note.outcome,
  note: note.note,
  source: note.source,
  order: note.order,
  custom: note.custom,
});

export const meetingWhen = (date: string | null | undefined, time: string | null) => {
  if (!date || !time || !dayjs(date).isValid()) return null;
  const [hour, minute] = time.split(':').map((part) => Number(part));
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return dayjs(date).hour(hour).minute(minute).second(0).millisecond(0);
};

export const meetingProof = (note: string, hasProtocolFile: boolean) => hasProtocolFile || note.trim().length >= MEETING_NOTE_MIN;

export const meetingCheckState = (input: {
  when: Dayjs | null;
  participantId: string | null;
  outcome: MeetingOutcome | null;
  note: string;
  hasProtocolFile: boolean;
}): Record<MeetingCheckCode, boolean> => ({
  slot: Boolean(input.when),
  participant: Boolean(input.participantId),
  outcome: Boolean(input.outcome),
  proof: meetingProof(input.note, input.hasProtocolFile),
});

export type MeetingClosePlan = {
  action: 'forward' | 'stay' | 'refuse';
  button: string;
  enabled: boolean;
  hint: string | null;
  note: string;
};

const joinMissing = (items: string[]) => {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} и ${items[items.length - 1]}`;
};

export const meetingClosePlan = (input: {
  when: Dayjs | null;
  participantId: string | null;
  outcome: MeetingOutcome | null;
  note: string;
  hasProtocolFile: boolean;
}): MeetingClosePlan => {
  const state = meetingCheckState(input);
  const noteText = input.note.trim();
  if (input.outcome === 'another_meeting') {
    return {
      action: 'stay',
      button: 'Закрыть и перейти к выявлению потребности',
      enabled: false,
      hint: 'Назначьте новую дату встречи.',
      note: noteText,
    };
  }
  if (input.outcome === 'not_relevant') {
    return {
      action: 'refuse',
      button: 'Закрыть заход',
      enabled: state.outcome && noteText.length > 0,
      hint: noteText.length > 0 ? null : 'Напишите в заметке, почему заход не актуален.',
      note: noteText,
    };
  }
  const missing: string[] = [];
  if (!state.slot) missing.push('дату встречи');
  if (!state.participant) missing.push('участника от вуза');
  if (!state.outcome) missing.push('итог встречи');
  if (!state.proof) missing.push('протокол или заметку от 40 знаков');
  return {
    action: 'forward',
    button: 'Закрыть и перейти к выявлению потребности',
    enabled: missing.length === 0,
    hint: missing.length === 0 ? null : `Чтобы перейти к выявлению потребности, укажите: ${joinMissing(missing)}.`,
    note: noteText,
  };
};

export const meetingRequired = (outcome: MeetingOutcome | null, code: MeetingCheckCode) => {
  if (code === 'outcome') return true;
  if (outcome === 'another_meeting' || outcome === 'not_relevant') return false;
  return code === 'slot' || code === 'participant' || code === 'proof';
};

export const protocolFileText = (name: string) => {
  const text = `Протокол встречи приложен файлом «${name.trim() || 'протокол'}».`;
  return text.length >= MEETING_NOTE_MIN ? text : `${text} Файл лежит в слоте протокола.`;
};

export const isGeneratedProtocolText = (text: string) => text.trim().startsWith('Протокол встречи приложен файлом');

export const stageDeadline = (dueAt: string | null | undefined, slaDays: number, now: Dayjs = dayjs()) => {
  const parsed = dueAt && dayjs(dueAt).isValid() ? dayjs(dueAt) : null;
  const date = (parsed ?? now.startOf('day').add(slaDays, 'day')).startOf('day');
  const daysLeft = date.diff(now.startOf('day'), 'day');
  const amount = Math.abs(daysLeft);
  const abs = amount % 100;
  const last = abs % 10;
  const word = abs > 10 && abs < 20 ? 'дней' : last === 1 ? 'день' : last >= 2 && last <= 4 ? 'дня' : 'дней';
  const caption = daysLeft === 0
    ? 'Последний день'
    : daysLeft < 0
      ? `Просрочен на ${amount} ${word}`
      : `${amount % 10 === 1 && amount % 100 !== 11 ? 'Остался' : 'Осталось'} ${amount} ${word}`;
  return {
    date,
    daysLeft,
    caption,
    origin: parsed ? 'От старта этапа' : `${slaDays} ${word} от сегодня`,
  };
};

export const meetingDeadline = (dueAt: string | null | undefined, now: Dayjs = dayjs()) => stageDeadline(dueAt, FIRST_MEETING_SLA_DAYS, now);

type ChecklistLike = { id: string; code: string; itemType: string; label: string };

export const meetingChecklistItems = <T extends ChecklistLike>(items: T[]) => ({
  date: items.find((item) => item.code === 'meeting_date') ?? items.find((item) => item.itemType === 'date') ?? null,
  participant: items.find((item) => item.code === 'meeting_participant') ?? items.find((item) => item.itemType === 'stakeholder_role') ?? null,
  protocol: items.find((item) => item.code === 'meeting_protocol') ?? items.find((item) => item.itemType === 'text') ?? null,
});
