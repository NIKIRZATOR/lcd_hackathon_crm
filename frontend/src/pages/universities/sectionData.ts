import type { UniversityItem } from './types';

export type WorkStatus = 'active' | 'done' | 'paused';
export type TrainingStatus = 'done' | 'progress' | 'notStarted';
export type Readiness = 'ready' | 'training' | 'interested' | 'needs';
export type ProgramStatus = 'active' | 'development';
export type TransferStatus = 'done' | 'expiring';
export type DocumentStatus = 'signed' | 'pending' | 'actual' | 'review' | 'draft';
export type TaskKind = 'task' | 'meeting' | 'communication';
export type TaskState = 'inProgress' | 'planned';
export type HistoryArea = 'users' | 'integrations' | 'documents';

export interface SectionProgram {
  id: string;
  name: string;
  direction: string;
  product: string;
  vendor: string;
  streams: number;
  students: number;
  status: ProgramStatus;
}

export interface SectionLicense {
  product: string;
  contract: string;
  signedAt: string;
  due: string;
  transfer: TransferStatus;
}

export interface SectionTeacher {
  id: string;
  name: string;
  department: string;
  program: string;
  training: TrainingStatus;
  qualification: string;
  readiness: Readiness;
}

export interface TeacherSummary {
  total: number;
  ready: number;
  training: number;
  notStarted: number;
  expiring: number;
  programs: number;
}

export interface SectionDocument {
  id: string;
  name: string;
  linked: string;
  version: string;
  status: DocumentStatus;
  updated: string;
  owner: string;
  type: string;
  interaction: string;
  at?: string;
}

export interface SectionDocAlert {
  days: string;
  title: string;
  level: 'soon' | 'important';
}

export interface SectionTask {
  id: string;
  title: string;
  kind: TaskKind;
  linked: string;
  due: string;
  owner: string;
  priority: 'high' | 'medium' | 'low';
  status: TaskState;
  at?: string;
}

export interface SectionHistory {
  id: string;
  when: string;
  title: string;
  text: string;
  area: HistoryArea;
  interaction: string;
  actor: string;
  at?: string;
}

export interface SectionStream {
  id: string;
  name: string;
  program: string;
  students: number;
  status: WorkStatus;
}

export interface UniversitySections {
  programs: SectionProgram[];
  licenses: SectionLicense[];
  directions: string[];
  teachers: SectionTeacher[];
  teacherSummary: TeacherSummary;
  documents: SectionDocument[];
  docAlerts: SectionDocAlert[];
  tasks: SectionTask[];
  history: SectionHistory[];
  streams: SectionStream[];
}

