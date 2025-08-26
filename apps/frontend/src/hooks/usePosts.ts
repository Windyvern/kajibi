import { useQuery } from '@tanstack/react-query';
import { STRAPI_URL, strapiFetch } from '@/integrations/strapi/client';
import { Story, StoryPanelData } from '@/types/story';

function getMediaUrl(file: any): string | undefined {
  if (!file) return undefined;
  if (typeof file === 'string') {
    return `${STRAPI_URL}/uploads/${file}`;
  }
  const entry = file?.data?.attributes ? file.data : file;
  const url = entry?.attributes?.url || entry?.url;
  if (url) return `${STRAPI_URL}${url}`;
  return undefined;
}

function isVideoFile(file: any, url?: string): boolean {
  const mime = file?.data?.attributes?.mime || file?.mime;
  if (typeof mime === 'string' && mime.toLowerCase().includes('video')) return true;
  const u = url || file?.data?.attributes?.url || file?.url || '';
  return /\.(mp4|mov|webm)$/i.test(u);
}

export const usePosts = () => {
  return useQuery({
    queryKey: ['posts-index'],
    queryFn: async (): Promise<Story[]> => {
      const res = await strapiFetch<any>(
        '/api/posts',
        'populate%5Bmedia%5D=true&populate%5Barticles%5D%5Bpopulate%5D=*&pagination%5BpageSize%5D=1000'
      );
      const data = res.data || [];
  return data.map((e: any) => {
        const attrs = e.attributes ?? e;
        const mediaArr = Array.isArray(attrs.media?.data)
          ? attrs.media.data
          : Array.isArray(attrs.media)
            ? attrs.media
            : [];
        const panels: StoryPanelData[] = (mediaArr || []).map((file: any, i: number) => {
          const url = getMediaUrl(file);
          const type = isVideoFile(file, url) ? 'video' : 'image';
          return {
            id: `${e.id}-m-${i}`,
            type,
            media: url,
            orderIndex: i,
          } as StoryPanelData;
        }).filter(p => p.media);

        // Try inherit geo from first linked article
        let lat: number | undefined;
        let lng: number | undefined;
        const articlesArr = (attrs.articles?.data || attrs.articles || []) as any[];
        const firstArticle = articlesArr[0];
        const a = firstArticle?.attributes || firstArticle;
        if (a?.latitude && a?.longitude) {
          lat = Number(a.latitude);
          lng = Number(a.longitude);
        }
        const linked = (articlesArr || []).map((it: any) => {
          const at = it?.attributes || it || {};
          return {
            id: String(it?.id || at.id || at.slug || Math.random()),
            slug: at.slug,
            title: at.title,
            username: at.username,
            thumbnail: getMediaUrl(at.cover) || (Array.isArray(at.media?.data) ? getMediaUrl(at.media.data[0]) : undefined)
          };
        });
        return {
          id: `post-${e.id}`,
          title: attrs.caption || 'Post',
          author: attrs.author?.data?.attributes?.name || attrs.author?.name || '',
          authorSlug: attrs.author?.data?.attributes?.slug || attrs.author?.slug,
          handle: `post-${e.id}`,
          publishedAt: attrs.createdAt,
          postedDate: attrs.taken_at,
          panels,
          thumbnail: panels[0]?.media,
          geo: lat != null && lng != null ? { lat, lng } : undefined,
          isClosed: false,
          username: attrs.username || undefined,
          mentions: Array.isArray(attrs.mentions) ? attrs.mentions : undefined,
          linkedArticles: linked.length ? linked : undefined,
        } as Story;
      });
    }
  });
};
