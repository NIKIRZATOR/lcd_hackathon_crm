import { describe, expect, it } from 'vitest';
import { startClosePlan } from './startClasses';

const ready = { carrierActive: true, accessReady: true, planClosed: true, startedOn: '2026-09-01', confirmed: true, comment: '', commentRequired: false };

describe('старт занятий', () => {
  it('закрывается только вручную, когда носитель ведёт, доступ и план есть', () => {
    expect(startClosePlan(ready).enabled).toBe(true);
    expect(startClosePlan({ ...ready, confirmed: false }).enabled).toBe(false);
    expect(startClosePlan({ ...ready, planClosed: false }).enabled).toBe(false);
    expect(startClosePlan({ ...ready, commentRequired: true }).enabled).toBe(false);
    expect(startClosePlan({ ...ready, commentRequired: true, comment: 'сдвиг согласован' }).enabled).toBe(true);
  });
});
