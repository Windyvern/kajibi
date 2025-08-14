export const STRAPI_URL = import.meta.env.VITE_STRAPI_URL || 'http://localhost:1337';

export async function strapiFetch<T>(endpoint: string, params: string = ''): Promise<T> {
  const url = `${STRAPI_URL}${endpoint}${params ? `?${params}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Strapi request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}