const bauman = (): UniversitySections => ({
  programs: [
    { id: 'p1', name: 'DevOps Basic', direction: 'DevOps', product: 'GitLab', vendor: 'GitLab Inc.', streams: 2, students: 420, status: 'active' },
    { id: 'p2', name: 'QA Advanced', direction: 'QA', product: 'TestIT', vendor: 'Test IT', streams: 1, students: 200, status: 'active' },
    { id: 'p3', name: 'Python for DS', direction: 'Data Science', product: 'DataLens', vendor: 'Yandex Cloud', streams: 1, students: 180, status: 'development' },
    { id: 'p4', name: 'Информационная безопасность', direction: 'ИБ', product: 'Kaspersky', vendor: 'Kaspersky', streams: 1, students: 120, status: 'active' },
  ],
  licenses: [
    { product: 'GitLab', contract: 'RTK-0241', signedAt: '12.04.2026', due: '12.04.2027', transfer: 'done' },
    { product: 'TestIT', contract: 'RTK-0258', signedAt: '20.05.2026', due: '20.10.2026', transfer: 'expiring' },
  ],
  directions: ['DevOps', 'QA', 'Data Science', 'ИБ'],
  teachers: [
    { id: 't1', name: 'Соколов И.А.', department: 'Кафедра ИУ6', program: 'DevOps', training: 'done', qualification: 'до 12.04.2027', readiness: 'ready' },
    { id: 't2', name: 'Панкова Е.С.', department: 'Кафедра ИУ6', program: 'QA', training: 'progress', qualification: 'до 30.06.2027', readiness: 'training' },
    { id: 't3', name: 'Никитин О.В.', department: 'Кафедра ИБ', program: 'ИБ', training: 'notStarted', qualification: '—', readiness: 'needs' },
    { id: 't4', name: 'Лебедева А.М.', department: 'Кафедра ИУ7', program: 'Python', training: 'progress', qualification: 'до 10.08.2027', readiness: 'training' },
    { id: 't5', name: 'Орлов Д.П.', department: 'Кафедра ИУ5', program: 'Data Science', training: 'done', qualification: 'до 01.02.2027', readiness: 'ready' },
    { id: 't6', name: 'Белова О.Н.', department: 'Кафедра ИУ8', program: 'DevOps', training: 'notStarted', qualification: 'до 15.09.2026', readiness: 'interested' },
  ],
  teacherSummary: { total: 620, ready: 512, training: 76, notStarted: 32, expiring: 18, programs: 4 },
  documents: [
    { id: 'd1', name: 'Договор о сотрудничестве', linked: 'DevOps · GitLab', version: 'v2.1', status: 'signed', updated: '24 окт.', owner: 'А. Андреев', type: 'Договор', interaction: 'DevOps · GitLab' },
    { id: 'd2', name: 'Лицензионное соглашение', linked: 'QA · TestIT', version: 'v1.0', status: 'pending', updated: '23 окт.', owner: 'Е. Петрова', type: 'Лицензия', interaction: 'QA · TestIT' },
    { id: 'd3', name: 'Учебная программа', linked: 'Python · DataLens', version: 'v0.9', status: 'actual', updated: '20 окт.', owner: 'И. Кузнецов', type: 'Программа', interaction: 'Python · DataLens' },
    { id: 'd4', name: 'План мероприятий', linked: 'Все взаимодействия', version: 'v1.0', status: 'review', updated: '18 окт.', owner: 'А. Андреев', type: 'План', interaction: 'Все взаимодействия' },
    { id: 'd5', name: 'Акт передачи лицензий', linked: 'ИБ · Kaspersky', version: 'v2.0', status: 'draft', updated: '15 окт.', owner: 'А. Смирнов', type: 'Акт', interaction: 'ИБ · Kaspersky' },
  ],
  docAlerts: [
    { days: '14 дней', title: 'Истекает лицензия TestIT', level: 'soon' },
    { days: '3 дня', title: 'Договор ожидает подписи ВУЗа', level: 'important' },
  ],
  tasks: [
    { id: 'k1', title: 'Получить подписанный договор', kind: 'task', linked: 'DevOps · GitLab', due: '25 окт.', owner: 'А. Андреев', priority: 'high', status: 'inProgress' },
    { id: 'k2', title: 'Встреча с кафедрой ИУ', kind: 'meeting', linked: 'QA · TestIT', due: '27 окт.', owner: 'Е. Петрова', priority: 'medium', status: 'planned' },
    { id: 'k3', title: 'Передать лицензии', kind: 'task', linked: 'DevOps · GitLab', due: '30 окт.', owner: 'А. Андреев', priority: 'medium', status: 'planned' },
    { id: 'k4', title: 'Проверить обучение преподавателей', kind: 'task', linked: 'ИБ · Kaspersky', due: '2 нояб.', owner: 'А. Смирнов', priority: 'low', status: 'planned' },
    { id: 'k5', title: 'Письмо о старте пилота', kind: 'communication', linked: 'Python · DataLens', due: '4 нояб.', owner: 'И. Кузнецов', priority: 'medium', status: 'planned' },
  ],
  history: [
    { id: 'h1', when: 'Сегодня, 14:32', title: 'Изменён ответственный по ВУЗу', text: 'Екатерина Иванова назначила менеджером Алексея Андреева.', area: 'users', interaction: 'DevOps · GitLab', actor: 'Екатерина Иванова' },
    { id: 'h2', when: 'Сегодня, 12:15', title: 'Получена новая версия договора', text: 'DevOps · GitLab · Договор о сотрудничестве v2.1.', area: 'documents', interaction: 'DevOps · GitLab', actor: 'А. Андреев' },
    { id: 'h3', when: 'Вчера, 17:40', title: 'Преподаватель завершил обучение в LMS', text: 'QA · TestIT · Панкова Е.С.', area: 'integrations', interaction: 'QA · TestIT', actor: 'Панкова Е.С.' },
    { id: 'h4', when: '18 сентября, 10:20', title: 'Создано взаимодействие', text: 'Python · DataLens · ответственный И. Кузнецов.', area: 'integrations', interaction: 'Python · DataLens', actor: 'И. Кузнецов' },
    { id: 'h5', when: '16 сентября, 15:05', title: 'Добавлен контакт ВУЗа', text: 'Дмитрий Кузнецов, руководитель кафедры ИТ.', area: 'users', interaction: 'ИБ · Kaspersky', actor: 'А. Смирнов' },
  ],
  streams: [
    { id: 's1', name: 'Поток 1', program: 'DevOps Basic', students: 220, status: 'active' },
    { id: 's2', name: 'Поток 2', program: 'DevOps Basic', students: 200, status: 'active' },
    { id: 's3', name: 'Поток QA', program: 'QA Advanced', students: 200, status: 'paused' },
    { id: 's4', name: 'Поток DS', program: 'Python for DS', students: 180, status: 'active' },
  ],
});

