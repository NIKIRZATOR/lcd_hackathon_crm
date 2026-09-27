import type { CustomChecklistItem } from './contactSearch';

export const PERIOD_SLA_DAYS = 7;

export const verdicts = [
  { value: 'success', label: 'Успех' },
  { value: 'partial', label: 'Частичный успех' },
  { value: 'failed', label: 'Срыв' },
] as const;

export const failReasons = [
  { value: 'no_students', label: 'Нет студентов' },
  { value: 'teacher', label: 'Преподаватель' },
  { value: 'window', label: 'Окно' },
  { value: 'other', label: 'Другое' },
] as const;

export type Verdict = (typeof verdicts)[number]['value'];
export type FailReason = (typeof failReasons)[number]['value'];

export type PeriodSnapshot = {
  students: number | null;
  applications: number | null;
  licenseUntil: string | null;
  carrierStatus: string | null;
  signalAt: string | null;
};

export type PeriodDraft = {
  verdict: Verdict | null;
  reason: FailReason | null;
  comment: string;
  snapshot: PeriodSnapshot | null;
  order: string[];
  custom: CustomChecklistItem[];
};

export const emptyPeriodDraft = (): PeriodDraft => ({ verdict: null, reason: null, comment: '', snapshot: null, order: [], custom: [] });

export const parsePeriodDraft = (raw: string | null | undefined): PeriodDraft => {
  const empty = emptyPeriodDraft();
  if (!raw?.trim()) return empty;
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (data.v !== 1 || !data.snapshot || typeof data.snapshot !== 'object') return empty;
    const shot = data.snapshot as Record<string, unknown>;
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
      verdict: verdicts.find((item) => item.value === data.verdict)?.value ?? null,
      reason: failReasons.find((item) => item.value === data.reason)?.value ?? null,
      comment: typeof data.comment === 'string' ? data.comment : '',
      snapshot: {
        students: typeof shot.students === 'number' ? shot.students : null,
        applications: typeof shot.applications === 'number' ? shot.applications : null,
        licenseUntil: typeof shot.licenseUntil === 'string' ? shot.licenseUntil : null,
        carrierStatus: typeof shot.carrierStatus === 'string' ? shot.carrierStatus : null,
        signalAt: typeof shot.signalAt === 'string' ? shot.signalAt : null,
      },
      order,
      custom,
    };
  } catch {
    return empty;
  }
};

export const serializePeriodDraft = (draft: PeriodDraft) => JSON.stringify({ v: 1, ...draft });

export const periodClosePlan = (input: { verdict: Verdict | null; reason: FailReason | null; comment: string }) => ({
  button: 'Перейти к контролю исполнения',
  enabled: Boolean(input.verdict) && input.comment.trim().length > 0 && (input.verdict !== 'failed' || Boolean(input.reason)),
  hint: null as string | null,
});

export type PeriodClosePlan = ReturnType<typeof periodClosePlan>;
