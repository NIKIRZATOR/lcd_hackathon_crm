import dayjs from 'dayjs';

import { apiRequest } from '../../api/client';
import { emptyActionText } from './backend/workflowBackendFieldGaps';
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
  status?: string | null;
  due_at: string | null;
  health_score: number | null;
  health_band: string | null;
  kam_name: string | null;
};

export const CLOSED_STAGE_LABEL = 'Заход закрыт';

export const journalStageName = (row: { id: string; current_stage_name?: string | null; status?: string | null }) => {
  if ((row.status ?? '').toLowerCase() === 'cancelled') return CLOSED_STAGE_LABEL;
  return row.current_stage_name?.trim() || 'Этап не передан';
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
  tone: 'danger' | 'progress' | 'warning' | 'success' | 'neutral';
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

export const universityWorkflowRows = (universityId: number | string) => {
  const key = String(universityId);
  return rowsByUniversity.has(key) ? rowsByUniversity.get(key) ?? [] : undefined;
};

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

export type JournalPreset = 'all' | 'overdue' | 'semester' | 'renewal' | 'lms_silence';

export type JournalProgram = {
  id: string;
  organization: string;
  direction: string;
  product: string;
  playbook: string;
  stage: string;
  due: string;
  healthScore: number | null;
  healthBand: 'green' | 'yellow' | 'red' | null;
  kam: string;
  students: number | null;
  applications: number | null;
};

export type DeskStage = {
  id: string;
  code: string;
  name: string;
  phase: string;
  status: string;
  dueAt: string | null;
  optional: boolean;
  final: boolean;
};

export type DeskChecklistItem = {
  id: string;
  code: string;
  label: string;
  required: boolean;
  done: boolean;
  itemType: string;
  role: string | null;
  attachmentKind: string | null;
  valueText: string | null;
  valueDate: string | null;
  stakeholderId: string | null;
  attachmentId: string | null;
};

export type DeskFile = { id: string; fileId: string; name: string; kind: string | null; sizeLabel: string };
export type DeskComment = { id: string; text: string; createdAt: string; authorId: string };

export type ProgramDesk = {
  id: string;
  organizationId: string;
  organization: string;
  direction: string;
  product: string;
  playbook: string;
  windowTitle: string;
  windowId: string | null;
  kam: string;
  status: string;
  healthScore: number | null;
  healthBand: 'green' | 'yellow' | 'red' | null;
  students: number | null;
  stageCode: string | null;
  stages: DeskStage[];
  currentStageId: string | null;
  transitions: Array<{ id: string; name: string; toStageName: string }>;
  banner: string;
  bannerTone: 'info' | 'warning' | 'success';
  people: Array<{ id: string; name: string; role: string; roleCode: string }>;
  license: string;
};

const bandOf = (score: number | null, band?: string | null): JournalProgram['healthBand'] => {
  if (band === 'green' || band === 'yellow' || band === 'red') return band;
  if (score == null) return null;
  if (score >= 75) return 'green';
  if (score >= 50) return 'yellow';
  return 'red';
};

const shortNameByOrganization = async () => {
  const page = await apiRequest<{ items: Array<{ name: string; short_name: string | null }> }>('/api/organizations?limit=100&offset=0').catch(() => ({ items: [] }));
  return new Map(page.items.map((item) => [item.name.trim().toLowerCase().replace(/ё/g, 'е'), item.short_name?.trim() || item.name]));
};

export const loadJournal = async (preset: JournalPreset): Promise<JournalProgram[]> => {
  const [rows, shortNames] = await Promise.all([
    apiRequest<Array<JournalRow & { playbook_name?: string; students_count?: number | null; applications_count?: number | null }>>(`/api/workflow-journal?preset=${preset}`),
    shortNameByOrganization(),
  ]);
  return rows.map((row) => ({
    id: row.id,
    organization: shortNames.get(row.organization_name.trim().toLowerCase().replace(/ё/g, 'е')) || text(row.organization_name),
    direction: text(row.direction_name),
    product: text(row.product_name),
    playbook: row.playbook_name?.trim() || 'Плейбук не передан',
    stage: journalStageName(row),
    due: isoDate(row.due_at),
    healthScore: row.health_score,
    healthBand: bandOf(row.health_score, row.health_band),
    kam: text(row.kam_name),
    students: row.students_count ?? null,
    applications: row.applications_count ?? null,
  }));
};

export const loadProgramDesk = async (id: string): Promise<ProgramDesk> => {
  const [program, workflow, nba, metrics, license] = await Promise.all([
    apiRequest<{
      organization_id: string;
      direction_name: string;
      product_name: string;
      playbook_name: string;
      academic_window_id: string | null;
      academic_window_title: string | null;
      kam_name: string | null;
      status: string;
      health_score: number | null;
      health_band: string | null;
      current_stage_code: string | null;
    }>(`/api/program-instances/${id}`),
    apiRequest<{
      stages: Array<ApiStage & { phase_name?: string; code?: string }>;
      current_stage_instance_id: string | null;
      available_transitions?: Array<{ id: string; name: string; to_stage_name: string }>;
    }>(`/api/program-instances/${id}/workflow`),
    apiRequest<Array<{ program_instance_id: string | null; reason: string; severity: string }>>('/api/nba/today').catch(() => []),
    apiRequest<{ students_count: number } | null>(`/api/integrations/program-instances/${id}/metrics`).catch(() => null),
    apiRequest<{ license_number: string | null; transfer_status: string } | null>(`/api/program-instances/${id}/license`).catch(() => null),
  ]);
  const organization = await apiRequest<{ name: string }>(`/api/organizations/${program.organization_id}`);
  const people = await apiRequest<Array<{ id: string; full_name: string; role_code: string; is_active: boolean }>>(`/api/organizations/${program.organization_id}/stakeholders`).catch(() => []);
  const action = nba.find((item) => item.program_instance_id === id);
  const students = metrics?.students_count ?? null;

  return {
    id,
    organizationId: program.organization_id,
    organization: organization.name,
    direction: program.direction_name,
    product: program.product_name,
    playbook: program.playbook_name,
    windowTitle: program.academic_window_title?.trim() || 'Окно не выбрано',
    windowId: program.academic_window_id,
    kam: program.kam_name?.trim() || 'KAM не назначен',
    status: program.status,
    healthScore: program.health_score,
    healthBand: bandOf(program.health_score, program.health_band),
    students,
    stageCode: program.current_stage_code,
    currentStageId: workflow.current_stage_instance_id,
    banner: action?.reason || (students > 0 && program.current_stage_code === 'classes_running' ? `LMS: ${students} студентов. Подтвердить ведение занятий?` : emptyActionText),
    bannerTone: action ? (action.severity === 'critical' ? 'warning' : 'info') : students > 0 && program.current_stage_code === 'classes_running' ? 'success' : 'info',
    people: people.filter((person) => person.is_active !== false).map((person) => ({ id: (person as { id?: string }).id || person.full_name, name: person.full_name, role: person.role_code, roleCode: person.role_code })),
    license: license ? `${license.license_number || 'Номер не указан'} · ${license.transfer_status}` : 'Лицензия не заведена',
    transitions: (workflow.available_transitions ?? []).map((item) => ({ id: item.id, name: item.name, toStageName: item.to_stage_name })),
    stages: workflow.stages.map((stage) => ({
      id: stage.id,
      code: stage.code || stage.name,
      name: stage.name,
      phase: stage.phase_name?.trim() && stage.phase_name.toLowerCase() !== 'other' ? stage.phase_name : '—',
      status: stage.status,
      dueAt: stage.due_at,
      optional: stage.is_optional,
      final: stage.is_final,
    })),
  };
};

export const loadStageFacts = async (stageId: string) => {
  const [checklist, comments, files] = await Promise.all([
    apiRequest<Array<{ id: string; code?: string; label: string; required: boolean; is_done: boolean; item_type: string; required_stakeholder_role?: string | null; required_attachment_kind?: string | null; value_text?: string | null; value_date?: string | null; stakeholder_id?: string | null; attachment_id?: string | null }>>(`/api/stage-instances/${stageId}/checklist`).catch(() => []),
    apiRequest<Array<{ id: string; text: string; created_at: string; author_user_id: string }>>(`/api/workflows/stage-instances/${stageId}/comments`).catch(() => []),
    apiRequest<Array<{ id: string; file_id: string; original_name: string; attachment_kind?: string | null; size_bytes?: number }>>(`/api/workflows/stage-instances/${stageId}/attachments`).catch(() => []),
  ]);
  return {
    checklist: checklist.map((item): DeskChecklistItem => ({
      id: item.id,
      code: item.code || item.id,
      label: item.label,
      required: item.required,
      done: item.is_done,
      itemType: item.item_type,
      role: item.required_stakeholder_role ?? null,
      attachmentKind: item.required_attachment_kind ?? null,
      valueText: item.value_text ?? null,
      valueDate: item.value_date ?? null,
      stakeholderId: item.stakeholder_id ?? null,
      attachmentId: item.attachment_id ?? null,
    })),
    comments: comments.map((item): DeskComment => ({ id: item.id, text: item.text, createdAt: item.created_at, authorId: item.author_user_id })),
    files: files.map((item): DeskFile => ({
      id: item.id,
      fileId: item.file_id,
      name: item.original_name,
      kind: item.attachment_kind ?? null,
      sizeLabel: typeof item.size_bytes === 'number' ? `${Math.max(item.size_bytes / 1024 / 1024, 0.1).toFixed(1)} МБ` : '',
    })),
  };
};

export const saveChecklistItem = (valueId: string, payload: Record<string, unknown>) => apiRequest(`/api/stage-instances/checklist/${valueId}`, {
  method: 'PATCH',
  body: JSON.stringify(payload),
});

export const addStageComment = (stageId: string, textValue: string) => apiRequest(`/api/workflows/stage-instances/${stageId}/comments`, {
  method: 'POST',
  body: JSON.stringify({ text: textValue }),
});

export const uploadStageFile = (stageId: string, file: File, kind?: string | null) => {
  const body = new FormData();
  body.append('file', file);
  if (kind) body.append('attachment_kind', kind);
  return apiRequest<{ id: string; file_id: string; original_name: string; attachment_kind?: string | null }>(`/api/workflows/stage-instances/${stageId}/attachments`, { method: 'POST', body });
};

export const deleteStageFile = (attachmentId: string) => apiRequest(`/api/workflows/attachments/${attachmentId}`, { method: 'DELETE' });

export const updateStageComment = (stageId: string, commentId: string, textValue: string) => apiRequest(`/api/workflows/stage-instances/${stageId}/comments/${commentId}`, {
  method: 'PATCH',
  body: JSON.stringify({ text: textValue }),
});

export const deleteStageComment = (stageId: string, commentId: string) => apiRequest(`/api/workflows/stage-instances/${stageId}/comments/${commentId}`, { method: 'DELETE' });

export const refuseProgram = (programId: string, payload: { stageId: string; comment: string }) => apiRequest(`/api/program-instances/${programId}/refuse`, {
  method: 'POST',
  body: JSON.stringify({
    comment: payload.comment,
    expected_current_stage_instance_id: payload.stageId,
  }),
});

export const reopenProgramStage = (programId: string, stageId: string) => apiRequest(`/api/program-instances/${programId}/reopen`, {
  method: 'POST',
  body: JSON.stringify({ stage_instance_id: stageId }),
});

export const moveProgram = (programId: string, payload: { transitionId?: string; comment?: string; stageId?: string; skip?: boolean }) => apiRequest(`/api/program-instances/${programId}/transition`, {
  method: 'POST',
  body: JSON.stringify({
    transition_id: payload.transitionId ?? null,
    comment: payload.comment ?? null,
    expected_current_stage_instance_id: payload.stageId ?? null,
    skip_current: payload.skip ?? false,
  }),
});

export const syncProgram = (programId: string) => apiRequest<{ mapped: number; unmatched: number }>(`/api/integrations/program-instances/${programId}/sync`, { method: 'POST' });

export type WorkflowStageData<T extends object> = {
  id: string;
  stage_instance_id: string;
  payload: T;
};

export const loadStageData = <T extends object>(stageId: string) =>
  apiRequest<WorkflowStageData<T> | null>(`/api/workflows/stage-instances/${stageId}/data`);

export const saveStageData = <T extends object>(stageId: string, payload: T) =>
  apiRequest<WorkflowStageData<T>>(`/api/workflows/stage-instances/${stageId}/data`, {
    method: 'PUT',
    body: JSON.stringify({ payload }),
  });

export type ChecklistExtra = {
  id: string;
  label: string;
  is_done: boolean;
  sort_order: number;
};

export const loadChecklistExtras = (stageId: string) =>
  apiRequest<ChecklistExtra[]>(`/api/stage-instances/${stageId}/checklist-extras`);

export const addChecklistExtra = (stageId: string, label: string) =>
  apiRequest<ChecklistExtra>(`/api/stage-instances/${stageId}/checklist-extras`, {
    method: 'POST',
    body: JSON.stringify({ label }),
  });

export const updateChecklistExtra = (id: string, patch: Partial<Pick<ChecklistExtra, 'label' | 'is_done'>>) =>
  apiRequest<ChecklistExtra>(`/api/stage-instances/checklist-extras/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });

export const deleteChecklistExtra = (id: string) =>
  apiRequest(`/api/stage-instances/checklist-extras/${id}`, { method: 'DELETE' });

export const reorderChecklistExtras = (stageId: string, ids: string[]) =>
  apiRequest<ChecklistExtra[]>(`/api/stage-instances/${stageId}/checklist-extras/order`, {
    method: 'PUT',
    body: JSON.stringify({ ids }),
  });

export type ProgramControl<T extends object> = {
  id: string;
  program_instance_id: string;
  status: 'active' | 'frozen';
  payload: T;
};

export const loadProgramControl = <T extends object>(programId: string) =>
  apiRequest<ProgramControl<T> | null>(`/api/program-instances/${programId}/control`);

export const saveProgramControl = <T extends object>(
  programId: string,
  status: 'active' | 'frozen',
  payload: T,
) =>
  apiRequest<ProgramControl<T>>(`/api/program-instances/${programId}/control`, {
    method: 'PUT',
    body: JSON.stringify({ status, payload }),
  });
