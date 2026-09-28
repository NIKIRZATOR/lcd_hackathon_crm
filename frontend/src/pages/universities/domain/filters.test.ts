import { describe, expect, it } from 'vitest';

import { filterUniversities, hasActiveUniversityFilters, summarizeUniversities } from './filters';
import { emptyUniversityFilters } from '../types';
import type { UniversityItem } from '../types';

const items: UniversityItem[] = [
  {
    id: 1,
    name: 'Московский государственный технический университет',
    shortName: 'МГТУ',
    city: 'Москва',
    region: 'Москва',
    type: 'federal',
    profile: 'DevOps',
    product: 'GitLab',
    interactions: 12,
    programs: 8,
    streams: 4,
    status: 'active',
    manager: 'А. Андреев',
    activityAt: '2024-10-24',
    activityText: 'Обновлены документы',
  },
  {
    id: 2,
    name: 'Казанский федеральный университет',
    shortName: 'КФУ',
    city: 'Казань',
    region: 'Татарстан',
    type: 'federal',
    profile: 'QA',
    product: 'TestIT',
    interactions: 7,
    programs: 5,
    streams: 2,
    status: 'progress',
    manager: 'М. Соколова',
    activityAt: '2024-10-22',
    activityText: 'Изменён статус',
  },
  {
    id: 3,
    name: 'Уральский федеральный университет',
    shortName: 'УрФУ',
    city: 'Екатеринбург',
    region: 'Свердловская область',
    type: 'research',
    profile: 'Backend',
    product: 'PostgreSQL',
    interactions: 4,
    programs: 3,
    streams: 1,
    status: 'paused',
    manager: 'К. Иванова',
    activityAt: '2024-10-16',
    activityText: 'Нет активности 7 дней',
  },
];

describe('filterUniversities', () => {
  it('ищет по названию, городу и менеджеру без учёта регистра', () => {
    expect(filterUniversities(items, { ...emptyUniversityFilters, search: 'казан' }).map((item) => item.id)).toEqual([2]);
    expect(filterUniversities(items, { ...emptyUniversityFilters, search: 'андреев' }).map((item) => item.id)).toEqual([1]);
  });

  it('сужает список по статусу, региону, типу, профилю и менеджеру', () => {
    expect(filterUniversities(items, { ...emptyUniversityFilters, status: 'paused', profile: 'Backend' })).toEqual([items[2]]);
    expect(filterUniversities(items, { ...emptyUniversityFilters, region: 'Москва', type: 'federal' })).toEqual([items[0]]);
    expect(filterUniversities(items, { ...emptyUniversityFilters, manager: 'М. Соколова', type: 'research' })).toEqual([]);
    expect(filterUniversities(items, { ...emptyUniversityFilters, product: 'GitLab', period: ['2024-10-01', '2024-10-24'] }).map((item) => item.id)).toEqual([1]);
    expect(filterUniversities(items, { ...emptyUniversityFilters, period: ['2024-10-01', '2024-10-16'] }).map((item) => item.id)).toEqual([3]);
  });
});

describe('summarizeUniversities', () => {
  it('считает сводку по всему списку', () => {
    expect(summarizeUniversities(items)).toEqual({
      total: 3,
      active: 1,
      progress: 1,
      paused: 1,
      regions: 3,
      federal: 2,
    });
  });
});

describe('hasActiveUniversityFilters', () => {
  it('отличает пустые фильтры от выбранных', () => {
    expect(hasActiveUniversityFilters(emptyUniversityFilters)).toBe(false);
    expect(hasActiveUniversityFilters({ ...emptyUniversityFilters, region: 'Москва' })).toBe(true);
  });
});
