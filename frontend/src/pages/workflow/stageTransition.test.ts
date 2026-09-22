import { describe, expect, it } from 'vitest';

import { advanceWorkflowStage, getWorkflowDetailMock, workflowItemsMock } from './mocks';
import { resolveCurrentStageIndex, transitionToNextStage } from './stageTransition';

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
