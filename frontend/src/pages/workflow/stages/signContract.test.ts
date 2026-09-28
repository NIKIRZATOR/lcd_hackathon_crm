import { describe, expect, it } from 'vitest';

import { parseSignDraft, signClosePlan } from './signContract';

describe('подписание договора', () => {
  it('закрывается только когда статус «получен подписанный», есть номер, дата и файл', () => {
    const ready = { number: 'Д-1', status: 'received' as const, signedOn: '2026-09-01', hasFile: true, validUntil: null, signer: '', fileId: 'file' };
    expect(signClosePlan(ready).enabled).toBe(true);
    expect(signClosePlan({ ...ready, status: 'sent' }).enabled).toBe(false);
    expect(signClosePlan({ ...ready, status: 'returned' }).enabled).toBe(false);
    expect(signClosePlan({ ...ready, hasFile: false }).enabled).toBe(false);
    expect(signClosePlan({ ...ready, number: '  ' }).enabled).toBe(false);
    expect(signClosePlan({ ...ready, signedOn: null }).enabled).toBe(false);
  });

  it('читает номер из обычного текста, если это ещё не конверт', () => {
    expect(parseSignDraft('Д-14').number).toBe('Д-14');
    expect(parseSignDraft(JSON.stringify({ v: 1, number: 'Д-2', status: 'returned', signer: 'Иванов' })).status).toBe('returned');
  });
});
