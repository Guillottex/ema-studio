/** Cliente HTTP de la API REST (JWT en header Authorization). */
const TOKEN_KEY = 'ema-token';

export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: any) {
    super(message);
  }
}

export const tokenStore = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t: string) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* */ } },
};

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

async function request<T>(method: string, url: string, body?: any, opts: { raw?: boolean; keepalive?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res: Response;
  try {
    res = await fetch('/api' + url, { method, headers, body: payload, keepalive: opts.keepalive });
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor');
  }
  if (res.status === 401 && !url.startsWith('/auth/login')) onUnauthorized?.();
  if (opts.raw) {
    if (!res.ok) throw new ApiError(res.status, await errorMessage(res));
    return res as any;
  }
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    let msg = (data && data.error) || `Error ${res.status}`;
    if (data?.details && Array.isArray(data.details) && data.details[0]?.message) msg += `: ${data.details.map((d: any) => (d.path ? d.path + ' ' : '') + d.message).join('; ')}`;
    throw new ApiError(res.status, msg, data);
  }
  return data as T;
}

async function errorMessage(res: Response) {
  try { const j = await res.json(); return j.error || `Error ${res.status}`; } catch { return `Error ${res.status}`; }
}

export const api = {
  get: <T = any>(url: string) => request<T>('GET', url),
  post: <T = any>(url: string, body?: any) => request<T>('POST', url, body ?? {}),
  put: <T = any>(url: string, body?: any, opts?: { keepalive?: boolean }) => request<T>('PUT', url, body, opts),
  patch: <T = any>(url: string, body?: any) => request<T>('PATCH', url, body),
  del: <T = any>(url: string) => request<T>('DELETE', url),
  upload: <T = any>(url: string, form: FormData) => request<T>('POST', url, form),
  /** Descarga un archivo autenticado y dispara el "Guardar como" del navegador */
  async download(url: string, fallbackName = 'archivo') {
    const res = await request<Response>('GET', url, undefined, { raw: true });
    const cd = res.headers.get('content-disposition') || '';
    const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
    const name = m ? decodeURIComponent(m[1]) : fallbackName;
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  },
};

/** URL pública de un recurso "asset:archivo" para usar en el editor */
export function assetUrl(src?: string | null): string {
  if (!src) return '';
  if (src.startsWith('asset:')) return '/uploads/' + src.slice(6);
  return src;
}
