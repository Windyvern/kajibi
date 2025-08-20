import { useQuery } from '@tanstack/react-query';
import { STRAPI_URL, strapiFetch } from '@/integrations/strapi/client';

function getMediaUrl(file: any): string | undefined {
  if (!file) return undefined;
  const entry = file?.data?.attributes ? file.data : file;
  const url = entry?.attributes?.url || entry?.url;
  if (url) return `${STRAPI_URL}${url}`;
  return undefined;
}

export interface ListDetailData {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  category?: string;
  author?: string;
  cover?: string;
  media: Array<{ url: string; type: 'image' | 'video' }>; // typed media
  articles: Array<{ id: string; title: string; slug?: string; media: string[] }>;
}

export const useList = (slug: string) => {
  return useQuery({
    queryKey: ['list', slug],
    queryFn: async (): Promise<ListDetailData | null> => {
      const res = await strapiFetch<any>(
        '/api/lists',
        `filters%5Bslug%5D%5B$eq%5D=${encodeURIComponent(slug)}&populate%5Bcover%5D=true&populate%5Bmedia%5D=true&populate%5Barticles%5D%5Bpopulate%5D=media`
      );
      const item = (res.data || [])[0];
      if (!item) return null;
      const attrs = item.attributes ?? item;
      const articlesArr = Array.isArray(attrs.articles)
        ? attrs.articles
        : Array.isArray(attrs.articles?.data)
          ? attrs.articles.data.map((d: any) => d.attributes ? { ...d.attributes, id: d.id } : d)
          : [];
      return {
        id: String(item.id || attrs.id || attrs.documentId || ''),
        name: attrs.name,
        slug: attrs.slug,
        description: attrs.description || undefined,
        category: attrs.category?.name || attrs.category?.data?.attributes?.name,
        author: attrs.author?.name || attrs.author?.data?.attributes?.name,
        cover: getMediaUrl(attrs.cover),
        media: (Array.isArray(attrs.media?.data) ? attrs.media.data : (Array.isArray(attrs.media) ? attrs.media : []))
          .map((f: any) => {
            const url = getMediaUrl(f);
            const mime = f?.data?.attributes?.mime || f?.mime || '';
            const type: 'image' | 'video' = String(mime).toLowerCase().includes('video') ? 'video' : 'image';
            return url ? { url, type } : null;
          })
          .filter(Boolean) as Array<{ url: string; type: 'image' | 'video' }>,
        articles: (articlesArr || []).map((a: any) => ({
          id: String(a.id || a.documentId || ''),
          title: a.title,
          slug: a.slug,
          media: (Array.isArray(a.media?.data) ? a.media.data : (Array.isArray(a.media) ? a.media : [])).map(getMediaUrl).filter(Boolean) as string[],
        })),
      };
    },
    enabled: !!slug,
  });
};
