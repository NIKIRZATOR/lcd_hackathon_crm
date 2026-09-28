import { describe, expect, it } from 'vitest';
import { periodClosePlan } from './periodResults';

describe('итоги периода', () => {
  it('закрывается только с вердиктом и комментарием, у срыва нужна причина', () => {
    expect(periodClosePlan({ verdict: 'success', reason: null, comment: 'итог' }).enabled).toBe(true);
    expect(periodClosePlan({ verdict: 'failed', reason: null, comment: 'итог' }).enabled).toBe(false);
    expect(periodClosePlan({ verdict: 'failed', reason: 'teacher', comment: 'ушёл' }).enabled).toBe(true);
    expect(periodClosePlan({ verdict: null, reason: null, comment: 'итог' }).enabled).toBe(false);
  });

  it('ведёт к контролю, а не завершает заход', () => {
    expect(periodClosePlan({ verdict: 'success', reason: null, comment: 'итог' }).button).toBe('Перейти к контролю исполнения');
  });
});
