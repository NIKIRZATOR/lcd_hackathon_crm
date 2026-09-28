import type { CustomChecklistItem } from './contactSearch';

export const CURRICULUM_SLA_DAYS = 14;
export const CURRICULUM_NOTE_MIN = 40;
export const PLAN_FILE_KIND = 'plan';

export const curriculumChecks = [
  { id: 'carrier', label: 'Носитель «ведёт»', required: true },
  { id: 'access', label: 'Доступ передан', required: true },
  { id: 'plan', label: 'Есть план или комментарий', required: true },
  { id: 'window', label: 'Окно выбрано', required: false },
] as const;

export type CurriculumCheckId = (typeof curriculumChecks)[number]['id'];

export type CurriculumDraft = { comment: string; windowId: string | null; order: string[]; custom: CustomChecklistItem[] };

export const emptyCurriculumDraft = (): CurriculumDraft => ({ comment: '', windowId: null, order: [], custom: [] });

export const parseCurriculumDraft = (raw: string | null | undefined): CurriculumDraft => {
  const empty = emptyCurriculumDraft();
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
    return { comment: typeof data.comment === 'string' ? data.comment : '', windowId: typeof data.windowId === 'string' ? data.windowId : null, order, custom };
  } catch {
    return { ...empty, comment: raw.trim() };
  }
};

export const serializeCurriculumDraft = (draft: CurriculumDraft) => JSON.stringify({ v: 1, ...draft });

export const curriculumClosePlan = (input: { carrierActive: boolean; accessReady: boolean; hasPlan: boolean; comment: string; windowId: string | null }) => ({
  button: 'Закрыть и перейти к старту занятий',
  enabled: input.carrierActive && input.accessReady && (input.hasPlan || input.comment.trim().length >= CURRICULUM_NOTE_MIN),
  hint: null as string | null,
  windowId: input.windowId,
});

export type CurriculumClosePlan = ReturnType<typeof curriculumClosePlan>;
