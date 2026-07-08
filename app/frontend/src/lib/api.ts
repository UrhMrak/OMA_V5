type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

export const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/+$/, '') || 'http://localhost:4000';

const TOKEN_KEY = 'oma_token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore storage failures (e.g. private mode).
  }
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function resolveUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return API_BASE + url;
  return url;
}

async function request<T>(method: Method, url: string, body?: any, headers?: Record<string, string>): Promise<T> {
  const requestHeaders: Record<string, string> = { ...authHeaders(), ...(headers || {}) };
  if (!(body instanceof FormData)) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  const resolvedUrl = resolveUrl(url);
  // #region agent log
  fetch('http://127.0.0.1:7623/ingest/303c8905-ce82-429e-a986-cc58ecdbb6ee', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '752d8c' },
    body: JSON.stringify({
      sessionId: '752d8c',
      runId: 'pre-fix',
      hypothesisId: 'B',
      location: 'api.ts:request:start',
      message: 'API request start',
      data: { method, url, resolvedUrl, apiBase: API_BASE },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  try {
    const res = await fetch(resolvedUrl, {
      method,
      headers: requestHeaders,
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
    // #region agent log
    fetch('http://127.0.0.1:7623/ingest/303c8905-ce82-429e-a986-cc58ecdbb6ee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '752d8c' },
      body: JSON.stringify({
        sessionId: '752d8c',
        runId: 'pre-fix',
        hypothesisId: 'E',
        location: 'api.ts:request:response',
        message: 'API response received',
        data: {
          resolvedUrl,
          status: res.status,
          ok: res.ok,
          corsHeader: res.headers.get('access-control-allow-origin'),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || res.statusText);
    }
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return (await res.json()) as T;
    return (await res.text()) as unknown as T;
  } catch (err: any) {
    // #region agent log
    fetch('http://127.0.0.1:7623/ingest/303c8905-ce82-429e-a986-cc58ecdbb6ee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '752d8c' },
      body: JSON.stringify({
        sessionId: '752d8c',
        runId: 'pre-fix',
        hypothesisId: 'B',
        location: 'api.ts:request:error',
        message: 'API request failed',
        data: {
          resolvedUrl,
          errorName: err?.name || 'Error',
          errorMessage: err?.message || String(err),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    throw err;
  }
}

export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T = any>(url: string, body: any) => request<T>('POST', url, body),
  put: <T = any>(url: string, body: any) => request<T>('PUT', url, body),
  delete: <T = any>(url: string) => request<T>('DELETE', url),
  upload: <T = any>(url: string, form: FormData) => request<T>('POST', url, form),
  uploadPut: <T = any>(url: string, form: FormData) => request<T>('PUT', url, form),
};
