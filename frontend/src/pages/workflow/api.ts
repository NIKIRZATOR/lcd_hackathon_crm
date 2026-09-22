import { getWorkflowDetailMock, workflowItemsMock } from './mocks';
import type { WorkflowItem } from './types';

// Страницы ходят только сюда. Сейчас под функциями моки, запросы встанут на их место.

export {
  advanceWorkflowStage,
  addWorkflowStageComment,
  addWorkflowStageFile,
  createUniversityWorkflow,
  createWorkflowStepConfig,
  deleteWorkflowStepConfig,
  getWorkflowDetailMock,
  getWorkflowStageActivity,
  getWorkflowStepConfigs,
  moveWorkflowToStage,
  reorderWorkflowStepConfigs,
  updateWorkflowStepConfig,
} from './mocks';

export const listWorkflows = (): WorkflowItem[] => workflowItemsMock;

export const getWorkflow = (id: number) => getWorkflowDetailMock(id);

export const summarizeWorkflows = (items: readonly WorkflowItem[] = workflowItemsMock) => ({
  active: items.filter((item) => item.status === 'active').length,
  attention: items.filter((item) => item.status === 'attention').length,
  completed: items.filter((item) => item.status === 'completed').length,
  overdue: items.filter((item) => item.status === 'overdue').length,
});