const owners = ['А. Андреев', 'Е. Петрова', 'И. Кузнецов', 'А. Смирнов', 'А. Волкова'];
const directions = ['DevOps', 'QA', 'Data Science', 'ИБ', 'Backend'];

const shiftDate = (start: string, days: number) => {
  const date = new Date(`${start}T00:00:00`);
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
};

const stamp = <T extends { at?: string }>(rows: T[], start: string) =>
  rows.map((row, index) => ({ ...row, at: row.at ?? shiftDate(start, index * 4) }));

const withCatalog = (sections: UniversitySections, university: UniversityItem): UniversitySections => {
  const catalog = university.catalog;
  if (!catalog || (!catalog.software && !catalog.contract)) return sections;

  const program = {
    id: `catalog-${university.id}`,
    name: catalog.software || 'ПО из каталога',
    direction: university.profile,
    product: catalog.software,
    vendor: catalog.vendor,
    streams: university.streams,
    students: 0,
    status: 'active' as const,
  };
  const license = catalog.contract ? [{
    product: catalog.software,
    contract: catalog.contract,
    signedAt: catalog.licenseSignedAt,
    due: catalog.licenseYear,
    transfer: catalog.transferStatus.toLowerCase().includes('истек') ? 'expiring' as const : 'done' as const,
  }] : [];

  return {
    ...sections,
    programs: [program, ...sections.programs.filter((item) => item.product !== catalog.software)],
    licenses: [...license, ...sections.licenses],
    directions: [...new Set([university.profile, ...sections.directions])],
  };
};

const catalogSections = (university: UniversityItem): UniversitySections => ({
  programs: [],
  licenses: [],
  directions: university.profile ? [university.profile] : [],
  teachers: [],
  teacherSummary: { total: 0, ready: 0, training: 0, notStarted: 0, expiring: 0, programs: university.programs },
  documents: [],
  docAlerts: [],
  tasks: [],
  history: [{
    id: `${university.id}-import`,
    when: 'Сегодня',
    title: 'Вуз загружен из каталога',
    text: university.catalog?.comment || university.activityText,
    area: 'documents',
    interaction: university.product || 'Каталог',
    actor: university.manager,
  }],
  streams: [],
});

const emptySections = (): UniversitySections => ({
  programs: [],
  licenses: [],
  directions: [],
  teachers: [],
  teacherSummary: { total: 0, ready: 0, training: 0, notStarted: 0, expiring: 0, programs: 0 },
  documents: [],
  docAlerts: [],
  tasks: [],
  history: [],
  streams: [],
});

const liveSections = new Map<string, UniversitySections>();

export const setLiveUniversitySections = (universityId: string, sections: UniversitySections) => {
  liveSections.set(universityId, sections);
};

export const buildUniversitySections = (university: UniversityItem): UniversitySections => {
  const live = liveSections.get(String(university.id));
  if (live) return live;
  if (typeof university.id !== 'number') return emptySections();

  const source = university.catalog && university.interactions === 0
    ? catalogSections(university)
    : university.id === 1 ? bauman() : generatedSections(university);
  return withCatalog({
    ...source,
    tasks: stamp(source.tasks, '2024-11-30'),
    documents: stamp(source.documents, '2024-11-15'),
    history: stamp(source.history, '2024-10-24'),
  }, university);
};

