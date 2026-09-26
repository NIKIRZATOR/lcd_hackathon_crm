import * as XLSX from 'xlsx';

import { universityItemsMock } from './mocks';
import type { UniversityCatalog, UniversityItem, UniversityResponsible, UniversityType } from './types';

export const catalogFields = [
  { key: 'name', title: 'Название ВУЗа', required: true, aliases: ['название вуза', 'вуз', 'университет'] },
  { key: 'vendor', title: 'Вендор', required: false, aliases: ['вендор'] },
  { key: 'software', title: 'ПО', required: false, aliases: ['по', 'продукт', 'ит-продукт'] },
  { key: 'contract', title: 'Номер договора', required: false, aliases: ['номер договора', 'договор'] },
  { key: 'licenseSignedAt', title: 'Подписание лицензии', required: false, aliases: ['подписание лицензии', 'дата подписания'] },
  { key: 'licenseYear', title: 'Срок действия лицензии (год)', required: false, aliases: ['срок действия лицензии', 'срок лицензии', 'год лицензии'] },
  { key: 'transferStatus', title: 'Статус по передачи', required: false, aliases: ['статус передачи', 'статус по передаче'] },
  { key: 'manager', title: 'ФИО Менеджера', required: false, aliases: ['фио менеджера', 'менеджер'] },
  { key: 'responsibles', title: 'Ответственные от ВУЗа', required: false, aliases: ['ответственные от вуза', 'ответственные'] },
  { key: 'comment', title: 'Комментарий', required: false, aliases: ['комментарий'] },
] as const;

export type CatalogField = (typeof catalogFields)[number]['key'];
export type CatalogMapping = Record<CatalogField, number | null>;

export interface CatalogPreviewRow {
  name: string;
  action: 'create' | 'update';
  manager: string;
  software: string;
  comment: string;
}

const normalize = (value: string) => value.trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');

const cp1251From80 = new TextDecoder('windows-1251').decode(Uint8Array.from({ length: 128 }, (_, index) => 128 + index));

const encodeCp1251 = (symbol: string) => {
  const code = symbol.charCodeAt(0);
  if (code < 128) return code;
  const index = cp1251From80.indexOf(symbol);
  return index === -1 ? 0x3f : 128 + index;
};

// «котик» в сломанной кодировке выглядит как «РєРѕС‚РёРє». Обычные русские слова так не выглядят.
const repairMojibake = (value: string) => {
  if (!/[єѕѓґїљњќћџ‚]/.test(value)) return value;

  const decoded = new TextDecoder('utf-8', { fatal: false }).decode(Uint8Array.from([...value].map(encodeCp1251)));
  if (decoded.includes('\uFFFD')) return value;

  return (decoded.match(/[а-яё]/gi) ?? []).length >= 2 ? decoded : value;
};

const excelSerialToDate = (value: number) => {
  if (value < 20000 || value > 80000) return '';
  const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
  const year = date.getUTCFullYear();
  if (year < 1990 || year > 2100) return '';
  return date.toLocaleDateString('ru-RU');
};

const stripControlCharacters = (value: string) =>
  [...value].filter((symbol) => {
    const code = symbol.charCodeAt(0);
    return code === 9 || code === 10 || code === 13 || code >= 32;
  }).join('');

export const catalogText = (value: unknown) => {
  if (value == null) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toLocaleDateString('ru-RU');
  if (typeof value === 'number') return excelSerialToDate(value) || String(value);

  return repairMojibake(stripControlCharacters(String(value))).trim();
};

export const readCatalogRows = (buffer: ArrayBuffer) => {
  const book = XLSX.read(buffer, { type: 'array', cellDates: true, codepage: 1251 });
  const sheet = book.Sheets[book.SheetNames[0]];
  const table = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '' });
  return table.map((row) => row.map((item) => catalogText(item)));
};

export const suggestCatalogMapping = (header: string[]): CatalogMapping => {
  const normalized = header.map((cell) => normalize(String(cell ?? '')));

  return catalogFields.reduce((mapping, field) => {
    const names = [normalize(field.title), ...field.aliases];
    const index = normalized.findIndex((cell) => names.includes(cell));
    return { ...mapping, [field.key]: index === -1 ? null : index };
  }, {} as CatalogMapping);
};

const cell = (row: string[], index: number | null) => {
  if (index == null || index < 0) return '';
  return catalogText(row[index]);
};

export const previewCatalog = (rows: string[][], mapping: CatalogMapping): CatalogPreviewRow[] =>
  rows.slice(1).flatMap((row) => {
    const name = cell(row, mapping.name);
    if (!name) return [];
    const known = universityItemsMock.some((item) => normalize(item.name) === normalize(name) || normalize(item.shortName) === normalize(name));
    return [{
      name,
      action: known ? 'update' : 'create',
      manager: cell(row, mapping.manager),
      software: cell(row, mapping.software),
      comment: cell(row, mapping.comment),
    }];
  });

const responsiblesFrom = (value: string): UniversityResponsible[] =>
  value.split(/[;,]/).map((part) => part.trim()).filter(Boolean).map((name) => ({ name, role: 'Ответственный от вуза' }));

const catalogFrom = (row: string[], mapping: CatalogMapping): UniversityCatalog => ({
  vendor: cell(row, mapping.vendor),
  software: cell(row, mapping.software),
  contract: cell(row, mapping.contract),
  licenseSignedAt: cell(row, mapping.licenseSignedAt),
  licenseYear: cell(row, mapping.licenseYear),
  transferStatus: cell(row, mapping.transferStatus),
  responsibles: cell(row, mapping.responsibles),
  comment: cell(row, mapping.comment),
});

export const applyCatalog = (rows: string[][], mapping: CatalogMapping) => {
  let created = 0;
  let updated = 0;

  rows.slice(1).forEach((row) => {
    const name = cell(row, mapping.name);
    if (!name) return;

    const catalog = catalogFrom(row, mapping);
    const manager = cell(row, mapping.manager);
    const responsibles = responsiblesFrom(catalog.responsibles);
    const existing = universityItemsMock.find((item) => normalize(item.name) === normalize(name) || normalize(item.shortName) === normalize(name));

    if (existing) {
      existing.catalog = catalog;
      if (manager) existing.manager = manager;
      if (catalog.software) existing.product = catalog.software;
      if (responsibles.length) existing.responsibles = responsibles;
      existing.activityAt = new Date().toISOString().slice(0, 10);
      existing.activityText = catalog.comment || 'Каталог обновлён';
      updated += 1;
      return;
    }

    const createdItem: UniversityItem = {
      id: Math.max(0, ...universityItemsMock.map((item) => (typeof item.id === 'number' ? item.id : 0))) + 1,
      name,
      shortName: name,
      city: '',
      region: '',
      type: 'federal' satisfies UniversityType,
      profile: '',
      product: catalog.software,
      interactions: 0,
      programs: catalog.software ? 1 : 0,
      streams: 0,
      status: 'active',
      manager: manager || 'Не назначен',
      responsibles,
      catalog,
      activityAt: new Date().toISOString().slice(0, 10),
      activityText: catalog.comment || 'Загружен из каталога',
    };
    universityItemsMock.unshift(createdItem);
    created += 1;
  });

  return { created, updated };
};

export const downloadCatalogTemplate = () => {
  const sheet = XLSX.utils.aoa_to_sheet([catalogFields.map((field) => field.title)]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Каталог');
  XLSX.writeFile(book, 'katalog-vuzov.xlsx');
};

