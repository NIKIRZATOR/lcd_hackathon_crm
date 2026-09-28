/**
 * Временные значения вкладки «Воркфлоу».
 * Живой ответ сервера всегда важнее. Демо-строки с id gap- попадают только в пустой журнал.
 */

export type WorkflowFieldGap = {
  screen: string;
  field: string;
  endpoint: string;
  missing: string;
  temporary: string;
};

export const workflowBackendFieldGaps: WorkflowFieldGap[] = [
  {
    screen: 'Журнал',
    field: 'Студенты и заявки',
    endpoint: 'GET /api/workflow-journal',
    missing: 'students_count и applications_count бывают null.',
    temporary: 'Стабильные числа от id программы.',
  },
  {
    screen: 'Карточка программы',
    field: 'Название фазы',
    endpoint: 'GET /api/program-instances/{id}/workflow',
    missing: 'phase_name иногда приходит как Other.',
    temporary: '«Прочее».',
  },
  {
    screen: 'Карточка программы',
    field: 'Баннер действия',
    endpoint: 'GET /api/nba/today',
    missing: 'У программы может не быть строки очереди.',
    temporary: '«Нет открытого действия по этой программе».',
  },
  {
    screen: 'Журнал',
    field: 'Демо-программы',
    endpoint: 'GET /api/workflow-journal',
    missing: 'Пустой журнал не на чем смотреть.',
    temporary: 'sampleJournal(), id начинается с gap-.',
  },
];

const hash = (value: string) => [...value].reduce((sum, char) => sum + char.charCodeAt(0), 0);

export const isGapProgram = (id: string) => id.startsWith('gap-');

export const filledCount = (id: string, live: number | null | undefined, shift = 0) => (
  typeof live === 'number' ? live : 12 + ((hash(id) + shift) % 48)
);

export const filledPhase = (value?: string | null) => {
  const name = value?.trim();
  if (!name || name.toLowerCase() === 'other') return 'Прочее';
  return name;
};

export const emptyActionText = 'Нет открытого действия по этой программе';

export const sampleJournal = () => [
  {
    id: 'gap-program-devops',
    organization: 'Южный федеральный университет',
    direction: 'DevOps',
    product: 'Базис',
    playbook: 'Полный цикл',
    stage: 'Первая встреча',
    due: '2026-09-20',
    healthScore: 62,
    healthBand: 'yellow' as const,
    kam: 'Анна Соколова',
    students: 36,
    applications: 14,
  },
  {
    id: 'gap-program-web',
    organization: 'Санкт-Петербургский политехнический университет',
    direction: 'Веб-разработка',
    product: 'Яга',
    playbook: 'Расширение',
    stage: 'Ведение занятий',
    due: '2026-10-01',
    healthScore: 81,
    healthBand: 'green' as const,
    kam: 'Анна Соколова',
    students: 54,
    applications: 9,
  },
];
