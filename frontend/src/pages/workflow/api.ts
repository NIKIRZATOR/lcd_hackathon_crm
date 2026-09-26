import dayjs from 'dayjs';

import { apiRequest } from '../../api/client';
import type { StageTone } from '../universities/universityCard';
import {
  addWorkflowStageComment as addMockComment,
  addWorkflowStageFile as addMockFile,
  advanceWorkflowStage as advanceMockStage,
  getWorkflowDetailMock,
  getWorkflowStageActivity as getMockStageActivity,
  moveWorkflowToStage as moveMockStage,
} from './mocks';
import type {
  WorkflowChecklistItem,
  WorkflowComment,
  WorkflowDetailMock,
  WorkflowFile,
  WorkflowItem,
  WorkflowStatus,
  WorkflowStepConfig,
} from './types';

export {
  createUniversityWorkflow,
  createWorkflowStepConfig,
  deleteWorkflowStepConfig,
  getWorkflowDetailMock,
  getWorkflowStepConfigs,
  reorderWorkflowStepConfigs,
  updateWorkflowStepConfig,
} from './mocks';

const dash = '—';

type JournalRow = {
  id: string;
  organization_name: string;
  direction_name: string;
  product_name: string;
  current_stage_name: string | null;
  due_at: string | null;
  health_score: number | null;
  health_band: string | null;
  kam_name: string | null;
};

type ApiStage = {
  id: string;
  status: string;
  due_at: string | null;
  name: string;
  order_index: number;
  is_optional: boolean;
  is_final: boolean;
};

type ApiWorkflow = {
  stages: ApiStage[];
  current_stage_instance_id: string | null;
};

type ApiChecklist = { id: string; label: string; is_done: boolean };
type ApiComment = { id: string; text: string; created_at: string };
type ApiAttachment = { id: string; original_name: string; attachment_kind?: string | null };

export type UniversityWorkflowRow = {
  id: string;
  program: string;
  product: string;
  stage: string;
  tone: StageTone;
  nextStep: string;
  due: string;
  owner: string;
  status: WorkflowStatus;
  at: string;
};

type StageActivity = { files: WorkflowFile[]; comments: WorkflowComment[] };

const liveItems: WorkflowItem[] = [];
const liveDetails = new Map<string, WorkflowDetailMock>();
const liveActivity = new Map<string, Map<number, StageActivity>>();
const rowsByUniversity = new Map<string, UniversityWorkflowRow[]>();
let listLoaded = false;

const text = (value?: string | null) => value?.trim() || dash;

const isoDate = (value?: string | null) => {
  if (!value || !dayjs(value).isValid()) return '';
  return dayjs(value).format('YYYY-MM-DD');
};

export const workflowStatusFromApi = (
  status: string | null | undefined,
  dueAt: string | null | undefined,
  healthBand?: string | null,
): WorkflowStatus => {
  const normalized = (status ?? '').toLowerCase();
  if (normalized === 'completed') return 'completed';
  if (dueAt && dayjs(dueAt).isValid() && dayjs(dueAt).endOf('day').isBefore(dayjs())) return 'overdue';
  if (normalized === 'paused' || normalized === 'cancelled' || healthBand === 'red' || healthBand === 'yellow') return 'attention';
  return 'active';
};

const toneOf = (status: WorkflowStatus): StageTone => {
  if (status === 'overdue') return 'danger';
  if (status === 'attention') return 'warning';
  if (status === 'completed') return 'success';
  return 'progress';
};

const journalItem = (row: JournalRow): WorkflowItem => ({
  id: row.id,
  university: text(row.organization_name),
  universityShort: text(row.organization_name),
  program: text(row.direction_name),
  product: text(row.product_name),
  stage: text(row.current_stage_name),
  responsible: text(row.kam_name),
  deadline: isoDate(row.due_at),
  status: workflowStatusFromApi(null, row.due_at, row.health_band),
  progress: row.health_score ?? -1,
});

export const universityWorkflowRows = (universityId: number | string) => {
  const key = String(universityId);
  return rowsByUniversity.has(key) ? rowsByUniversity.get(key) ?? [] : undefined;
};

export const setUniversityWorkflowRows = (universityId: string, rows: UniversityWorkflowRow[]) => {
  rowsByUniversity.set(universityId, rows);
};

