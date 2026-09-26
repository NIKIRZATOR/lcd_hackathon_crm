import type { UniversityItem, UniversityStatus, UniversityType } from './types';

const profiles = ['DevOps', 'Backend', 'QA', 'Data Science', 'Frontend', 'Кибербезопасность'];
const managers = ['А. Андреев', 'Е. Петрова', 'М. Соколова', 'И. Кузнецов', 'А. Смирнов', 'К. Иванова', 'Д. Орлов', 'А. Волкова', 'П. Никитин'];
const activityTexts = ['Обновлены документы', 'Встреча с кафедрой', 'Изменён статус', 'Добавлен документ', 'Проведена встреча', 'Обновлены данные', 'Добавлен контакт'];

const highlighted: Omit<UniversityItem, 'product'>[] = [
  { id: 1, name: 'Московский государственный технический университет им. Н. Э. Баумана', shortName: 'МГТУ им. Н. Э. Баумана', city: 'Москва', region: 'Москва', type: 'federal', profile: 'DevOps', interactions: 12, programs: 8, streams: 4, status: 'active', manager: 'А. Андреев', activityAt: '2024-10-24', activityText: 'Обновлены документы' },
  { id: 2, name: 'Санкт-Петербургский политехнический университет Петра Великого', shortName: 'СПбПУ им. Петра Великого', city: 'Санкт-Петербург', region: 'Санкт-Петербург', type: 'federal', profile: 'Backend', interactions: 9, programs: 6, streams: 3, status: 'active', manager: 'Е. Петрова', activityAt: '2024-10-23', activityText: 'Встреча с кафедрой' },
  { id: 3, name: 'Казанский федеральный университет', shortName: 'КФУ', city: 'Казань', region: 'Татарстан', type: 'federal', profile: 'QA', interactions: 7, programs: 5, streams: 2, status: 'progress', manager: 'М. Соколова', activityAt: '2024-10-22', activityText: 'Изменён статус' },
  { id: 4, name: 'Национальный исследовательский университет «Высшая школа экономики»', shortName: 'НИУ ВШЭ', city: 'Москва', region: 'Москва', type: 'research', profile: 'Data Science', interactions: 5, programs: 4, streams: 2, status: 'active', manager: 'И. Кузнецов', activityAt: '2024-10-20', activityText: 'Добавлен документ' },
  { id: 5, name: 'Томский политехнический университет', shortName: 'Томский политехнический университет', city: 'Томск', region: 'Томская область', type: 'research', profile: 'Frontend', interactions: 6, programs: 4, streams: 3, status: 'active', manager: 'А. Смирнов', activityAt: '2024-10-18', activityText: 'Проведена встреча' },
  { id: 6, name: 'Уральский федеральный университет', shortName: 'УрФУ', city: 'Екатеринбург', region: 'Свердловская область', type: 'federal', profile: 'Кибербезопасность', interactions: 4, programs: 3, streams: 1, status: 'paused', manager: 'К. Иванова', activityAt: '2024-10-16', activityText: 'Нет активности 7 дней' },
  { id: 7, name: 'Новосибирский государственный университет', shortName: 'НГУ', city: 'Новосибирск', region: 'Новосибирская область', type: 'research', profile: 'Data Science', interactions: 6, programs: 5, streams: 2, status: 'active', manager: 'Д. Орлов', activityAt: '2024-10-14', activityText: 'Обновлены данные' },
  { id: 8, name: 'Дальневосточный федеральный университет', shortName: 'ДВФУ', city: 'Владивосток', region: 'Приморский край', type: 'federal', profile: 'Backend', interactions: 3, programs: 2, streams: 1, status: 'progress', manager: 'А. Волкова', activityAt: '2024-10-12', activityText: 'Изменён статус' },
  { id: 9, name: 'Российская академия народного хозяйства и государственной службы', shortName: 'РАНХиГС', city: 'Москва', region: 'Москва', type: 'federal', profile: 'DevOps', interactions: 4, programs: 3, streams: 2, status: 'active', manager: 'П. Никитин', activityAt: '2024-10-10', activityText: 'Добавлен контакт' },
  { id: 10, name: 'Южно-Уральский государственный университет', shortName: 'ЮУрГУ', city: 'Челябинск', region: 'Челябинская область', type: 'federal', profile: 'QA', interactions: 3, programs: 2, streams: 1, status: 'paused', manager: 'Е. Петрова', activityAt: '2024-10-09', activityText: 'Нет активности 14 дней' },
];

const extraSeeds: Array<[string, string, string, string, UniversityType]> = [
  ['Московский государственный университет', 'МГУ', 'Москва', 'Москва', 'federal'],
  ['Московский физико-технический институт', 'МФТИ', 'Долгопрудный', 'Московская область', 'research'],
  ['Санкт-Петербургский государственный университет', 'СПбГУ', 'Санкт-Петербург', 'Санкт-Петербург', 'federal'],
  ['Университет ИТМО', 'ИТМО', 'Санкт-Петербург', 'Санкт-Петербург', 'research'],
  ['Национальный исследовательский ядерный университет «МИФИ»', 'НИЯУ МИФИ', 'Москва', 'Москва', 'research'],
  ['Московский авиационный институт', 'МАИ', 'Москва', 'Москва', 'research'],
  ['Российский экономический университет им. Г. В. Плеханова', 'РЭУ им. Плеханова', 'Москва', 'Москва', 'federal'],
  ['Сибирский федеральный университет', 'СФУ', 'Красноярск', 'Красноярский край', 'federal'],
  ['Южный федеральный университет', 'ЮФУ', 'Ростов-на-Дону', 'Ростовская область', 'federal'],
  ['Томский государственный университет', 'ТГУ', 'Томск', 'Томская область', 'research'],
];

const extraStatuses: UniversityStatus[] = ['active', 'active', 'progress', 'active', 'paused'];

const formatDay = (day: number) => String(day).padStart(2, '0');

const productByProfile: Record<string, string> = {
  DevOps: 'GitLab',
  Backend: 'PostgreSQL',
  QA: 'TestIT',
  'Data Science': 'DataLens',
  Frontend: 'React',
  Кибербезопасность: 'Kaspersky',
};

export const universityItemsMock: UniversityItem[] = [
  ...highlighted,
  ...extraSeeds.map(([name, shortName, city, region, type], index) => {
    const day = 28 - (index % 27);

    return {
      id: highlighted.length + index + 1,
      name,
      shortName,
      city,
      region,
      type,
      profile: profiles[index % profiles.length],
      interactions: (index * 3 + 2) % 15 + 1,
      programs: (index * 2 + 1) % 9 + 1,
      streams: (index % 4) + 1,
      status: extraStatuses[index % extraStatuses.length],
      manager: managers[index % managers.length],
      activityAt: `2024-${index % 2 === 0 ? '09' : '08'}-${formatDay(day)}`,
      activityText: activityTexts[index % activityTexts.length],
    };
  }),
].map((item) => ({ ...item, product: productByProfile[item.profile] ?? 'GitLab', interactions: 4 }));

export const findUniversity = (id: number) => universityItemsMock.find((item) => item.id === id);

export const rememberUniversity = (item: UniversityItem) => {
  const index = universityItemsMock.findIndex((entry) => entry.id === item.id);

  if (index === -1) {
    universityItemsMock.unshift(item);
    return;
  }

  universityItemsMock[index] = item;
};

export const universityProfiles = [...new Set(universityItemsMock.map((item) => item.profile))];
export const universityManagers = [...new Set(universityItemsMock.map((item) => item.manager))];

