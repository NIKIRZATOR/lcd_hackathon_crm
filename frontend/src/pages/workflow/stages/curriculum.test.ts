import { describe, expect, it } from 'vitest';

import { curriculumClosePlan } from './curriculum';

const ready = { carrierActive: true, accessReady: true, hasPlan: true, comment: '', windowId: null };

describe('учебный план', () => {
  it('закрывается при носителе «ведёт», доступе и плане или комментарии от 40 знаков', () => {
    expect(curriculumClosePlan(ready).enabled).toBe(true);
    expect(curriculumClosePlan({ ...ready, hasPlan: false, comment: 'x'.repeat(40) }).enabled).toBe(true);
    expect(curriculumClosePlan({ ...ready, hasPlan: false, comment: 'коротко' }).enabled).toBe(false);
    expect(curriculumClosePlan({ ...ready, carrierActive: false }).enabled).toBe(false);
    expect(curriculumClosePlan({ ...ready, accessReady: false }).enabled).toBe(false);
    expect(curriculumClosePlan({ ...ready, windowId: null }).enabled).toBe(true);
  });
});
