import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiDownload, apiRequest, setAuthTokenProvider } from './client';

const payload = {
  code: 'CONFLICT',
  message: 'Conflicting state',
  details: { field: 'status' },
  request_id: 'request-123',
};

const failedResponse = () =>
  ({
    ok: false,
    status: 409,
    json: vi.fn().mockResolvedValue(payload),
  }) as unknown as Response;

describe('API error contract', () => {
  beforeEach(() => {
    setAuthTokenProvider(async () => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('preserves the error envelope for JSON requests', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(failedResponse()));

    const request = apiRequest('/api/test');

    await expect(request).rejects.toMatchObject({
      status: 409,
      message: 'Conflicting state',
      payload,
    });
  });

  it('preserves the error envelope for downloads', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(failedResponse()));

    const request = apiDownload('/api/test/download');

    await expect(request).rejects.toMatchObject({
      status: 409,
      message: 'Conflicting state',
      payload,
    });
  });
});
