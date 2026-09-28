import type { KamUser, PublishedPlaybook } from './types';

export const SAMPLE_PLAYBOOKS: PublishedPlaybook[] = [
  { id: 'full-cycle', name: 'Полный цикл', status: 'published' },
  { id: 'expansion', name: 'Расширение', status: 'published' },
  { id: 'license-renewal', name: 'Продление лицензии', status: 'published' },
  { id: 'short-school', name: 'Короткий школьный', status: 'published' },
  { id: 'replace-teacher', name: 'Замена преподавателя', status: 'published' },
];

export const SAMPLE_KAMS: KamUser[] = [
  { id: 'kam-anna', name: 'Анна Соколова' },
  { id: 'kam-ivan', name: 'Иван Петров' },
  { id: 'kam-olga', name: 'Ольга Крылова' },
];