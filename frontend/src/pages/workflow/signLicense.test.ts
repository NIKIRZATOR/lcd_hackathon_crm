import { describe, expect, it } from 'vitest';

import { signLicensePlan } from './signLicense';

const ready = { number: 'Л-1', status: 'received' as const, signedOn: '2026-09-01', validUntil: '2027-09-01', hasFile: true, volume: '', fileId: 'file' };

describe('подписание лицензии', () => {
  it('закрывается только при статусе «получена подписанная», номере, дате, сроке и файле', () => {
    expect(signLicensePlan(ready).enabled).toBe(true);
    expect(signLicensePlan({ ...ready, status: 'sent' }).enabled).toBe(false);
    expect(signLicensePlan({ ...ready, status: 'returned' }).enabled).toBe(false);
    expect(signLicensePlan({ ...ready, status: 'requested' }).enabled).toBe(false);
    expect(signLicensePlan({ ...ready, validUntil: null }).enabled).toBe(false);
    expect(signLicensePlan({ ...ready, hasFile: false }).enabled).toBe(false);
  });
});
