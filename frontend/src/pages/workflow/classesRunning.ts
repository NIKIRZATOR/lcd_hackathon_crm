import type { CustomChecklistItem } from './contactSearch';

export const CLASSES_RUNNING_SLA_DAYS = 30;

export const streamStatuses = [
  { value: 'ok', label: 'Идёт нормально' },
  { value: 'issues', label: 'Идёт с проблемами' },
  { value: 'failed', label: 'Сорван' },
] as const;

export type StreamStatus = (typeof streamStatuses)[number]['value'];
export type SignalTone = 'green' | 'yellow' | 'red';

export type RunningDraft = { status: StreamStatus | null; comment: string; replacement: boolean; order: string[]; custom: CustomChecklistItem[] };
export const emptyRunningDraft = (): RunningDraft => ({ status: null, comment: '', replacement: false, order: [], custom: [] });

export const signalTone = (students: number | null, silenceDays: number | null): SignalTone => {
  if (students === null || silenceDays === null || students === 0 || silenceDays > 30) return 'red';
  if (silenceDays > 7) return 'yellow';
  return 'green';
};

export const classesClosePlan = (input: { hasCarrier: boolean; tone: SignalTone; students: number | null; silenceDays: number | null; status: StreamStatus | null; comment: string }) => {
  const comment = input.comment.trim().length > 0;
  const hardStop = (input.students ?? 0) === 0 && (input.silenceDays === null || input.silenceDays > 30);
  const success = input.hasCarrier && input.status !== 'failed' && (input.tone !== 'red' || comment) && !hardStop && (input.status !== 'issues' || comment);
  const failure = input.status === 'failed' && comment;
  return { button: 'Закрыть и перейти к итогам', enabled: success || failure, hint: null as string | null, mode: failure && !success ? 'failed' as const : 'success' as const };
};

export type ClassesClosePlan = ReturnType<typeof classesClosePlan>;
