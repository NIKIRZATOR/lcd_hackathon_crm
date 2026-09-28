import { describe, expect, it } from 'vitest';

import { advanceWorkflowStage, getWorkflowDetailMock, getWorkflowStepConfigs, moveWorkflowToStage, workflowItemsMock } from '../mocks';
import { resolveCurrentStageIndex, transitionToNextStage, transitionToStage } from './stageTransition';

const stages = [
  { id: 30, name: 'Поиск контакта' },
  { id: 10, name: 'Коммуникация' },
  { id: 20, name: 'Встреча' },
];

describe('resolveCurrentStageIndex', () => {
  it('находит этап по названию, а не по id', () => {
    expect(resolveCurrentStageIndex(stages, 'Коммуникация')).toBe(1);
  });

  it('для неизвестного названия оставляет прежний запасной индекс', () => {
    const longChain = Array.from({ length: 14 }, (_, index) => ({ id: index + 1, name: `Этап ${index + 1}` }));

    expect(resolveCurrentStageIndex(longChain, 'Нет такого')).toBe(5);
  });
});

describe('transitionToNextStage', () => {
  it('переводит на следующий этап и пересчитывает прогресс', () => {
    expect(transitionToNextStage(stages, 'Поиск контакта', 'active', 43)).toEqual({
      stageId: 10,
      stageName: 'Коммуникация',
      status: 'active',
      progress: 33,
      completed: false,
      changed: true,
    });
  });

  it('не меняет статус «требует внимания» и «просрочен» на промежуточном переходе', () => {
    expect(transitionToNextStage(stages, 'Поиск контакта', 'attention', 10)?.status).toBe('attention');
    expect(transitionToNextStage(stages, 'Поиск контакта', 'overdue', 10)?.status).toBe('overdue');
  });

  it('на последнем этапе завершает workflow', () => {
    expect(transitionToNextStage(stages, 'Встреча', 'active', 66)).toMatchObject({
      stageId: 20,
      stageName: 'Встреча',
      status: 'completed',
      progress: 100,
      completed: true,
      changed: true,
    });
  });

  it('повторный переход завершённого workflow ничего не меняет', () => {
    expect(transitionToNextStage(stages, 'Встреча', 'completed', 100)).toMatchObject({
      changed: false,
      completed: true,
      progress: 100,
    });
  });
});

describe('transitionToStage', () => {
  it('ставит любой этап и не завершает цепочку только из-за последнего шага', () => {
    expect(transitionToStage(stages, 'Поиск контакта', 'attention', 0, 20)).toEqual({
      stageId: 20,
      stageName: 'Встреча',
      status: 'attention',
      progress: 67,
      completed: false,
      changed: true,
    });
  });

  it('повторный выбор уже текущего этапа ничего не меняет', () => {
    expect(transitionToStage(stages, 'Коммуникация', 'overdue', 33, 10)?.changed).toBe(false);
  });

  it('с завершённой цепочки возвращает этап в работу', () => {
    expect(transitionToStage(stages, 'Встреча', 'completed', 100, 10)).toMatchObject({
      stageName: 'Коммуникация',
      status: 'active',
      progress: 33,
      completed: false,
      changed: true,
    });
  });

  it('не находит этап с чужим id', () => {
    expect(transitionToStage(stages, 'Поиск контакта', 'active', 0, 999)).toBeUndefined();
  });
});

describe('advanceWorkflowStage', () => {
  it('сохраняет новый этап в моке, чтобы он пережил уход со страницы', () => {
    const item = workflowItemsMock.find((workflow) => workflow.id === 1);
    const snapshot = item ? { ...item } : undefined;

    try {
      const transition = advanceWorkflowStage(1);

      expect(transition?.stageName).toBe('Коммуникация');
      expect(item?.stage).toBe('Коммуникация');
      expect(item?.status).toBe('active');
      expect(getWorkflowDetailMock(1)?.stages.find((stage) => stage.state === 'current')?.name).toBe('Коммуникация');
      expect(getWorkflowDetailMock(1)?.stages.find((stage) => stage.name === 'Поиск контакта')?.state).toBe('completed');
    } finally {
      if (item && snapshot) Object.assign(item, snapshot);
    }
  });
});

describe('moveWorkflowToStage', () => {
  it('сохраняет произвольный этап и откат назад', () => {
    const item = workflowItemsMock.find((workflow) => workflow.id === 1);
    const snapshot = item ? { ...item } : undefined;

    try {
      const configs = getWorkflowStepConfigs(1);
      const meeting = configs.find((step) => step.name === 'Встреча');
      const moved = moveWorkflowToStage(1, meeting?.id ?? 0);

      expect(moved?.changed).toBe(true);
      expect(item?.stage).toBe('Встреча');
      expect(item?.status).toBe('active');
      expect(getWorkflowDetailMock(1)?.stages.find((stage) => stage.state === 'current')?.name).toBe('Встреча');

      const back = moveWorkflowToStage(1, configs[0]?.id ?? 0);
      expect(back?.stageName).toBe('Поиск контакта');
      expect(item?.stage).toBe('Поиск контакта');
      expect(item?.progress).toBe(0);
    } finally {
      if (item && snapshot) Object.assign(item, snapshot);
    }
  });

  it('сохраняет «требует внимания» и снимает завершение при откате', () => {
    const attention = workflowItemsMock.find((workflow) => workflow.status === 'attention');
    const completed = workflowItemsMock.find((workflow) => workflow.status === 'completed');
    const attentionSnapshot = attention ? { ...attention } : undefined;
    const completedSnapshot = completed ? { ...completed } : undefined;

    try {
      const attentionSteps = getWorkflowStepConfigs(attention?.id ?? 0);
      moveWorkflowToStage(attention?.id ?? 0, attentionSteps[0]?.id ?? 0);
      expect(attention?.stage).toBe(attentionSteps[0]?.name);
      expect(attention?.status).toBe('attention');

      const completedSteps = getWorkflowStepConfigs(completed?.id ?? 0);
      moveWorkflowToStage(completed?.id ?? 0, completedSteps[0]?.id ?? 0);
      expect(completed?.stage).toBe(completedSteps[0]?.name);
      expect(completed?.status).toBe('active');
      expect(completed?.progress).toBe(0);
    } finally {
      if (attention && attentionSnapshot) Object.assign(attention, attentionSnapshot);
      if (completed && completedSnapshot) Object.assign(completed, completedSnapshot);
    }
  });
});
