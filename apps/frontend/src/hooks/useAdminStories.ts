import { useQuery } from '@tanstack/react-query';
import { strapiFetch, STRAPI_URL } from '@/integrations/strapi/client';
import { Story, StoryPanelData } from '@/types/story';

function getMediaUrl(file: any): string | undefined {
  if (!file) return undefined;
  if (typeof file === 'string') {
    return `${STRAPI_URL}/uploads/${file}`;
  }
  if (file.data?.attributes?.url) {
    return `${STRAPI_URL}${file.data.attributes.url}`;
  }
  if (file.url) {
    return `${STRAPI_URL}${file.url}`;
  }
  return undefined;
}

export const useAdminStories = () => {
  return useQuery({
    queryKey: ['admin-stories'],
    queryFn: async (): Promise<Story[]> => {
      const response = await strapiFetch<any>(
        '/api/articles',
        'populate=author,cover,blocks,blocks.file,blocks.files'
      );
      const articles = response.data;

      return articles.map((article: any) => {
        const attrs = article.attributes;
        const panels: StoryPanelData[] = [];

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

        const imagePanel = panels.find(p => p.type === 'image');

        return {
          id: article.id.toString(),
          title: attrs.title,
          author: attrs.author?.data?.attributes?.name || '',
          subtitle: undefined,
          handle: attrs.slug,
          publishedAt: attrs.publishedAt || attrs.createdAt,
          panels,
          thumbnail: attrs.cover?.data?.attributes?.url
            ? `${STRAPI_URL}${attrs.cover.data.attributes.url}`
            : imagePanel?.media,
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

