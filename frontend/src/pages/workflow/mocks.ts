import { isWorkflowChainFinished, resolveCurrentStageIndex, transitionToNextStage } from './stageTransition';
import type { WorkflowComment, WorkflowDetailMock, WorkflowFile, WorkflowItem, WorkflowStepConfig } from './types';

const workflowBaseMock: WorkflowItem[] = [
  { id: 1, university: 'Московский государственный университет', universityShort: 'МГУ', program: 'DevOps', product: 'GitLab', stage: 'Поиск контакта', responsible: 'Иванов И.И.', deadline: '2026-09-21', status: 'active', progress: 43 },
  { id: 2, university: 'Московский физико-технический институт', universityShort: 'МФТИ', program: 'Backend', product: 'Docker', stage: 'Коммуникация', responsible: 'Петров А.А.', deadline: '2026-10-05', status: 'attention', progress: 29 },
  { id: 3, university: 'Санкт-Петербургский государственный университет', universityShort: 'СПбГУ', program: 'QA', product: 'Jira', stage: 'Документы', responsible: 'Смирнова Е.В.', deadline: '2026-09-15', status: 'overdue', progress: 64 },
  { id: 4, university: 'Новосибирский государственный университет', universityShort: 'НГУ', program: 'Data Science', product: 'Python', stage: 'Подписание', responsible: 'Иванов И.И.', deadline: '2026-09-30', status: 'active', progress: 43 },
  { id: 5, university: 'Уральский федеральный университет', universityShort: 'УрФУ', program: 'Frontend', product: 'Linux', stage: 'Материалы', responsible: 'Кузнецова О.В.', deadline: '2026-10-12', status: 'active', progress: 21 },
  { id: 6, university: 'Томский государственный университет', universityShort: 'ТГУ', program: 'Cybersecurity', product: 'PostgreSQL', stage: 'Внедрение', responsible: 'Петров А.А.', deadline: '2026-11-01', status: 'completed', progress: 100 },
  { id: 7, university: 'Национальный исследовательский университет ВШЭ', universityShort: 'ВШЭ', program: 'DevOps', product: 'GitLab', stage: 'Обучение', responsible: 'Смирнова Е.В.', deadline: '2026-10-20', status: 'attention', progress: 36 },
  { id: 8, university: 'Казанский федеральный университет', universityShort: 'КФУ', program: 'Аналитика данных', product: 'Python', stage: 'Контроль', responsible: 'Кузнецова О.В.', deadline: '2026-10-25', status: 'active', progress: 57 },
];

const additionalUniversities = [
  ['Российский экономический университет', 'РЭУ'],
  ['Российская академия народного хозяйства', 'РАНХиГС'],
  ['Московский авиационный институт', 'МАИ'],
  ['Московский технический университет связи', 'МТУСИ'],
  ['Сибирский федеральный университет', 'СФУ'],
  ['Южный федеральный университет', 'ЮФУ'],
  ['Самарский государственный технический университет', 'СГТУ'],
  ['Дальневосточный федеральный университет', 'ДВФУ'],
] as const;

const additionalPrograms = ['Python', 'Java', 'QA', 'Frontend', 'DevOps', 'Data Science'];
const additionalProducts = ['GitLab', 'Docker', 'Jira', 'Linux', 'PostgreSQL', 'Python'];
const additionalStages = ['Коммуникация', 'Документы', 'Подписание', 'Материалы', 'Обучение', 'Контроль'];
const additionalResponsibles = ['Иванов И.И.', 'Петров А.А.', 'Смирнова Е.В.', 'Кузнецова О.В.'];
const additionalStatuses: WorkflowItem['status'][] = ['active', 'attention', 'completed', 'overdue'];

export const workflowItemsMock: WorkflowItem[] = [
  ...workflowBaseMock,
  ...Array.from({ length: 48 }, (_, index) => {
    const university = additionalUniversities[index % additionalUniversities.length];

    return {
      id: index + workflowBaseMock.length + 1,
      university: university[0],
      universityShort: university[1],
      program: additionalPrograms[index % additionalPrograms.length],
      product: additionalProducts[index % additionalProducts.length],
      stage: additionalStages[index % additionalStages.length],
      responsible: additionalResponsibles[index % additionalResponsibles.length],
      deadline: `2026-${String((index % 3) + 10).padStart(2, '0')}-${String((index % 25) + 1).padStart(2, '0')}`,
      status: additionalStatuses[index % additionalStatuses.length],
      progress: (index * 13 + 17) % 101,
    };
  }),
];
 
export const workflowSummaryMock = {
  active: 18,
  attention: 4,
  completed: 6,
  overdue: 2,
};

export const workflowFilterOptions = {
  programs: [...new Set(workflowItemsMock.map((item) => item.program))],
  products: [...new Set(workflowItemsMock.map((item) => item.product))],
  stages: [...new Set(workflowItemsMock.map((item) => item.stage))],
  responsibles: [...new Set(workflowItemsMock.map((item) => item.responsible))],
};

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

const workflowStepConfigs = new Map<number, WorkflowStepConfig[]>();

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

export const getWorkflowStepConfigs = (workflowId: number) => {
  const item = workflowItemsMock.find((workflow) => workflow.id === workflowId);
  return item ? getStepConfigs(item) : [];
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

export const advanceWorkflowStage = (workflowId: number) => {
  const item = workflowItemsMock.find((workflow) => workflow.id === workflowId);

  if (!item) return undefined;

  const transition = transitionToNextStage(getWorkflowStepConfigs(workflowId), item.stage, item.status, item.progress);

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