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

export type UploadProgressHandler = (percent: number) => void;

function uploadWithProgressRequest<T>(
  method: 'POST' | 'PUT',
  url: string,
  form: FormData,
  onProgress?: UploadProgressHandler
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const resolvedUrl = resolveUrl(url);

    xhr.open(method, resolvedUrl);
    const token = getToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const ct = xhr.getResponseHeader('content-type') || '';
        if (ct.includes('application/json')) {
          try {
            resolve(JSON.parse(xhr.responseText) as T);
          } catch {
            reject(new Error('Invalid JSON response'));
          }
        } else {
          resolve(xhr.responseText as unknown as T);
        }
        return;
      }
      reject(new Error(xhr.responseText || xhr.statusText));
    };

    xhr.onerror = () => reject(new Error('Network error'));
    xhr.onabort = () => reject(new Error('Upload aborted'));

    xhr.send(form);
  });
}

export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T = any>(url: string, body: any) => request<T>('POST', url, body),
  put: <T = any>(url: string, body: any) => request<T>('PUT', url, body),
  delete: <T = any>(url: string) => request<T>('DELETE', url),
  upload: <T = any>(url: string, form: FormData) => request<T>('POST', url, form),
  uploadWithProgress: <T = any>(url: string, form: FormData, onProgress?: UploadProgressHandler) =>
    uploadWithProgressRequest<T>('POST', url, form, onProgress),
  uploadPut: <T = any>(url: string, form: FormData) => request<T>('PUT', url, form),
  uploadPutWithProgress: <T = any>(url: string, form: FormData, onProgress?: UploadProgressHandler) =>
    uploadWithProgressRequest<T>('PUT', url, form, onProgress),
};
