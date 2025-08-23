// Sanitize base URLs so that using '/' results in relative URLs instead of '//path'
const sanitizeBase = (v?: string): string => {
  const raw = (v || '').trim();
  if (!raw || raw === '/' || raw === './' || raw === '.') return '';
  return raw.replace(/\/+$/, '');
};

const RAW_STRAPI_URL = (import.meta as any).env?.VITE_STRAPI_URL;
export const STRAPI_URL = RAW_STRAPI_URL !== undefined ? sanitizeBase(RAW_STRAPI_URL) : 'http://localhost:1337';
// API base for JSON calls. Use proxy if provided, else fall back to STRAPI_URL.
const RAW_API_BASE = (import.meta as any).env?.VITE_API_BASE;
export const API_BASE = RAW_API_BASE !== undefined ? sanitizeBase(RAW_API_BASE) : sanitizeBase(STRAPI_URL);

export async function strapiFetch<T>(endpoint: string, params: string = ''): Promise<T> {
  const url = `${API_BASE}${endpoint}${params ? `?${params}` : ''}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Strapi request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}
