type TokenProvider = () => Promise<string | undefined>;

let tokenProvider: TokenProvider | undefined;

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
    throw new Error(`API request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
};
