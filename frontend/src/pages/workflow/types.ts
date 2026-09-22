export type WorkflowStatus = 'active' | 'attention' | 'completed' | 'overdue';

export interface WorkflowItem {
  id: number;
  university: string;
  universityShort: string;
  program: string;
  product: string;
  stage: string;
  responsible: string;
  deadline: string;
  status: WorkflowStatus;
  progress: number;
}

export interface WorkflowFilters {
  search: string;
  program: string;
  product: string;
  stage: string;
  responsible: string;
}

export type WorkflowStageState = 'completed' | 'current' | 'upcoming';

export interface WorkflowDetailStage {
  id: number;
  name: string;
  state: WorkflowStageState;
}

export interface WorkflowStepConfig {
  id: number;
  name: string;
  description: string;
  defaultDurationDays?: number;
  isInitial: boolean;
  isFinal: boolean;
  isOptional: boolean;
  requiresComment: boolean;
  requiresAttachment: boolean;
  completionConditions: string[];
  checklistItems: string[];
}

export interface WorkflowChecklistItem {
  id: number;
  label: string;
  completed: boolean;
  date?: string;
}

export interface WorkflowFile {
  id: number;
  name: string;
  type: string;
  size: string;
  uploadedAt: string;
}

export interface WorkflowComment {
  id: number;
  author: string;
  text: string;
  createdAt: string;
}

export interface WorkflowDetailMock {
  item: WorkflowItem;
  stages: WorkflowDetailStage[];
  stepConfigs: WorkflowStepConfig[];
  currentStageId: number;
  checklist: WorkflowChecklistItem[];
  files: WorkflowFile[];
  comments: WorkflowComment[];
}