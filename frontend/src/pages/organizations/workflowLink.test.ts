import { describe, expect, it } from 'vitest';

import { advanceWorkflowStage, createUniversityWorkflow, nextWorkflowStepName, workflowItemsMock } from '../workflow/mocks';
import { universityItemsMock } from './mocks';
import { linkWorkflowsToUniversities, listUniversityWorkflows } from './workflowLink';

describe('связь вуза и workflow', () => {
  it('находит уже существующие цепочки вуза и видит смену этапа', () => {
    linkWorkflowsToUniversities();
    const mgu = universityItemsMock.find((university) => university.shortName === 'МГУ');
    const workflow = listUniversityWorkflows(mgu?.id ?? 0).find((row) => row.stage === 'Поиск контакта');
    const stored = workflowItemsMock.find((item) => item.id === workflow?.id);
    const snapshot = stored ? { ...stored } : undefined;

    try {
      expect(workflow).toBeTruthy();
      expect(workflow?.status).toBe('active');
      const rows = listUniversityWorkflows(mgu?.id ?? 0);
      expect(rows.some((row) => row.status === 'attention')).toBe(true);
      expect(rows.some((row) => row.status === 'overdue')).toBe(true);
      expect(rows.some((row) => row.status === 'completed')).toBe(true);
      advanceWorkflowStage(workflow?.id ?? 0);
      expect(listUniversityWorkflows(mgu?.id ?? 0).find((row) => row.id === workflow?.id)?.stage).toBe('Коммуникация');
    } finally {
      if (stored && snapshot) Object.assign(stored, snapshot);
    }
  });

  it('создаёт цепочку из 14 шагов и не дублирует ту же программу и продукт', () => {
    const university = universityItemsMock[0];
    const created = createUniversityWorkflow({
      universityId: university.id,
      university: university.name,
      universityShort: university.shortName,
      program: 'Новая программа',
      product: 'Новый продукт',
      responsible: university.manager,
      deadline: '2026-12-01',
    });
    const duplicate = createUniversityWorkflow({
      universityId: university.id,
      university: university.name,
      universityShort: university.shortName,
      program: ' новая программа ',
      product: 'Новый продукт',
      responsible: 'Кто-то ещё',
      deadline: '2026-12-02',
    });

    expect(created.created).toBe(true);
    expect(created.item.stage).toBe('Поиск контакта');
    expect(nextWorkflowStepName(created.item.id, created.item.stage)).toBe('Коммуникация');
    expect(duplicate.created).toBe(false);
    expect(duplicate.item.id).toBe(created.item.id);
    expect(listUniversityWorkflows(university.id).filter((row) => row.product === 'Новый продукт')).toHaveLength(1);
  });
});

