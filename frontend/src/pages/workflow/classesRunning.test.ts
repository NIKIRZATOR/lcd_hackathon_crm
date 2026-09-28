import { describe, expect, it } from 'vitest';
import { classesClosePlan, signalTone } from './classesRunning';

describe('ведение занятий', () => {
  it('не закрывает успешно нулевых студентов и тишину дольше 30 дней', () => {
    expect(signalTone(0, 40)).toBe('red');
    expect(classesClosePlan({ hasCarrier: true, tone: 'red', students: 0, silenceDays: 40, status: 'ok', comment: 'пояснение' }).enabled).toBe(false);
    expect(classesClosePlan({ hasCarrier: true, tone: 'red', students: 0, silenceDays: 40, status: 'failed', comment: 'срыв' }).enabled).toBe(true);
    expect(classesClosePlan({ hasCarrier: true, tone: 'green', students: 12, silenceDays: 3, status: 'ok', comment: '' }).enabled).toBe(true);
    expect(classesClosePlan({ hasCarrier: true, tone: 'yellow', students: 4, silenceDays: 10, status: 'issues', comment: '' }).enabled).toBe(false);
  });
});
