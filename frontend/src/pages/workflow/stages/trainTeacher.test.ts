import { describe, expect, it } from 'vitest';

import { trainClosePlan } from './trainTeacher';

const ready = { status: 'trained' as const, personId: 'p', personName: 'Иванов', trainedOn: '2026-09-01', qualificationUntil: null, hasFile: true, priorCertificate: false, productId: 'prod', carrierId: null };

describe('обучение преподавателя', () => {
  it('закрывается при человеке, статусе обучен или ведёт, дате и сертификате', () => {
    expect(trainClosePlan(ready).enabled).toBe(true);
    expect(trainClosePlan({ ...ready, status: 'active', hasFile: false, priorCertificate: true }).enabled).toBe(true);
    expect(trainClosePlan({ ...ready, status: 'planned' }).enabled).toBe(false);
    expect(trainClosePlan({ ...ready, status: 'left' }).enabled).toBe(false);
    expect(trainClosePlan({ ...ready, hasFile: false }).enabled).toBe(false);
    expect(trainClosePlan({ ...ready, personId: null }).enabled).toBe(false);
  });
});
