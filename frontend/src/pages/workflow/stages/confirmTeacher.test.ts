import { describe, expect, it } from 'vitest';

import { confirmClosePlan } from './confirmTeacher';

const ready = { ready: 'yes' as const, windowId: 'w', hasCarrier: true, status: 'active', qualificationUntil: '2027-01-01', today: '2026-09-27' };

describe('подтверждение преподавателя', () => {
  it('закрывается только при готовности, носителе со статусом «ведёт» и окне', () => {
    expect(confirmClosePlan(ready).enabled).toBe(true);
    expect(confirmClosePlan({ ...ready, ready: 'no' }).enabled).toBe(false);
    expect(confirmClosePlan({ ...ready, status: 'left' }).enabled).toBe(false);
    expect(confirmClosePlan({ ...ready, status: 'trained' }).enabled).toBe(false);
    expect(confirmClosePlan({ ...ready, qualificationUntil: '2026-01-01' }).enabled).toBe(false);
    expect(confirmClosePlan({ ...ready, hasCarrier: false }).enabled).toBe(false);
    expect(confirmClosePlan({ ...ready, windowId: null }).enabled).toBe(false);
  });
});
