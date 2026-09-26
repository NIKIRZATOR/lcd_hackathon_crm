type TokenProvider = () => Promise<string | undefined>;

let tokenProvider: TokenProvider | undefined;

export type ApiErrorPayload = { code: string; message: string; details?: unknown; requestId?: string };

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly payload?: ApiErrorPayload) {
    super(payload?.message ?? `API request failed with status ${status}`);
  }
}

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export const setAuthTokenProvider = (provider: TokenProvider) => {
  tokenProvider = provider;
};

export const apiRequest = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const headers = new Headers(init.headers);
  const token = await tokenProvider?.();

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    let payload: ApiErrorPayload | undefined;
    try { payload = await response.json() as ApiErrorPayload; } catch { payload = undefined; }
    throw new ApiError(response.status, payload);
  }

  return response.json() as Promise<T>;
};

export const apiDownload = async (path: string): Promise<Blob> => {
  const token = await tokenProvider?.();
  const response = await fetch(`${API_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  if (!response.ok) throw new ApiError(response.status);
  return response.blob();
};
