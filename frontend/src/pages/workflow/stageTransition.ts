import type { WorkflowStatus } from './types';

export type WorkflowStageRef = {
  id: number;
  name: string;
};

export type StageTransition = {
  stageId: number;
  stageName: string;
  status: WorkflowStatus;
  progress: number;
  completed: boolean;
  changed: boolean;
};

// Если название в списке не совпало ни с одним этапом, карточка раньше
// открывалась на шестом шаге. Тот же запасной индекс оставляем здесь.
const fallbackStageIndex = 5;

export const resolveCurrentStageIndex = (stages: WorkflowStageRef[], stageName: string) => {
  const index = stages.findIndex((stage) => stage.name === stageName);

  if (index !== -1) return index;
  if (stages.length === 0) return 0;

  return Math.min(fallbackStageIndex, stages.length - 1);
};

export const stageProgress = (reachedIndex: number, total: number) => {
  if (total <= 0) return 0;

  return Math.round((reachedIndex / total) * 100);
};

export const isWorkflowChainFinished = (
  stages: WorkflowStageRef[],
  stageName: string,
  status: WorkflowStatus,
  progress: number,
) => {
  if (stages.length === 0 || status !== 'completed' || progress !== 100) return false;

  return resolveCurrentStageIndex(stages, stageName) === stages.length - 1;
};

export const transitionToNextStage = (
  stages: WorkflowStageRef[],
  stageName: string,
  status: WorkflowStatus,
  progress: number,
): StageTransition | undefined => {
  if (stages.length === 0) return undefined;

  const currentIndex = resolveCurrentStageIndex(stages, stageName);
  const current = stages[currentIndex];

  if (isWorkflowChainFinished(stages, stageName, status, progress)) {
    return {
      stageId: current.id,
      stageName: current.name,
      status,
      progress,
      completed: true,
      changed: false,
    };
  }

  if (currentIndex >= stages.length - 1) {
    return {
      stageId: current.id,
      stageName: current.name,
      status: 'completed',
      progress: 100,
      completed: true,
      changed: true,
    };
  }

  const next = stages[currentIndex + 1];

  return {
    stageId: next.id,
    stageName: next.name,
    status,
    progress: stageProgress(currentIndex + 1, stages.length),
    completed: false,
    changed: true,
  };
};

// Свободная корректировка: текущим можно сделать любой этап, в том числе предыдущий.
// Попадание на последний шаг само по себе цепочку не завершает — для этого остаётся
// отдельный переход «далее» с уже открытого последнего этапа.
export const transitionToStage = (
  stages: WorkflowStageRef[],
  stageName: string,
  status: WorkflowStatus,
  progress: number,
  targetStageId: number,
): StageTransition | undefined => {
  if (stages.length === 0) return undefined;

  const targetIndex = stages.findIndex((stage) => stage.id === targetStageId);
  if (targetIndex === -1) return undefined;

  const target = stages[targetIndex];
  const currentIndex = resolveCurrentStageIndex(stages, stageName);
  const finished = isWorkflowChainFinished(stages, stageName, status, progress);
  const alreadyHere = stages[currentIndex]?.name === stageName && currentIndex === targetIndex;

  if (alreadyHere && !finished) {
    return {
      stageId: target.id,
      stageName: target.name,
      status,
      progress,
      completed: false,
      changed: false,
    };
  }

  return {
    stageId: target.id,
    stageName: target.name,
    status: status === 'completed' ? 'active' : status,
    progress: stageProgress(targetIndex, stages.length),
    completed: false,
    changed: true,
  };
};