const generatedSections = (university: UniversityItem): UniversitySections => {
  const universityId = typeof university.id === 'number' ? university.id : 0;

  const count = Math.max(university.interactions, 1);
  const placeholders = Array.from({ length: count }, (_, index) => ({
    program: directions[index % directions.length],
    product: ['GitLab', 'TestIT', 'DataLens', 'Kaspersky'][index % 4],
    nextStep: 'Согласовать следующий шаг',
    due: `${10 + index} нояб.`,
    owner: owners[(universityId + index) % owners.length],
  }));

  const programs: SectionProgram[] = directions.slice(0, Math.max(university.programs, 1)).map((direction, index) => ({
    id: `${university.id}-p${index}`,
    name: `${direction} ${index + 1}`,
    direction,
    product: placeholders[index % placeholders.length]?.product ?? 'GitLab',
    vendor: 'Вендор',
    streams: 1,
    students: 80 + index * 40,
    status: index % 3 === 2 ? 'development' : 'active',
  }));

  return {
    programs,
    licenses: programs.slice(0, 2).map((program, index) => ({
      product: program.product,
      contract: `RTK-0${university.id}${index}`,
      signedAt: '01.03.2026',
      due: '01.03.2027',
      transfer: index === 0 ? 'done' : 'expiring',
    })),
    directions: [...new Set(programs.map((program) => program.direction))],
    teachers: programs.map((program, index) => ({
      id: `${university.id}-t${index}`,
      name: ['Соколов И.А.', 'Панкова Е.С.', 'Никитин О.В.', 'Лебедева А.М.'][index % 4],
      department: `Кафедра ${index + 1}`,
      program: program.direction,
      training: (['done', 'progress', 'notStarted'] as const)[index % 3],
      qualification: index % 3 === 2 ? '—' : 'до 12.04.2027',
      readiness: (['ready', 'training', 'interested', 'needs'] as const)[index % 4],
    })),
    teacherSummary: {
      total: university.programs * 40 + 20,
      ready: university.programs * 24,
      training: university.programs * 8,
      notStarted: university.programs * 4,
      expiring: Math.max(university.programs, 1),
      programs: programs.length,
    },
    documents: placeholders.slice(0, 5).map((item, index) => ({
      id: `${university.id}-d${index}`,
      name: ['Договор о сотрудничестве', 'Лицензионное соглашение', 'Учебная программа', 'План мероприятий', 'Акт передачи'][index],
      linked: `${item.program} · ${item.product}`,
      version: `v1.${index}`,
      status: (['signed', 'pending', 'actual', 'review', 'draft'] as const)[index],
      updated: item.due,
      owner: item.owner,
      type: ['Договор', 'Лицензия', 'Программа', 'План', 'Акт'][index],
      interaction: `${item.program} · ${item.product}`,
    })),
    docAlerts: [
      { days: '14 дней', title: `Истекает лицензия ${programs[0]?.product ?? ''}`, level: 'soon' },
      { days: '3 дня', title: 'Договор ожидает подписи ВУЗа', level: 'important' },
    ],
    tasks: placeholders.slice(0, 4).map((item, index) => ({
      id: `${university.id}-k${index}`,
      title: item.nextStep,
      kind: (['task', 'meeting', 'communication'] as const)[index % 3],
      linked: `${item.program} · ${item.product}`,
      due: item.due,
      owner: item.owner,
      priority: (['high', 'medium', 'low'] as const)[index % 3],
      status: index === 0 ? 'inProgress' : 'planned',
    })),
    history: [
      { id: `${university.id}-h1`, when: 'Сегодня, 14:32', title: 'Изменён ответственный по ВУЗу', text: university.activityText, area: 'users', interaction: placeholders[0] ? `${placeholders[0].program} · ${placeholders[0].product}` : '—', actor: owners[0] },
      { id: `${university.id}-h2`, when: 'Вчера, 11:05', title: 'Обновлён документ', text: 'Загружена новая версия договора.', area: 'documents', interaction: placeholders[0] ? `${placeholders[0].program} · ${placeholders[0].product}` : '—', actor: owners[1] },
    ],
    streams: Array.from({ length: Math.max(university.streams, 0) }, (_, index) => ({
      id: `${university.id}-s${index}`,
      name: `Поток ${index + 1}`,
      program: programs[index % programs.length]?.name ?? 'Программа',
      students: 80 + index * 20,
      status: index % 3 === 2 ? 'paused' : 'active',
    })),
  };
};

export const readinessSlices = [
  { key: 'ready' as const, label: 'Готовы к запуску', percent: 42, color: '#3dce7a' },
  { key: 'training' as const, label: 'Проходят обучение', percent: 28, color: '#7700ff' },
  { key: 'interested' as const, label: 'Интересуются', percent: 20, color: '#c4b5fd' },
  { key: 'needs' as const, label: 'Требуют проработки', percent: 10, color: '#94a3b8' },
];
