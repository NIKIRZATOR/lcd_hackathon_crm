import type { CustomChecklistItem } from './contactSearch';

export const IDENTIFY_NEED_SLA_DAYS = 5;
export const NEED_REASON_MIN = 40;

export const inclusionForms = [
  { value: 'discipline', label: 'Дисциплина' },
  { value: 'module', label: 'Модуль' },
  { value: 'elective', label: 'Факультатив' },
  { value: 'unknown', label: 'Не определено' },
] as const;

export type InclusionForm = (typeof inclusionForms)[number]['value'];

export const identifyChecks = [
  { code: 'reason', label: 'Обоснование потребности заполнено', required: true },
  { code: 'format', label: 'Форма включения указана', required: true },
  { code: 'window', label: 'Учебный период выбран', required: true },
  { code: 'limits', label: 'Ограничения зафиксированы', required: false },
] as const;

export type IdentifyCheckCode = (typeof identifyChecks)[number]['code'];

export type IdentifyNote = {
  reason: string;
  format: InclusionForm | null;
  windowId: string | null;
  limits: string;
  order: string[];
  custom: CustomChecklistItem[];
};

export const emptyIdentifyNote = (): IdentifyNote => ({
  reason: '',
  format: null,
  windowId: null,
  limits: '',
  order: [],
  custom: [],
});

const isFormat = (value: string): value is InclusionForm => inclusionForms.some((item) => item.value === value);

export const parseIdentifyNote = (raw: string | null | undefined): IdentifyNote => {
  if (!raw?.trim()) return emptyIdentifyNote();
  try {
    const data = JSON.parse(raw) as { v?: number; reason?: unknown; format?: unknown; windowId?: unknown; limits?: unknown; order?: unknown; custom?: unknown };
    if (data.v !== 1) return { ...emptyIdentifyNote(), reason: raw };
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
    return {
      reason: typeof data.reason === 'string' ? data.reason : '',
      format: typeof data.format === 'string' && isFormat(data.format) ? data.format : null,
      windowId: typeof data.windowId === 'string' && data.windowId ? data.windowId : null,
      limits: typeof data.limits === 'string' ? data.limits : '',
      order,
      custom,
    };
  } catch {
    return { ...emptyIdentifyNote(), reason: raw };
  }
};

export const serializeIdentifyNote = (note: IdentifyNote) => JSON.stringify({
  v: 1,
  reason: note.reason,
  format: note.format,
  windowId: note.windowId,
  limits: note.limits,
  order: note.order,
  custom: note.custom,
});

export const identifyCheckState = (note: IdentifyNote): Record<IdentifyCheckCode, boolean> => ({
  reason: note.reason.trim().length >= NEED_REASON_MIN,
  format: Boolean(note.format),
  window: Boolean(note.windowId),
  limits: Boolean(note.limits.trim()),
});

const joinMissing = (items: string[]) => {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} и ${items[items.length - 1]}`;
};

export const identifyClosePlan = (note: IdentifyNote) => {
  const state = identifyCheckState(note);
  const missing: string[] = [];
  if (!state.reason) missing.push('обоснование потребности');
  if (!state.format) missing.push('форму включения');
  if (!state.window) missing.push('учебный период');
  return {
    button: 'Закрыть и перейти к пакету документов',
    enabled: missing.length === 0,
    hint: missing.length === 0 ? null : `Чтобы перейти к пакету документов, заполните: ${joinMissing(missing)}.`,
  };
};

type ChecklistLike = { id: string; code: string; itemType: string };

export const identifyChecklistItem = <T extends ChecklistLike>(items: T[]) => items.find((item) => item.code === 'need_comment')
  ?? items.find((item) => item.itemType === 'text')
  ?? null;
