import type { CustomChecklistItem } from './contactSearch';

export const CONFIRM_TEACHER_SLA_DAYS = 7;

export const confirmChecks = [
  { id: 'carrier', label: 'Носитель на месте' },
  { id: 'active', label: 'Статус «ведёт»' },
  { id: 'qualification', label: 'Квалификация не истекла' },
  { id: 'ready', label: 'Готовность «да»' },
  { id: 'window', label: 'Окно выбрано' },
] as const;

export type ConfirmCheckId = (typeof confirmChecks)[number]['id'];

export type ConfirmDraft = {
  ready: 'yes' | 'no' | null;
  reason: string;
  windowId: string | null;
  order: string[];
  custom: CustomChecklistItem[];
};

export const emptyConfirmDraft = (): ConfirmDraft => ({ ready: null, reason: '', windowId: null, order: [], custom: [] });

export const parseConfirmDraft = (raw: string | null | undefined): ConfirmDraft => {
  const empty = emptyConfirmDraft();
  if (!raw?.trim()) return empty;
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (data.v !== 1) return empty;
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
      ready: data.ready === 'yes' || data.ready === 'no' ? data.ready : null,
      reason: typeof data.reason === 'string' ? data.reason : '',
      windowId: typeof data.windowId === 'string' ? data.windowId : null,
      order,
      custom,
    };
  } catch {
    return empty;
  }
};

export const serializeConfirmDraft = (draft: ConfirmDraft) => JSON.stringify({ v: 1, ...draft });

export const qualificationOpen = (until: string | null, today: string) => !until || until >= today;

export const confirmClosePlan = (input: { ready: 'yes' | 'no' | null; windowId: string | null; hasCarrier: boolean; status: string | null; qualificationUntil: string | null; today: string }) => ({
  button: 'Закрыть и перейти к учебному плану',
  enabled: input.ready === 'yes' && input.hasCarrier && input.status === 'active' && Boolean(input.windowId) && input.status !== 'left' && qualificationOpen(input.qualificationUntil, input.today),
  hint: null as string | null,
  windowId: input.windowId,
});

export type ConfirmClosePlan = ReturnType<typeof confirmClosePlan>;
