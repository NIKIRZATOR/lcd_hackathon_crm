import type { UniversityItem } from './types';

export type StageTone = 'danger' | 'progress' | 'warning' | 'success' | 'neutral';
export type TaskPriority = 'high' | 'medium' | 'low';

export interface CardPerson {
  name: string;
  role: string;
}

export interface CardInteraction {
  id: string;
  program: string;
  product: string;
  stage: string;
  tone: StageTone;
  nextStep: string;
  due: string;
  owner: string;
  at?: string;
}

export interface CardAttention {
  title: string;
  description: string;
}

export interface CardContact {
  name: string;
  role: string;
  phone: string;
  email: string;
}

export interface CardTask {
  date: string;
  title: string;
  kind: string;
  priority: TaskPriority;
}

export interface UniversityCard {
  site: string;
  partnership: string;
  score: number;
  students: number;
  teachers: number;
  products: number;
  rtkManager: CardPerson;
  universityOwners: CardPerson[];
  attention: CardAttention[];
  contacts: CardContact[];
  tasks: CardTask[];
}

const fullManagerNames: Record<string, string> = {
  'А. Андреев': 'Алексей Андреев',
  'Е. Петрова': 'Елена Петрова',
  'М. Соколова': 'Мария Соколова',
  'И. Кузнецов': 'Игорь Кузнецов',
  'А. Смирнов': 'Анна Смирнова',
  'К. Иванова': 'Кира Иванова',
  'Д. Орлов': 'Дмитрий Орлов',
  'А. Волкова': 'Алина Волкова',
  'П. Никитин': 'Павел Никитин',
};

const ownerPool = [
  ['Иван Петров', 'Проректор по учебной работе'],
  ['Анна Смирнова', 'Начальник УМО'],
  ['Дмитрий Кузнецов', 'Руководитель кафедры ИТ'],
  ['Ольга Белова', 'Директор института'],
  ['Сергей Морозов', 'Заведующий кафедрой'],
];

const programPool = [
  ['DevOps', 'GitLab'],
  ['QA', 'TestIT'],
  ['Python', 'DataLens'],
  ['ИБ', 'Kaspersky'],
  ['Backend', 'PostgreSQL'],
  ['Frontend', 'React'],
  ['Data Science', 'Python'],
  ['Аналитика', 'Yandex DataLens'],
];

const stages: Array<[string, StageTone, string]> = [
  ['Согласование', 'danger', 'Подготовить программу пилотного запуска'],
  ['В работе', 'progress', 'Провести встречу с кафедрой'],
  ['Подписание', 'warning', 'Ожидание подписанного экземпляра'],
  ['Обучение', 'success', 'Проверить завершение курса'],
  ['Документы', 'neutral', 'Передать комплект документов'],
];

const priorityCycle: TaskPriority[] = ['high', 'medium', 'medium', 'low'];

const scoreOverrides = new Map<number | string, number>();

export const levelByScore = (score: number) => {
  if (score >= 75) return { label: 'Высокий уровень', note: 'Стабильное и перспективное сотрудничество' };
  if (score >= 50) return { label: 'Средний уровень', note: 'Сотрудничество требует внимания' };
  return { label: 'Низкий уровень', note: 'Взаимодействие просело и нужен контакт' };
};

export const getUniversityScore = (universityId: number | string, fallback: number) => scoreOverrides.get(universityId) ?? fallback;

export const saveUniversityScore = (universityId: number | string, score: number) => {
  scoreOverrides.set(universityId, score);
};

const managerName = (shortName: string) => fullManagerNames[shortName] ?? shortName;

const siteFor = (university: UniversityItem) => {
  if (university.id === 1) return 'bmstu.ru';
  const slug = university.shortName.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '');
  return `${slug.slice(0, 16) || 'university'}.ru`;
};

const countOr = (value: number, fallback: number) => (value > 0 ? value : fallback);

