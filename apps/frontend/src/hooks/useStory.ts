import { useQuery } from '@tanstack/react-query';
import { strapiFetch, STRAPI_URL } from '@/integrations/strapi/client';
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

function getMime(file: any): string | undefined {
  const entry = file?.data?.attributes ? file.data : file;
  return entry?.attributes?.mime || entry?.mime;
}

function mapArticleToStory(article: any): Story {
  const attrs = article.attributes;
  let panels: StoryPanelData[] = [];

  (attrs.blocks || []).forEach((block: any, index: number) => {
    switch (block.__component) {
      case 'shared.rich-text':
        panels.push({
          id: `${article.id}-rich-${index}`,
          type: 'text',
          content: block.body,
          orderIndex: index,
        });
        break;
      case 'shared.quote':
        panels.push({
          id: `${article.id}-quote-${index}`,
          type: 'quote',
          title: block.title,
          content: block.body,
          orderIndex: index,
        });
        break;
      case 'shared.media':
        panels.push({
          id: `${article.id}-media-${index}`,
          type: 'image',
          media: getMediaUrl(block.file),
          orderIndex: index,
        });
        break;
      case 'shared.slider':
        (block.files || []).forEach((file: any, fileIndex: number) => {
          panels.push({
            id: `${article.id}-slider-${index}-${fileIndex}`,
            type: 'image',
            media: getMediaUrl(file),
            orderIndex: index + fileIndex / 100,
          });
        });
        break;
    }
  });

  // Also append media files to panels so the full gallery displays, even when blocks exist
  if (attrs.media) {
    const list = Array.isArray(attrs.media?.data)
      ? attrs.media.data
      : Array.isArray(attrs.media)
        ? attrs.media
        : [];
    const baseIndex = panels.length;
    const extra = (list || [])
      .map((file: any, i: number) => {
        const url = getMediaUrl(file);
        const type = isVideoFile(file, url) ? ('video' as const) : ('image' as const);
        return url
          ? {
              id: `${article.id}-media-${baseIndex + i}`,
              type,
              media: url,
              orderIndex: baseIndex + i,
            }
          : undefined;
      })
      .filter(Boolean) as StoryPanelData[];
    panels = [...panels, ...extra];
  }

  const coverUrl = getMediaUrl(attrs.cover);
  const coverMime = (getMime(attrs.cover) || '').toLowerCase();
  const thumbFromCover = coverUrl && !coverMime.includes('video') ? coverUrl : undefined;
  const imagePanel = panels.find(p => p.type === 'image' || p.type === 'video');

  return {
    id: article.id.toString(),
    title: attrs.title,
    author: attrs.author?.data?.attributes?.name || (attrs.username || ''),
    subtitle: undefined,
    handle: attrs.slug,
    publishedAt: attrs.publishedAt || attrs.createdAt,
    firstVisit: attrs.first_visit || undefined,
    lastVisit: attrs.last_visit || undefined,
    panels,
    // Prefer image cover; otherwise fall back to first visual panel
    thumbnail: thumbFromCover ?? imagePanel?.media,
    thumbnailPanelId: imagePanel?.id,
    rating: attrs.rating != null ? Number(attrs.rating) : undefined,
    username: attrs.username || undefined,
    tags: undefined,
    address: attrs.address || undefined,
    description: attrs.description,
    lists: Array.isArray(attrs.lists)
      ? attrs.lists.map((l: any) => ({ id: String(l.id || l.documentId || ''), name: l.name, slug: l.slug, thumbnail: getMediaUrl(l.cover) }))
      : Array.isArray(attrs.lists?.data)
        ? attrs.lists.data.map((e: any) => ({ id: String(e.id || e.documentId || ''), name: e.attributes?.name || e.name, slug: e.attributes?.slug || e.slug, thumbnail: getMediaUrl(e.attributes?.cover || e.cover) }))
        : undefined,
    geo:
      attrs.latitude && attrs.longitude
        ? { lat: Number(attrs.latitude), lng: Number(attrs.longitude) }
        : undefined,
  } as Story;
}

export const useStory = (storyId: string) => {
  return useQuery({
    queryKey: ['story', storyId],
    queryFn: async (): Promise<Story | null> => {
      const response = await strapiFetch<any>(
        `/api/articles/${storyId}`,
        // Populate author, cover, media, lists (with cover), and blocks
        'populate%5Bauthor%5D=true&populate%5Bcover%5D=true&populate%5Bmedia%5D=true&populate%5Blists%5D%5Bpopulate%5D=cover&populate%5Bblocks%5D%5Bpopulate%5D=*'
      );
      if (!response.data) return null;
      return mapArticleToStory(response.data);
    },
    enabled: !!storyId,
  });
};