export const loadWorkflows = async () => {
  const rows = await apiRequest<JournalRow[]>('/api/workflow-journal?preset=all');
  liveItems.splice(0, liveItems.length, ...rows.map(journalItem));
  listLoaded = true;
  return liveItems;
};

export const listWorkflows = (): WorkflowItem[] => (listLoaded ? liveItems : []);

export const summarizeWorkflows = (items: readonly WorkflowItem[] = listWorkflows()) => ({
  active: items.filter((item) => item.status === 'active').length,
  attention: items.filter((item) => item.status === 'attention').length,
  completed: items.filter((item) => item.status === 'completed').length,
  overdue: items.filter((item) => item.status === 'overdue').length,
});

const emptyActivity = (): StageActivity => ({ files: [], comments: [] });

const rememberActivity = (workflowId: string, stageId: number, activity: StageActivity) => {
  const byStage = liveActivity.get(workflowId) ?? new Map<number, StageActivity>();
  byStage.set(stageId, activity);
  liveActivity.set(workflowId, byStage);
};

export const getWorkflowStageActivity = (workflowId: string | number, stageId: number, currentStageId: number) => {
  const live = liveActivity.get(String(workflowId))?.get(stageId);
  if (live || liveActivity.has(String(workflowId))) {
    const activity = live ?? emptyActivity();
    return {
      files: activity.files.map((file) => ({ ...file })),
      comments: activity.comments.map((comment) => ({ ...comment })),
    };
  }

  if (typeof workflowId === 'number') return getMockStageActivity(workflowId, stageId, currentStageId);
  return emptyActivity();
};

export const addWorkflowStageComment = (
  workflowId: string | number,
  stageId: number,
  currentStageId: number,
  comment: Omit<WorkflowComment, 'id'>,
) => {
  const stored = liveActivity.get(String(workflowId));
  if (stored) {
    const activity = stored.get(stageId) ?? emptyActivity();
    const created = { ...comment, id: Date.now() };
    stored.set(stageId, { ...activity, comments: [created, ...activity.comments] });
    return created;
  }

  if (typeof workflowId === 'number') return addMockComment(workflowId, stageId, currentStageId, comment);
  return { ...comment, id: Date.now() };
};

export const addWorkflowStageFile = (
  workflowId: string | number,
  stageId: number,
  currentStageId: number,
  file: Omit<WorkflowFile, 'id'>,
) => {
  const stored = liveActivity.get(String(workflowId));
  if (stored) {
    const activity = stored.get(stageId) ?? emptyActivity();
    const created = { ...file, id: Date.now() };
    stored.set(stageId, { ...activity, files: [...activity.files, created] });
    return created;
  }

  if (typeof workflowId === 'number') return addMockFile(workflowId, stageId, currentStageId, file);
  return { ...file, id: Date.now() };
};

export const advanceWorkflowStage = (workflowId: string | number) => (
  typeof workflowId === 'number' ? advanceMockStage(workflowId) : undefined
);

export const moveWorkflowToStage = (workflowId: string | number, stageId: number) => (
  typeof workflowId === 'number' ? moveMockStage(workflowId, stageId) : undefined
);

const stageState = (stage: ApiStage, index: number, currentIndex: number): WorkflowDetailMock['stages'][number]['state'] => {
  const status = stage.status.toLowerCase();
  if (index === currentIndex) return 'current';
  if (status === 'completed' || status === 'skipped' || (currentIndex >= 0 && index < currentIndex)) return 'completed';
  return 'upcoming';
};