const liveUniversityCard = (university: UniversityItem): UniversityCard => {
  const owners = university.responsibles ?? [];

  return {
    site: '—',
    partnership: university.healthScore == null ? '—' : university.healthScore >= 75 ? 'Партнёр' : university.healthScore >= 50 ? 'В процессе' : 'Пауза',
    score: university.healthScore ?? 0,
    students: university.studentsCount ?? -1,
    teachers: university.teachersCount ?? -1,
    products: university.productsCount ?? -1,
    rtkManager: { name: university.manager || '—', role: 'Менеджер от РТК' },
    universityOwners: owners.map((person) => ({ name: person.name || '—', role: person.role || '—' })),
    attention: university.activityText && university.activityText !== '—'
      ? [{ title: university.activityText, description: '—' }]
      : [],
    contacts: owners.map((person) => ({
      name: person.name || '—',
      role: person.role || '—',
      phone: person.phone || '—',
      email: person.email || '—',
    })),
    tasks: [],
  };
};

export const buildUniversityCard = (university: UniversityItem): UniversityCard => {
  if (typeof university.id !== 'number') return liveUniversityCard(university);
  const universityId = university.id;

  const interactionCount = countOr(university.interactions, 0);
  const programCount = countOr(university.programs, 0);
  const streamCount = countOr(university.streams, 0);
  const owners = university.responsibles?.length
    ? university.responsibles.map((person) => [person.name, person.role || 'Ответственный от вуза'] as [string, string])
    : university.catalog
      ? []
      : [0, 1].map((shift) => ownerPool[(universityId + shift) % ownerPool.length]);
  const interactions = Array.from({ length: interactionCount }, (_, index) => {
    const [program, product] = programPool[(universityId + index) % programPool.length];
    const [stage, tone, nextStep] = stages[index % stages.length];
    const day = 25 + (index % 6);

    return {
      id: `${universityId}-${index + 1}`,
      program,
      product,
      stage,
      tone,
      nextStep,
      due: `${day} нояб.`,
      owner: index % 2 === 0 ? university.manager : 'Е. Петрова',
      at: `2024-11-${String(Math.max(1, 28 - index)).padStart(2, '0')}`,
    };
  });
  const products = university.catalog && interactionCount === 0
    ? Number(Boolean(university.product))
    : new Set(interactions.map((item) => item.product)).size;
  const teachers = university.catalog && interactionCount === 0 ? 0 : programCount * 70 + universityId * 13 + 48;
  const students = university.catalog && interactionCount === 0 ? 0 : streamCount * 1800 + teachers * 8 + 120;

  return {
    site: university.catalog && interactionCount === 0 ? '' : siteFor(university),
    partnership: university.status === 'paused' ? 'Пауза' : university.status === 'progress' ? 'В процессе' : 'Партнёр',
    score: universityId === 1 ? 82 : 58 + (universityId * 7) % 35,
    students,
    teachers,
    rtkManager: { name: managerName(university.manager), role: 'Менеджер от РТК' },
    universityOwners: owners.map(([name]) => ({ name, role: 'Ответственный от вуза' })),
    attention: interactionCount === 0 ? [] : [
      interactionCount > 2 && { title: `${Math.max(1, interactionCount % 3)} просроченные задачи`, description: 'Требуют подтверждения' },
      { title: '1 лицензия истекает через 14 дней', description: programPool[universityId % programPool.length][1] },
      { title: 'Документ ожидает подписания', description: 'Договор о сотрудничестве' },
      programCount > 0 && { title: `${Math.max(1, programCount % 4)} преподавателя не начали обучение`, description: `Программа ${programPool[0][0]}` },
    ].filter((item): item is CardAttention => Boolean(item)),
    contacts: owners.slice(0, 3).map(([name, role]) => ({
      name,
      role,
      phone: '—',
      email: '—',
    })),
    tasks: Array.from({ length: Math.min(4, interactionCount) }, (_, index) => ({
      date: `${25 + index * 2} окт.`,
      title: stages[index % stages.length][2],
      kind: index % 2 === 0 ? 'Документы' : 'Встреча',
      priority: priorityCycle[index % priorityCycle.length],
    })),
    products,
  };
};

