import { useQuery } from '@tanstack/react-query';
import { strapiFetch, STRAPI_URL } from '@/integrations/strapi/client';

export interface ListItem {
  id: string;
  name: string;
  slug?: string;
  thumbnail?: string;
  articleCount?: number;
  description?: string;
  category?: string;
  latitude?: number;
  longitude?: number;
  location_label?: string;
}

function getMediaUrl(file: any): string | undefined {
  if (!file) return undefined;
  const entry = file?.data?.attributes ? file.data : file;
  const url = entry?.attributes?.url || entry?.url;
  if (url) return `${STRAPI_URL}${url}`;
  return undefined;
}

export const useLists = () => {
  return useQuery({
    queryKey: ['lists'],
    queryFn: async (): Promise<ListItem[]> => {
      try {
        const res = await strapiFetch<any>(
          '/api/lists',
          'populate%5Bcover%5D=true&populate%5Bcategory%5D=true&pagination%5BpageSize%5D=1000'
        );
        const data = res.data || [];
        return data.map((e: any) => {
          const attrs = e.attributes ?? e;
          return {
            id: String(e.id || attrs.id || attrs.documentId || ''),
            name: attrs.name,
            slug: attrs.slug,
            thumbnail: getMediaUrl(attrs.cover),
            description: attrs.description,
            category: attrs.category?.data?.attributes?.name || attrs.category?.name,
            latitude: attrs.latitude,
            longitude: attrs.longitude,
            location_label: attrs.location_label,
            articleCount: Array.isArray(attrs.articles)
              ? attrs.articles.length
              : Array.isArray(attrs.articles?.data)
                ? attrs.articles.data.length
                : undefined,
          } as ListItem;
        });
      } catch (e) {
        // Gracefully handle if lists API isn't available yet
        return [];
      }
    },
  });
};
