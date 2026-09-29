import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';

import { getNextBestAction } from './getNextBestAction';
import { emptyContext } from './loadNbaContext';
import { contextFromQueueItem, dueCaption } from './nbaQueueAdapter';
import type { ChecklistFact } from './nbaTypes';
import type { NbaItem } from '../types';

const queueItem = (patch: Partial<NbaItem>): NbaItem => ({
  id: '1',
  rule_code: 'missing_stage_fact',
  severity: 'high',
  organization_id: 'o',
  organization_name: 'МИСИС',
  product_name: 'Промпт',
  reason: '',
  action: 'Открыть программу',
  priority: 'P1',
  action_target: 'checklist',
  due_at: null,
  program_instance_id: 'p1',
  ...patch,
});

const live = () => emptyContext('p1', true);

const licenseChecklist = (flags: boolean[]): ChecklistFact[] => {
  const codes = [
    ['received', 'Статус «получена подписанная»'],
    ['number', 'Номер указан'],
    ['signed', 'Дата указана'],
    ['term', 'Срок указан'],
    ['file', 'Файл приложен'],
  ] as const;
  return codes.map(([code, label], order) => ({
    code,
    label,
    required: true,
    done: flags[order] ?? false,
    order,
  }));
};

describe('getNextBestAction checklist-only', () => {
  it('first missing is status, not term', () => {
    const ctx = live();
    ctx.stageCode = 'sign_license';
    ctx.facts = licenseChecklist([false, false, false, true, false]);
    expect(getNextBestAction(ctx).text).toBe('Подтвердите получение подписанной лицензии.');
  });

  it('walks license checklist in screen order', () => {
    const ctx = live();
    ctx.stageCode = 'sign_license';
    const expected = [
      'Подтвердите получение подписанной лицензии.',
      'Укажите номер лицензии.',
      'Укажите дату подписания лицензии.',
      'Укажите срок действия лицензии.',
      'Приложите файл подписанной лицензии.',
    ];
    for (let i = 0; i < 5; i += 1) {
      ctx.facts = licenseChecklist([0, 1, 2, 3, 4].map((index) => index < i));
      expect(getNextBestAction(ctx).text).toBe(expected[i]);
    }
  });

  it('all mandatory done → ready', () => {
    const ctx = live();
    ctx.stageCode = 'sign_license';
    ctx.facts = licenseChecklist([true, true, true, true, true]);
    expect(getNextBestAction(ctx).text).toBe('Лицензия оформлена. Можно переходить к передаче продукта.');
  });

  it('overdue does not prefix the text', () => {
    const ctx = live();
    ctx.stageCode = 'sign_license';
    ctx.overdueDays = 3;
    ctx.facts = licenseChecklist([true, false, false, true, false]);
    expect(getNextBestAction(ctx).text).toBe('Укажите номер лицензии.');
  });

  it('empty live checklist → ready to advance', () => {
    const ctx = live();
    ctx.stageCode = 'sign_license';
    expect(getNextBestAction(ctx).text).toBe('Лицензия оформлена. Можно переходить к передаче продукта.');
  });

  it('queue adapter maps fact reason to NBA without async', () => {
    const rec = getNextBestAction(
      contextFromQueueItem(queueItem({ reason: 'Заполните обязательный факт: Дата первой встречи' })),
    );
    expect(rec.text).toBe('Назначьте дату первой встречи.');
  });

  it('close_stage → ready', () => {
    const rec = getNextBestAction(
      contextFromQueueItem(queueItem({ action_target: 'close_stage', reason: 'Все обязательные факты собраны — этап можно закрыть.' })),
    );
    expect(rec.priority).toBe('P2');
  });

  it('due caption from queue due_at', () => {
    expect(dueCaption(dayjs().add(5, 'day').toISOString())).toBe('Осталось 5 дн.');
  });
});
