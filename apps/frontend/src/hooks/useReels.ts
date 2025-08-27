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

export const useReels = () => {
  return useQuery({
    queryKey: ['reels-index'],
    queryFn: async (): Promise<Story[]> => {
      const res = await strapiFetch<any>(
        '/api/reels',
        [
          'populate%5Bmedia%5D=true',
          'populate%5Barticles%5D%5Bfields%5D%5B0%5D=slug',
          'populate%5Barticles%5D%5Bfields%5D%5B1%5D=title',
          'populate%5Barticles%5D%5Bfields%5D%5B2%5D=username',
          'populate%5Barticles%5D%5Bpopulate%5D%5Bcover%5D=true',
          'populate%5Barticles%5D%5Bpopulate%5D%5Bmedia%5D=true',
          'pagination%5BpageSize%5D=1000',
        ].join('&')
      );
      const data = res.data || [];
      return data.map((e: any) => {
        const attrs = e.attributes ?? e;
        const mediaArr = Array.isArray(attrs.media?.data)
          ? attrs.media.data
          : Array.isArray(attrs.media)
            ? attrs.media
            : [];
        const first = mediaArr[0];
        const url = getMediaUrl(first);
        const panels: StoryPanelData[] = url ? [{ id: `${e.id}-v-0`, type: 'video', media: url, orderIndex: 0 }] : [];

        // Geo inherit from first linked article if available
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
          id: `reel-${e.id}`,
          title: attrs.caption || 'Reel',
          author: attrs.author?.data?.attributes?.name || attrs.author?.name || '',
          authorSlug: attrs.author?.data?.attributes?.slug || attrs.author?.slug,
          handle: `reel-${e.id}`,
          publishedAt: attrs.createdAt,
          postedDate: attrs.taken_at,
          panels,
          thumbnail: url,
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
