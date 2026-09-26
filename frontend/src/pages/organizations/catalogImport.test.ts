import { describe, expect, it } from 'vitest';

import { applyCatalog, catalogText, previewCatalog, suggestCatalogMapping } from './catalogImport';
import { universityItemsMock } from './mocks';
import { buildUniversitySections } from './sectionData';
import { buildUniversityCard } from './universityCard';

describe('suggestCatalogMapping', () => {
  it('узнаёт колонки ТЗ и близкие названия', () => {
    const mapping = suggestCatalogMapping(['Название вуза', 'Вендор', 'ПО', 'ФИО менеджера', 'Комментарий']);

    expect(mapping.name).toBe(0);
    expect(mapping.vendor).toBe(1);
    expect(mapping.software).toBe(2);
    expect(mapping.manager).toBe(3);
    expect(mapping.comment).toBe(4);
    expect(mapping.contract).toBeNull();
  });
});

describe('catalogText', () => {
  it('чинит текст, который Excel отдал в неправильной кодировке, и даты-числа', () => {
    const broken = new TextDecoder('windows-1251').decode(new TextEncoder().encode('котик'));

    expect(catalogText(broken)).toBe('котик');
    expect(catalogText('котик')).toBe('котик');
    expect(catalogText(45292)).toMatch(/202[34]/);
  });
});

describe('previewCatalog', () => {
  it('отличает новый вуз от уже известного', () => {
    const header = ['Название ВУЗа', 'ФИО Менеджера', 'ПО', 'Комментарий'];
    const mapping = suggestCatalogMapping(header);
    const preview = previewCatalog([
      header,
      ['МГТУ им. Н. Э. Баумана', 'А. Андреев', 'GitLab', 'Уточнили договор'],
      ['Новый институт', 'И. Кузнецов', 'TestIT', ''],
    ], mapping);

    expect(preview.map((row) => row.action)).toEqual(['update', 'create']);
  });
});

describe('вуз из каталога', () => {
  it('получает свою карточку по данным файла, без чужих программ', () => {
    const header = ['Название ВУЗа', 'Вендор', 'ПО', 'ФИО Менеджера', 'Комментарий'];
    const mapping = suggestCatalogMapping(header);
    applyCatalog([header, ['котик', 'пупин', 'попа', 'пупин', 'новый комментарий']], mapping);
    const item = universityItemsMock.find((university) => university.name === 'котик');

    expect(item).toBeTruthy();
    expect(buildUniversityCard(item!).universityOwners).toEqual([]);
    expect(buildUniversityCard(item!).attention).toEqual([]);
    expect(buildUniversitySections(item!).programs[0]?.product).toBe('попа');
    expect(buildUniversitySections(item!).programs[0]?.vendor).toBe('пупин');
  });
});

