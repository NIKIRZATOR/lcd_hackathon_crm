import { universityItemsMock } from '../universities/mocks';
import { isWorkflowChainFinished, resolveCurrentStageIndex, transitionToNextStage, transitionToStage } from './stageTransition';
import type { WorkflowComment, WorkflowDetailMock, WorkflowFile, WorkflowItem, WorkflowStatus, WorkflowStepConfig } from './types';

const interactionPairs = [
  ['DevOps', 'GitLab'],
  ['Backend', 'PostgreSQL'],
  ['QA', 'TestIT'],
  ['Data Science', 'DataLens'],
  ['Frontend', 'React'],
  ['Кибербезопасность', 'Kaspersky'],
  ['Аналитика данных', 'Python'],
  ['Python', 'Docker'],
] as const;

const stageNames = [
  'Поиск контакта',
  'Коммуникация',
  'Встреча',
  'Документы',
  'Корректировка',
  'Подписание',
  'Материалы',
  'Внедрение',
  'Обучение',
  'Программа',
  'Занятия',
  'Документация',
  'Квалификация',
  'Контроль',
];

const interactionsPerUniversity = 4;

const addDays = (isoDate: string, days: number) => {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const buildWorkflowItems = (): WorkflowItem[] => {
  const items: WorkflowItem[] = [];

  universityItemsMock.forEach((university) => {
    const universityId = typeof university.id === 'number' ? university.id : 0;
    for (let index = 0; index < interactionsPerUniversity; index += 1) {
      const [program, product] = interactionPairs[(universityId - 1 + index) % interactionPairs.length];
      const stage = index === interactionsPerUniversity - 1
        ? 'Контроль'
        : stageNames[(index * 3) % (stageNames.length - 1)];
      const stageIndex = stageNames.indexOf(stage);
      const completed = stage === 'Контроль';
      const statusCycle: WorkflowStatus[] = ['active', 'attention', 'overdue'];
      const status: WorkflowStatus = completed ? 'completed' : statusCycle[index % statusCycle.length];

      items.push({
        id: items.length + 1,
        universityId: university.id,
        university: university.name,
        universityShort: university.shortName,
        program,
        product,
        stage,
        responsible: university.manager,
        deadline: addDays(university.activityAt, index * 21),
        status,
        progress: completed ? 100 : Math.round((stageIndex / (stageNames.length - 1)) * 100),
      });
    }
  });

  return items;
};

export const workflowItemsMock: WorkflowItem[] = buildWorkflowItems();

const baseWorkflowStepConfigs: Omit<WorkflowStepConfig, 'id'>[] = [
  {
    name: 'Поиск контакта',
    description: 'Поиск ответственного представителя университета и получение его актуальных контактных данных.',
    defaultDurationDays: 3,
    isInitial: true,
    isFinal: false,
    isOptional: false,
    requiresComment: false,
    requiresAttachment: false,
    completionConditions: ['Ответственный представитель вуза найден'],
    checklistItems: ['Найти ответственного представителя вуза', 'Проверить актуальность контактных данных'],
  },
  {
    name: 'Коммуникация',
    description: 'Первичная коммуникация с представителем вуза и уточнение актуальности ИТ-программ.',
    defaultDurationDays: 5,
    isInitial: false,
    isFinal: false,
    isOptional: false,
    requiresComment: false,
    requiresAttachment: false,
    completionConditions: ['Контакт с представителем вуза установлен'],
    checklistItems: ['Связаться с представителем вуза', 'Уточнить актуальность ИТ-программы'],
  },
  {
    name: 'Встреча',
    description: 'Организация и проведение встречи с представителями университета.',
    defaultDurationDays: 7,
    isInitial: false,
    isFinal: false,
    isOptional: false,
    requiresComment: false,
    requiresAttachment: false,
    completionConditions: ['Встреча проведена'],
    checklistItems: ['Согласовать дату и время встречи', 'Провести встречу'],
  },
  {
    name: 'Документы',
    description: 'Подготовка и обмен необходимым пакетом документов для последующего подписания.',
    defaultDurationDays: 5,
    isInitial: false,
    isFinal: false,
    isOptional: false,
    requiresComment: false,
    requiresAttachment: false,
    completionConditions: ['Необходимый пакет документов подготовлен', 'Документы переданы сторонам'],
    checklistItems: ['Подготовить комплект документов', 'Передать документы представителю вуза'],
  },
  {
    name: 'Корректировка',
    description: 'При необходимости внесение изменений в документы перед подписанием.',
    defaultDurationDays: 3,
    isInitial: false,
    isFinal: false,
    isOptional: true,
    requiresComment: false,
    requiresAttachment: false,
    completionConditions: ['Все необходимые корректировки внесены'],
    checklistItems: ['Получить замечания по документам', 'Внести согласованные изменения'],
  },
  {
    name: 'Подписание',
    description: 'Согласование финальной версии документов и их подписание.',
    defaultDurationDays: 5,
    isInitial: false,
    isFinal: false,
    isOptional: false,
    requiresComment: false,
    requiresAttachment: false,
    completionConditions: ['Документы подписаны'],
    checklistItems: ['Проверить финальную версию документов', 'Получить подписанный экземпляр'],
  },
  {
    name: 'Материалы',
    description: 'Передача университету обучающих материалов, лицензии ИТ-продукта и документации.',
    defaultDurationDays: 5,
    isInitial: false,
    isFinal: false,
    isOptional: false,
    requiresComment: false,
    requiresAttachment: false,
    completionConditions: ['Необходимые материалы переданы университету'],
    checklistItems: ['Передать обучающие материалы', 'Передать лицензию ИТ-продукта', 'Передать документацию'],
  },
  {
    name: 'Внедрение',
    description: 'Сопровождение внедрения ИТ-продукта в инфраструктуру и учебный процесс университета.',
    defaultDurationDays: 10,
    isInitial: false,
    isFinal: false,
    isOptional: false,
    requiresComment: false,
    requiresAttachment: false,
    completionConditions: ['Внедрение ИТ-продукта завершено'],
    checklistItems: ['Согласовать план внедрения', 'Проверить готовность продукта к использованию'],
  },
  {
    name: 'Обучение',
    description: 'Организация обучения преподавателей работе с ИТ-продуктом.',
    defaultDurationDays: 10,
    isInitial: false,
    isFinal: false,
    isOptional: false,
    requiresComment: false,
    requiresAttachment: false,
    completionConditions: ['Обучение преподавателей проведено'],
    checklistItems: ['Сформировать список участников обучения', 'Провести обучение преподавателей'],
  },
  {
    name: 'Программа',
    description: 'Актуализация учебной программы с учётом обучения преподавателей и использования ИТ-продукта.',
    defaultDurationDays: 7,
    isInitial: false,
    isFinal: false,
    isOptional: false,
    requiresComment: false,
    requiresAttachment: false,
    completionConditions: ['Актуализированная программа подготовлена'],
    checklistItems: ['Определить необходимые изменения программы', 'Обновить учебную программу'],
  },
  {
    name: 'Занятия',
    description: 'Проведение занятий по актуализированной учебной программе.',
    defaultDurationDays: 20,
    isInitial: false,
    isFinal: false,
    isOptional: false,
    requiresComment: false,
    requiresAttachment: false,
    completionConditions: ['Учебный процесс по программе запущен'],
    checklistItems: ['Подтвердить готовность к проведению занятий', 'Начать проведение занятий'],
  },
  {
    name: 'Документация',
    description: 'Актуализация документации по ИТ-продукту и обучающим материалам.',
    defaultDurationDays: 7,
    isInitial: false,
    isFinal: false,
    isOptional: false,
    requiresComment: false,
    requiresAttachment: false,
    completionConditions: ['Актуальная документация подготовлена'],
    checklistItems: ['Проверить актуальность документации', 'Обновить необходимые материалы'],
  },
  {
    name: 'Квалификация',
    description: 'Организация мероприятий по повышению квалификации преподавателей.',
    defaultDurationDays: 10,
    isInitial: false,
    isFinal: false,
    isOptional: false,
    requiresComment: false,
    requiresAttachment: false,
    completionConditions: ['Мероприятия по повышению квалификации завершены'],
    checklistItems: ['Определить необходимость повышения квалификации', 'Организовать обучение преподавателей'],
  },
  {
    name: 'Контроль',
    description: 'Контроль исполнения обязательств и результатов взаимодействия с университетом.',
    defaultDurationDays: 5,
    isInitial: false,
    isFinal: true,
    isOptional: false,
    requiresComment: false,
    requiresAttachment: false,
    completionConditions: ['Результаты взаимодействия проверены'],
    checklistItems: ['Проверить выполнение запланированных действий', 'Зафиксировать результат взаимодействия'],
  },
];

const workflowStepConfigs = new Map<number | string, WorkflowStepConfig[]>();

const getStepConfigs = (item: WorkflowItem) => {
  const existing = workflowStepConfigs.get(item.id);
  if (existing) return existing;

  const configs = baseWorkflowStepConfigs.map((config, index) => ({
    ...config,
    id: index + 1,
    completionConditions: [...config.completionConditions],
    checklistItems: [...config.checklistItems],
  }));
  workflowStepConfigs.set(item.id, configs);
  return configs;
};

export const getWorkflowStepConfigs = (workflowId: number | string) => {
  const item = workflowItemsMock.find((workflow) => workflow.id === workflowId);
  return item ? getStepConfigs(item) : [];
};

const sameInteraction = (value: string, other: string) => value.trim().toLowerCase() === other.trim().toLowerCase();

export const findWorkflowByInteraction = (universityId: number | string, program: string, product: string) =>
  workflowItemsMock.find((item) => (
    item.universityId === universityId
    && sameInteraction(item.program, program)
    && sameInteraction(item.product, product)
  ));

export const createUniversityWorkflow = (input: {
  universityId: number | string;
  university: string;
  universityShort: string;
  program: string;
  product: string;
  responsible: string;
  deadline: string;
}) => {
  const program = input.program.trim();
  const product = input.product.trim();
  const existing = findWorkflowByInteraction(input.universityId, program, product);
  if (existing) return { item: existing, created: false as const };

  const item: WorkflowItem = {
    id: Math.max(0, ...workflowItemsMock.map((workflow) => (typeof workflow.id === 'number' ? workflow.id : 0))) + 1,
    universityId: input.universityId,
    university: input.university,
    universityShort: input.universityShort,
    program,
    product,
    stage: baseWorkflowStepConfigs[0]?.name ?? 'Поиск контакта',
    responsible: input.responsible.trim() || 'Не назначен',
    deadline: input.deadline,
    status: 'active',
    progress: 0,
  };
  workflowItemsMock.unshift(item);
  getStepConfigs(item);
  return { item, created: true as const };
};

export const nextWorkflowStepName = (workflowId: number | string, stageName: string) => {
  if (typeof workflowId !== 'number') return '—';
  const configs = getWorkflowStepConfigs(workflowId);
  const index = configs.findIndex((step) => step.name === stageName);
  if (index === -1 || index >= configs.length - 1) return '—';
  return configs[index + 1]?.name ?? '—';
};

export const updateWorkflowStepConfig = (workflowId: number, config: WorkflowStepConfig) => {
  const configs = getWorkflowStepConfigs(workflowId);
  const index = configs.findIndex((step) => step.id === config.id);
  if (index === -1) return config;
  const previousName = configs[index].name;
  configs[index] = config;
  const item = workflowItemsMock.find((workflow) => workflow.id === workflowId);
  if (item && item.stage === previousName) item.stage = config.name;
  return config;
};

export const createWorkflowStepConfig = (workflowId: number, config: Omit<WorkflowStepConfig, 'id'>) => {
  const configs = getWorkflowStepConfigs(workflowId);
  const created = { ...config, id: Math.max(0, ...configs.map((step) => step.id)) + 1 };
  configs.push(created);
  return created;
};

export const deleteWorkflowStepConfig = (workflowId: number, stepId: number) => {
  const configs = getWorkflowStepConfigs(workflowId);
  const index = configs.findIndex((step) => step.id === stepId);
  if (index === -1) return false;
  configs.splice(index, 1);
  return true;
};

export const advanceWorkflowStage = (workflowId: number | string) => {
  const item = workflowItemsMock.find((workflow) => workflow.id === workflowId);

  if (!item) return undefined;

  const transition = transitionToNextStage(getWorkflowStepConfigs(workflowId), item.stage, item.status, item.progress);

  if (!transition?.changed) return transition;

  item.stage = transition.stageName;
  item.status = transition.status;
  item.progress = transition.progress;

  return transition;
};

export const moveWorkflowToStage = (workflowId: number | string, stageId: number) => {
  const item = workflowItemsMock.find((workflow) => workflow.id === workflowId);

  if (!item) return undefined;

  const transition = transitionToStage(getWorkflowStepConfigs(workflowId), item.stage, item.status, item.progress, stageId);

  if (!transition?.changed) return transition;

  item.stage = transition.stageName;
  item.status = transition.status;
  item.progress = transition.progress;

  return transition;
};

export const reorderWorkflowStepConfigs = (workflowId: number, orderedIds: number[]) => {
  const configs = getWorkflowStepConfigs(workflowId);
  const byId = new Map(configs.map((step) => [step.id, step]));
  const reordered = orderedIds.map((id) => byId.get(id)).filter((step): step is WorkflowStepConfig => Boolean(step));

  if (reordered.length !== configs.length) {
    throw new Error('Некорректный порядок этапов');
  }

  configs.splice(0, configs.length, ...reordered);
  return [...configs];
};

type StageActivity = {
  files: WorkflowFile[];
  comments: WorkflowComment[];
};

const stageActivityByWorkflow = new Map<number, Map<number, StageActivity>>();
let nextActivityId = 1;

const demoContract: WorkflowFile = {
  id: 1,
  name: 'Договор.pdf',
  type: 'PDF',
  size: '1.2 МБ',
  uploadedAt: '15.09.2026, 14:32',
};

const ensureWorkflowActivity = (workflowId: number, currentStageId: number) => {
  let byStage = stageActivityByWorkflow.get(workflowId);

  if (!byStage) {
    byStage = new Map();
    if (currentStageId > 0) {
      byStage.set(currentStageId, { files: [{ ...demoContract }], comments: [] });
    }
    stageActivityByWorkflow.set(workflowId, byStage);
  }

  return byStage;
};

const ensureStageActivity = (workflowId: number, stageId: number, currentStageId: number) => {
  const byStage = ensureWorkflowActivity(workflowId, currentStageId);
  let activity = byStage.get(stageId);

  if (!activity) {
    activity = { files: [], comments: [] };
    byStage.set(stageId, activity);
  }

  return activity;
};

export const getWorkflowStageActivity = (workflowId: number, stageId: number, currentStageId: number) => {
  const activity = ensureStageActivity(workflowId, stageId, currentStageId);

  return {
    files: activity.files.map((file) => ({ ...file })),
    comments: activity.comments.map((comment) => ({ ...comment })),
  };
};

export const addWorkflowStageComment = (
  workflowId: number,
  stageId: number,
  currentStageId: number,
  comment: Omit<WorkflowComment, 'id'>,
) => {
  const activity = ensureStageActivity(workflowId, stageId, currentStageId);
  nextActivityId += 1;
  const created = { ...comment, id: nextActivityId };
  activity.comments = [created, ...activity.comments];

  return created;
};

export const addWorkflowStageFile = (
  workflowId: number,
  stageId: number,
  currentStageId: number,
  file: Omit<WorkflowFile, 'id'>,
) => {
  const activity = ensureStageActivity(workflowId, stageId, currentStageId);
  nextActivityId += 1;
  const created = { ...file, id: nextActivityId };
  activity.files = [...activity.files, created];

  return created;
};

export const getWorkflowDetailMock = (id: number): WorkflowDetailMock | undefined => {
  const item = workflowItemsMock.find((workflow) => workflow.id === id);

  if (!item) {
    return undefined;
  }

  const configs = getStepConfigs(item);
  const currentStageIndex = resolveCurrentStageIndex(configs, item.stage);
  const finished = isWorkflowChainFinished(configs, item.stage, item.status, item.progress);
  const activeStageIndex = finished ? configs.length : currentStageIndex;
  const currentStageId = configs[currentStageIndex]?.id ?? 0;
  const currentActivity = currentStageId
    ? getWorkflowStageActivity(id, currentStageId, currentStageId)
    : { files: [], comments: [] };

  return {
    item,
    currentStageId,
    stages: configs.map((stage, index) => ({
      id: stage.id,
      name: stage.name,
      state: index < activeStageIndex ? 'completed' : index === activeStageIndex ? 'current' : 'upcoming',
    })),
    stepConfigs: configs,
    checklist: configs[activeStageIndex]?.checklistItems.map((label, index) => ({
      id: index + 1,
      label,
      completed: false,
    })) ?? [],
    files: currentActivity.files,
    comments: currentActivity.comments,
  };
};