import type { CustomChecklistItem } from './contactSearch';

export const START_CLASSES_SLA_DAYS = 7;
export const START_SHIFT_DAYS = 7;

export const startChecks = [
  { id: 'carrier', label: 'Носитель «ведёт»' },
  { id: 'access', label: 'Доступ передан' },
  { id: 'plan', label: 'Учебный план закрыт' },
  { id: 'date', label: 'Дата старта указана' },
  { id: 'confirmed', label: 'Старт подтверждён' },
] as const;

export type StartDraft = { comment: string; confirmed: boolean; order: string[]; custom: CustomChecklistItem[] };
export const emptyStartDraft = (): StartDraft => ({ comment: '', confirmed: false, order: [], custom: [] });

export const parseStartDraft = (raw: string | null | undefined): StartDraft => {
  const empty = emptyStartDraft();
  if (!raw?.trim()) return empty;
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (data.v !== 1) return { ...empty, comment: raw.trim() };
    const custom = Array.isArray(data.custom)
      ? data.custom.flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const row = item as CustomChecklistItem;
        if (!row.id || !row.label?.trim()) return [];
        return [{ id: row.id, label: row.label.trim(), done: Boolean(row.done) }];
      })
      : [];
    const known = new Set(custom.map((item) => item.id));
    const order = Array.isArray(data.order) ? data.order.filter((id): id is string => typeof id === 'string' && known.has(id)) : [];
    for (const item of custom) if (!order.includes(item.id)) order.push(item.id);
    return { comment: typeof data.comment === 'string' ? data.comment : '', confirmed: data.confirmed === true, order, custom };
  } catch {
    return { ...empty, comment: raw.trim() };
  }
};

export const serializeStartDraft = (draft: StartDraft) => JSON.stringify({ v: 1, ...draft });

export const startClosePlan = (input: { carrierActive: boolean; accessReady: boolean; planClosed: boolean; startedOn: string | null; confirmed: boolean; comment: string; commentRequired: boolean }) => ({
  button: 'Закрыть и перейти к ведению занятий',
  enabled: input.carrierActive && input.accessReady && input.planClosed && Boolean(input.startedOn) && input.confirmed && (!input.commentRequired || input.comment.trim().length > 0),
  hint: null as string | null,
});

export type StartClosePlan = ReturnType<typeof startClosePlan>;
