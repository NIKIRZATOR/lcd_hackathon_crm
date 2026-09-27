import { describe, expect, it } from 'vitest';

import { transferClosePlan } from './transferAccess';

const ready = { status: 'transferred' as const, recipientId: 'p', access: 'https://school', transferredOn: '2026-09-01', hasFile: true, hasLicense: true, licenseId: 'lic', fileId: 'file' };

describe('передача и доступ', () => {
  it('закрывается только когда доступ передан и лицензия захода есть', () => {
    expect(transferClosePlan(ready).enabled).toBe(true);
    expect(transferClosePlan({ ...ready, status: 'revoked' }).enabled).toBe(false);
    expect(transferClosePlan({ ...ready, status: 'requested' }).enabled).toBe(false);
    expect(transferClosePlan({ ...ready, hasLicense: false }).enabled).toBe(false);
    expect(transferClosePlan({ ...ready, access: '  ' }).enabled).toBe(false);
    expect(transferClosePlan({ ...ready, hasFile: false }).enabled).toBe(false);
  });
});
