import dayjs from 'dayjs';

import { apiRequest } from '../../../../api/client';

import { resolveStageCode } from './getNextBestAction';
import type { ChecklistFact, ProgramNbaContext } from './nbaTypes';

type WorkflowPayload = {
  current_stage_instance_id: string | null;
  stages: Array<{
    id: string;
    code?: string;
    name: string;
    status: string;
    due_at: string | null;
  }>;
};

type ChecklistRow = {
  code?: string;
  label: string;
  required: boolean;
  is_done: boolean;
  value_text?: string | null;
  value_date?: string | null;
  attachment_id?: string | null;
};

const overdueDays = (dueAt: string | null) => {
  if (!dueAt || !dayjs(dueAt).isValid()) return 0;
  const diff = dayjs().startOf('day').diff(dayjs(dueAt).startOf('day'), 'day');
  return diff > 0 ? diff : 0;
};

const parseDraft = (raw: string | null | undefined) => {
  if (!raw?.trim()) return { number: '', status: null as string | null, signedOn: null as string | null };
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (data.v !== 1) return { number: raw.trim(), status: null, signedOn: null };
    return {
      number: typeof data.number === 'string' ? data.number : '',
      status: typeof data.status === 'string' ? data.status : null,
      signedOn: typeof data.signedOn === 'string' ? data.signedOn : null,
    };
  } catch {
    return { number: raw.trim(), status: null, signedOn: null };
  }
};

export const emptyContext = (programId: string, live = false): ProgramNbaContext => ({
  programId,
  live,
  stageCode: 'unknown',
  overdueDays: 0,
  facts: [],
});

const licenseFacts = (
  rows: ChecklistRow[],
  files: Array<{ attachment_kind?: string | null }>,
): ChecklistFact[] => {
  const byCode = (code: string) => rows.find((row) => (row.code || '').toLowerCase() === code);
  const numberItem = byCode('license_number');
  const termItem = byCode('license_valid_until');
  const fileItem = byCode('license_attachment');
  const draft = parseDraft(numberItem?.value_text);
  const hasFile = Boolean(fileItem?.attachment_id) || files.some((file) => file.attachment_kind === 'license');
  return [
    { code: 'received', label: 'Статус «получена подписанная»', required: true, done: draft.status === 'received', order: 0 },
    { code: 'number', label: 'Номер указан', required: true, done: draft.number.trim().length > 0, order: 1 },
    { code: 'signed', label: 'Дата указана', required: true, done: Boolean(draft.signedOn), order: 2 },
    { code: 'term', label: 'Срок указан', required: true, done: Boolean(termItem?.value_date), order: 3 },
    { code: 'file', label: 'Файл приложен', required: true, done: hasFile, order: 4 },
  ];
};

const mapFacts = (rows: ChecklistRow[]): ChecklistFact[] =>
  rows.map((row, order) => ({
    code: row.code || `item-${order}`,
    label: row.label,
    required: row.required,
    done: row.is_done,
    order,
  }));

export const resetNbaLoadCaches = () => undefined;

export const loadNbaContext = async (programId: string): Promise<ProgramNbaContext> => {
  const workflow = await apiRequest<WorkflowPayload>(`/api/program-instances/${programId}/workflow`);
  const current =
    workflow.stages.find((stage) => stage.id === workflow.current_stage_instance_id) ||
    workflow.stages.find((stage) => stage.status.toLowerCase() === 'in_progress');

  const ctx = emptyContext(programId, true);
  ctx.stageCode = resolveStageCode(current?.code);
  ctx.overdueDays = overdueDays(current?.due_at ?? null);

  if (!current?.id) return ctx;

  const checklist = await apiRequest<ChecklistRow[]>(`/api/stage-instances/${current.id}/checklist`).catch(() => []);

  if (ctx.stageCode === 'sign_license') {
    const files = await apiRequest<Array<{ attachment_kind?: string | null }>>(
      `/api/workflows/stage-instances/${current.id}/attachments`,
    ).catch(() => []);
    ctx.facts = licenseFacts(checklist, files);
    return ctx;
  }

  ctx.facts = mapFacts(checklist);
  return ctx;
};

export const fallbackContext = (programId: string): ProgramNbaContext => emptyContext(programId, false);
