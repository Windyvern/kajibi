export const STRAPI_URL = import.meta.env.VITE_STRAPI_URL || 'http://localhost:1337';
// API base for JSON calls. Use proxy if provided, else fall back to STRAPI_URL.
export const API_BASE = import.meta.env.VITE_API_BASE || STRAPI_URL;

export async function strapiFetch<T>(endpoint: string, params: string = ''): Promise<T> {
  const url = `${API_BASE}${endpoint}${params ? `?${params}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Strapi request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}
