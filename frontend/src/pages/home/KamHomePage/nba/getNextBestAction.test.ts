import { describe, expect, it } from 'vitest';

import { getNextBestAction } from './getNextBestAction';
import { emptyContext } from './loadNbaContext';
import type { ChecklistFact } from './nbaTypes';

const live = () => emptyContext('p1', true);

const licenseChecklist = (flags: Array<boolean | undefined>): ChecklistFact[] => {
  const rows = [
    ['received', 'Статус «получена подписанная»'],
    ['number', 'Номер указан'],
    ['signed', 'Дата указана'],
    ['term', 'Срок указан'],
    ['file', 'Файл приложен'],
  ] as const;
  return rows.map(([code, label], order) => ({
    code,
    label,
    required: true,
    completed: flags[order] === true,
    order,
  }));
};

describe('getNextBestAction from workflow checklist', () => {
  it('T T F T F → date', () => {
    const ctx = live();
    ctx.stageCode = 'sign_license';
    ctx.facts = licenseChecklist([true, true, false, true, false]);
    expect(getNextBestAction(ctx).text).toBe('Укажите дату подписания лицензии.');
  });

  it('T T T T F → file', () => {
    const ctx = live();
    ctx.stageCode = 'sign_license';
    ctx.facts = licenseChecklist([true, true, true, true, false]);
    expect(getNextBestAction(ctx).text).toBe('Приложите файл подписанной лицензии.');
  });

  it('T T T T T → ready', () => {
    const ctx = live();
    ctx.stageCode = 'sign_license';
    ctx.facts = licenseChecklist([true, true, true, true, true]);
    expect(getNextBestAction(ctx).text).toBe('Лицензия оформлена. Можно переходить к передаче продукта.');
  });

  it('F T T T T → status', () => {
    const ctx = live();
    ctx.stageCode = 'sign_license';
    ctx.facts = licenseChecklist([false, true, true, true, true]);
    expect(getNextBestAction(ctx).text).toBe('Подтвердите получение подписанной лицензии.');
  });

  it('T F T T T → number', () => {
    const ctx = live();
    ctx.stageCode = 'sign_license';
    ctx.facts = licenseChecklist([true, false, true, true, true]);
    expect(getNextBestAction(ctx).text).toBe('Укажите номер лицензии.');
  });

  it('treats undefined completed as missing', () => {
    const ctx = live();
    ctx.stageCode = 'sign_license';
    ctx.facts = licenseChecklist([true, true, undefined, true, true]);
    expect(getNextBestAction(ctx).text).toBe('Укажите дату подписания лицензии.');
  });
});
