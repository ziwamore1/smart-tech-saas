const BASE = process.env.NEXT_PUBLIC_DSIG_API_URL || 'http://localhost:4001';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('dsig_token');
}

export function setToken(token: string) {
  localStorage.setItem('dsig_token', token);
}

export function clearToken() {
  localStorage.removeItem('dsig_token');
}

export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as any),
  };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error(body?.message || `Request failed (${res.status})`), { status: res.status });
  return body as T;
}
