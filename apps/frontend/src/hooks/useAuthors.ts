import { useQuery } from '@tanstack/react-query';
import { STRAPI_URL, strapiFetch } from '@/integrations/strapi/client';

export interface AuthorItem {
  id: string;
  name: string;
  slug?: string;
  avatarUrl?: string;
}

function getMediaUrl(file: any): string | undefined {
  if (!file) return undefined;
  const entry = file?.data?.attributes ? file.data : file;
  const url = entry?.attributes?.url || entry?.url;
  if (url) return `${STRAPI_URL}${url}`;
  return undefined;
}

export const useAuthors = () => {
  return useQuery({
    queryKey: ['authors'],
    queryFn: async (): Promise<AuthorItem[]> => {
      try {
        const res = await strapiFetch<any>(
          '/api/authors',
          'populate%5Bavatar%5D=true&pagination%5BpageSize%5D=1000'
        );
        const data = res.data || [];
        return data.map((e: any) => {
          const attrs = e.attributes ?? e;
          return {
            id: String(e.id || attrs.id || attrs.documentId || ''),
            name: attrs.name,
            slug: attrs.slug,
            avatarUrl: getMediaUrl(attrs.avatar),
          } as AuthorItem;
        });
      } catch (e) {
        return [];
      }
    },
  });
};
