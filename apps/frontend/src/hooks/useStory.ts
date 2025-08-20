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
    const list = Array.isArray(attrs.media?.data) ? attrs.media.data : (Array.isArray(attrs.media) ? attrs.media : []);
    const baseIndex = panels.length;
    const extra = (list || []).map((file: any, i: number) => {
      const url = getMediaUrl(file);
      return {
        id: `${article.id}-media-${baseIndex + i}`,
        type: isVideoFile(file, url) ? 'video' as const : 'image' as const,
        media: url,
        orderIndex: baseIndex + i,
      };
    }).filter(p => !!p.media);
    panels = [...panels, ...extra];
  }

  const coverUrl = getMediaUrl(attrs.cover);
  const coverMime = (getMime(attrs.cover) || '').toLowerCase();
  const thumbFromCover = coverUrl && !coverMime.includes('video') ? coverUrl : undefined;
  const imagePanel = panels.find(p => p.type === 'image' || p.type === 'video');

  return {
    id: article.id.toString(),
    title: attrs.title,
    author: attrs.author?.data?.attributes?.name || '',
    subtitle: undefined,
    handle: attrs.slug,
    publishedAt: attrs.publishedAt || attrs.createdAt,
    panels,
    thumbnail: thumbFromCover ?? imagePanel?.media,
    thumbnailPanelId: imagePanel?.id,
    tags: undefined,
    address: undefined,
    description: attrs.description,
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
        'populate=author,cover,media,blocks,blocks.file,blocks.files'
      );
      if (!response.data) return null;
      return mapArticleToStory(response.data);
    },
    enabled: !!storyId,
  });
};
