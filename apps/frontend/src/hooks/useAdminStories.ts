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

export const useAdminStories = () => {
  return useQuery({
    queryKey: ['admin-stories'],
    queryFn: async (): Promise<Story[]> => {
      const response = await strapiFetch<any>(
        '/api/articles',
        // Populate cover and media for admin list too, so thumbnails and galleries reflect DB
        'populate=author,cover,media,blocks,blocks.file,blocks.files'
      );
      const articles = response.data;

      return articles.map((article: any) => {
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

        // Append media relation files so admin sees full gallery, even without blocks
        if ((attrs as any).media) {
          const list = Array.isArray((attrs as any).media?.data)
            ? (attrs as any).media.data
            : Array.isArray((attrs as any).media)
              ? (attrs as any).media
              : [];
          const baseIndex = panels.length;
          const extra = (list || [])
            .map((file: any, i: number) => {
              const url = getMediaUrl(file);
              return url
                ? {
                    id: `${article.id}-media-${baseIndex + i}`,
                    type: 'image' as const,
                    media: url,
                    orderIndex: baseIndex + i,
                  }
                : undefined;
            })
            .filter(Boolean) as StoryPanelData[];
          panels = [...panels, ...extra];
        }

        const imagePanel = panels.find(p => p.type === 'image');

        return {
          id: article.id.toString(),
          title: attrs.title,
          author: attrs.author?.data?.attributes?.name || '',
          subtitle: undefined,
          handle: attrs.slug,
          publishedAt: attrs.publishedAt || attrs.createdAt,
          panels,
          // Prefer cover for thumbnails; fallback to first image
          thumbnail: (attrs.cover?.data?.attributes?.url
            ? `${STRAPI_URL}${attrs.cover.data.attributes.url}`
            : undefined) ?? imagePanel?.media,
          thumbnailPanelId: imagePanel?.id,
          tags: undefined,
          address: undefined,
          description: attrs.description,
          geo:
            attrs.latitude && attrs.longitude
              ? { lat: Number(attrs.latitude), lng: Number(attrs.longitude) }
              : undefined,
        } as Story;
      });
    },
  });
};

