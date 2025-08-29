import { useQuery } from '@tanstack/react-query';
import { STRAPI_URL, strapiFetch } from '@/integrations/strapi/client';
import { Story, StoryPanelData } from '@/types/story';

function getMediaUrl(file: any): string | undefined {
  if (!file) return undefined;
  if (typeof file === 'string') {
    return `${STRAPI_URL}/uploads/${file}`;
  }
  const url = file?.url;
  if (url) return `${STRAPI_URL}${url}`;
  return undefined;
}

function isVideoFile(file: any, url?: string): boolean {
  const mime = file?.mime;
  if (typeof mime === 'string' && mime.toLowerCase().includes('video')) return true;
  const u = url || file?.url || '';
  return /\.(mp4|mov|webm)$/i.test(u);
}

export const useReels = () => {
  return useQuery({
    queryKey: ['reels'],
    queryFn: async (): Promise<Story[]> => {
      // Fetch reels directly from the Reels content type
      const response = await strapiFetch<any>(
        '/api/reels',
        'populate%5Bmedia%5D=true' +
          '&populate%5Bauthor%5D%5Bpopulate%5D=avatar' +
          '&populate%5Bcategory%5D=true' +
          '&populate%5Bcover%5D=true' +
          '&pagination%5BpageSize%5D=1000'
      );
      
      const reels = response.data || [];
      
      // Convert reels to Story format for compatibility with existing components
      return reels.map((reel: any) => {
        // In the new Strapi format, data is flat (no nested attributes)
        
        // Create panels from media
        const panels: StoryPanelData[] = [];
        if (reel.media && Array.isArray(reel.media)) {
          reel.media.forEach((mediaItem: any, index: number) => {
            const url = getMediaUrl(mediaItem);
            
            if (url) {
              panels.push({
                id: `${reel.id}-media-${index}`,
                type: isVideoFile(mediaItem, url) ? 'video' : 'image',
                media: url,
                slug: `${reel.id}-media-${index}`,
                orderIndex: index,
              });
            }
          });
        }
        
        // If no media panels, create a text panel from caption
        if (panels.length === 0 && reel.caption) {
          panels.push({
            id: `${reel.id}-caption`,
            type: 'text',
            content: reel.caption,
            slug: `${reel.id}-caption`,
            orderIndex: 0,
          });
        }

        // Extract geographic data
        const hasGeo = reel.latitude && reel.longitude;
        const geo = hasGeo ? {
          lat: parseFloat(reel.latitude),
          lng: parseFloat(reel.longitude),
        } : null;

        return {
          id: reel.id,
          title: reel.title || reel.caption || 'Reel sans titre',
          handle: reel.slug || reel.id,
          description: reel.caption || '',
          panels: panels,
          thumbnail: panels.find(p => p.type === 'image' || p.type === 'video')?.media || getMediaUrl(reel.cover),
          author: reel.author?.name || '',
          category: reel.category?.name || '',
          publishedAt: reel.taken_at || reel.publishedAt || reel.createdAt,
          lastVisit: reel.taken_at || reel.publishedAt || reel.createdAt,
          postedDate: reel.taken_at || reel.publishedAt || reel.createdAt,
          username: reel.author?.name ? `@${reel.author.name}` : '',
          rating: 0,
          address: reel.address || '',
          isClosed: reel.is_closed || false,
          geo: geo,
        } as Story;
      });
    },
  });
};