export const loadWorkflowDetail = async (id: string | number): Promise<WorkflowDetailMock | undefined> => {
  const key = String(id);
  if (!key || Number.isNaN(Number(key)) === false && !key.includes('-')) {
    return getWorkflowDetailMock(Number(key));
  }

  try {
    const [program, workflow] = await Promise.all([
      apiRequest<{
        direction_name: string;
        product_name: string;
        playbook_name: string;
        status: string;
        kam_name: string | null;
        health_score: number | null;
        health_band: string | null;
        organization_id: string;
      }>(`/api/program-instances/${key}`),
      apiRequest<ApiWorkflow>(`/api/program-instances/${key}/workflow`),
    ]);
    const organization = await apiRequest<{ name: string; short_name: string | null }>(`/api/organizations/${program.organization_id}`);
    const stages = [...workflow.stages].sort((left, right) => left.order_index - right.order_index);
    const currentIndex = stages.findIndex((stage) => stage.id === workflow.current_stage_instance_id);
    const current = stages[currentIndex];
    liveActivity.set(key, new Map());

    const checklistByStage: Record<number, WorkflowChecklistItem[]> = {};
    await Promise.all(stages.map(async (stage, index) => {
      const stageKey = index + 1;
      const [checklist, comments, attachments] = await Promise.all([
        apiRequest<ApiChecklist[]>(`/api/stage-instances/${stage.id}/checklist`).catch(() => []),
        apiRequest<ApiComment[]>(`/api/workflows/stage-instances/${stage.id}/comments`).catch(() => []),
        apiRequest<ApiAttachment[]>(`/api/workflows/stage-instances/${stage.id}/attachments`).catch(() => []),
      ]);
      checklistByStage[stageKey] = checklist.map((item, itemIndex) => ({
        id: itemIndex + 1,
        label: text(item.label),
        completed: item.is_done,
      }));
      rememberActivity(key, stageKey, {
        comments: comments.map((comment, commentIndex) => ({
          id: commentIndex + 1,
          author: dash,
          text: text(comment.text),
          createdAt: dayjs(comment.created_at).isValid() ? dayjs(comment.created_at).format('D MMMM YYYY, HH:mm') : dash,
        })),
        files: attachments.map((file, fileIndex) => ({
          id: fileIndex + 1,
          name: text(file.original_name),
          type: text(file.attachment_kind),
          size: dash,
          uploadedAt: dash,
        })),
      });
    }));

    const stepConfigs: WorkflowStepConfig[] = stages.map((stage, index) => ({
      id: index + 1,
      name: text(stage.name),
      description: '',
      isInitial: index === 0,
      isFinal: stage.is_final || index === stages.length - 1,
      isOptional: stage.is_optional,
      requiresComment: false,
      requiresAttachment: false,
      completionConditions: [],
      checklistItems: (checklistByStage[index + 1] ?? []).map((item) => item.label),
    }));
    const done = stages.filter((stage) => stage.status.toLowerCase() === 'completed').length;
    const item: WorkflowItem = {
      id: key,
      universityId: program.organization_id,
      university: text(organization.name),
      universityShort: text(organization.short_name || organization.name),
      program: text(program.direction_name),
      product: text(program.product_name),
      stage: text(current?.name),
      responsible: text(program.kam_name),
      deadline: isoDate(current?.due_at),
      status: workflowStatusFromApi(program.status, current?.due_at, program.health_band),
      progress: stages.length ? Math.round((done / stages.length) * 100) : program.health_score ?? -1,
    };
    const detail: WorkflowDetailMock = {
      item,
      stages: stages.map((stage, index) => ({ id: index + 1, name: text(stage.name), state: stageState(stage, index, currentIndex) })),
      stepConfigs,
      currentStageId: currentIndex >= 0 ? currentIndex + 1 : 0,
      checklist: checklistByStage[currentIndex + 1] ?? [],
      checklistByStage,
      files: [],
      comments: [],
    };
    liveDetails.set(key, detail);
    const existing = liveItems.findIndex((entry) => String(entry.id) === key);
    if (existing >= 0) liveItems[existing] = item;
    return detail;
  } catch {
    return undefined;
  }
};

export const getWorkflow = (id: string | number) => liveDetails.get(String(id)) ?? getWorkflowDetailMock(Number(id));

export const workflowRowFromProgram = (
  program: {
    id: string;
    direction_name: string;
    product_name: string;
    status: string;
    kam_name: string | null;
    health_band: string | null;
    started_at?: string | null;
    current_stage_code?: string | null;
  },
  stageName?: string | null,
  dueAt?: string | null,
): UniversityWorkflowRow => {
  const status = workflowStatusFromApi(program.status, dueAt, program.health_band);
  const due = isoDate(dueAt);

  return {
    id: program.id,
    program: text(program.direction_name),
    product: text(program.product_name),
    stage: text(stageName || program.current_stage_code),
    tone: toneOf(status),
    nextStep: dash,
    due: due ? dayjs(due).locale('ru').format('D MMM YYYY') : dash,
    owner: text(program.kam_name),
    status,
    at: isoDate(program.started_at),
  };
};
