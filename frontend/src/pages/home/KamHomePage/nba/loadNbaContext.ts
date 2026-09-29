import dayjs from 'dayjs';

import {
  LICENSE_FILE_KIND,
  parseLicenseDraft,
  signLicenseChecks,
} from '../../../workflow/stages/signLicense';
import type { NbaItem } from '../types';

import { resolveStageCode } from './getNextBestAction';
import type { ChecklistFact, ProgramNbaContext } from './nbaTypes';

type ChecklistRow = {
  code?: string;
  label: string;
  required: boolean;
  is_done: boolean;
  value_text?: string | null;
  value_date?: string | null;
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

export const contextFromNbaItem = (item: NbaItem): ProgramNbaContext => {
  const ctx = emptyContext(item.program_instance_id ?? '', true);
  if (!item.context) return ctx;

  ctx.stageCode = resolveStageCode(item.context.stage_code);
  ctx.overdueDays = overdueDays(item.context.stage_due_at);
  if (ctx.stageCode === 'sign_license') {
    ctx.facts = licenseFacts(
      item.context.checklist,
      item.context.attachment_kinds.map((attachment_kind) => ({ attachment_kind })),
    );
  } else {
    ctx.facts = mapFacts(item.context.checklist);
  }
  return ctx;
};
