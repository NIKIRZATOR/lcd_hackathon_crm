import dayjs from 'dayjs';

import { apiRequest } from '../../../../api/client';

import {
  LICENSE_FILE_KIND,
  parseLicenseDraft,
  signLicenseChecks,
} from '../../../workflow/stages/signLicense';

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
  const draft = parseLicenseDraft(byCode('license_number')?.value_text);
  const validUntil = byCode('license_valid_until')?.value_date ?? null;
  const latest = files.filter((file) => file.attachment_kind === LICENSE_FILE_KIND).at(-1) ?? null;
  const done = {
    received: draft.status === 'received',
    number: draft.number.trim().length > 0,
    signed: Boolean(draft.signedOn),
    term: Boolean(validUntil),
    file: Boolean(latest),
  };
  return signLicenseChecks.map((item, order) => ({
    code: item.id,
    label: item.label,
    required: true,
    completed: done[item.id] === true,
    order,
  }));
};

const mapFacts = (rows: ChecklistRow[]): ChecklistFact[] =>
  rows.map((row, order) => ({
    code: row.code || `item-${order}`,
    label: row.label,
    required: row.required === true,
    completed: row.is_done === true,
    order,
  }));

const withFallback = async <T>(
  request: Promise<T>,
  fallback: T,
  signal?: AbortSignal,
): Promise<T> => {
  try {
    return await request;
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }

    return fallback;
  }
};

export const loadNbaContext = async (
  programId: string,
  signal?: AbortSignal,
): Promise<ProgramNbaContext> => {
  const workflow = await apiRequest<WorkflowPayload>(
    `/api/program-instances/${programId}/workflow`,
    { signal },
  );

  const current =
    workflow.stages.find((stage) => stage.id === workflow.current_stage_instance_id) ||
    workflow.stages.find((stage) => stage.status.toLowerCase() === 'in_progress');

  const ctx = emptyContext(programId, true);

  ctx.stageCode = resolveStageCode(current?.code);

  if (ctx.stageCode === 'unknown' && current?.name && /подписан.*лиценз/i.test(current.name)) {
    ctx.stageCode = 'sign_license';
  }

  ctx.overdueDays = overdueDays(current?.due_at ?? null);

  if (!current?.id) {
    return ctx;
  }

  const checklist = await withFallback(
    apiRequest<ChecklistRow[]>(`/api/stage-instances/${current.id}/checklist`, { signal }),
    [],
    signal,
  );

  if (ctx.stageCode === 'sign_license') {
    const files = await withFallback(
      apiRequest<Array<{ attachment_kind?: string | null }>>(
        `/api/workflows/stage-instances/${current.id}/attachments`,
        { signal },
      ),
      [],
      signal,
    );

    ctx.facts = licenseFacts(checklist, files);

    return ctx;
  }

  ctx.facts = mapFacts(checklist);

  return ctx;
};
