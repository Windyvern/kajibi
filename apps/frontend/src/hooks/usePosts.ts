import { useQuery } from '@tanstack/react-query';
import { STRAPI_URL, strapiFetch } from '@/integrations/strapi/client';
import { Story, StoryPanelData } from '@/types/story';

function getMediaUrl(file: any): string | undefined {
  if (!file) return undefined;
  if (typeof file === 'string') {
    return `${STRAPI_URL}/uploads/${file}`;
  }
  const hls = file?.hlsPlaylist || file?.formats?.hls?.url;
  if (hls) return `${STRAPI_URL}${hls}`;
  const url = file?.url;
  if (url) return `${STRAPI_URL}${url}`;
  return undefined;
}

function isVideoFile(file: any, url?: string): boolean {
  const mime = file?.mime;
  if (typeof mime === 'string' && mime.toLowerCase().includes('video')) return true;
  if (file?.hlsPlaylist || file?.formats?.hls?.url) return true;
  const u = url || file?.url || '';
  return /\.(mp4|mov|webm)$/i.test(u);
}

export const usePosts = () => {
  return useQuery({
    queryKey: ['posts'],
    queryFn: async (): Promise<Story[]> => {
      // Fetch posts directly from the Posts content type
      const response = await strapiFetch<any>(
        '/api/posts',
        'populate%5Bmedia%5D=true' +
          '&populate%5Bauthor%5D%5Bpopulate%5D=avatar' +
          '&populate%5Bcategory%5D=true' +
          '&pagination%5BpageSize%5D=1000'
      );
      
      const posts = response.data || [];
      
      // Convert posts to Story format for compatibility with existing components
      return posts.map((post: any) => {
        // In the new Strapi format, data is flat (no nested attributes)
        
        // Create panels from media
        const panels: StoryPanelData[] = [];
        if (post.media && Array.isArray(post.media)) {
          post.media.forEach((mediaItem: any, index: number) => {
            const url = getMediaUrl(mediaItem);
            
            if (url) {
              panels.push({
                id: `${post.id}-media-${index}`,
                type: isVideoFile(mediaItem, url) ? 'video' : 'image',
                media: url,
                slug: `${post.id}-media-${index}`,
                orderIndex: index,
              });
            }
          });
        }
        
        // If no media panels, create a text panel from caption
        if (panels.length === 0 && post.caption) {
          panels.push({
            id: `${post.id}-caption`,
            type: 'text',
            content: post.caption,
            slug: `${post.id}-caption`,
            orderIndex: 0,
          });
        }

        // Extract geographic data
        const hasGeo = post.latitude && post.longitude;
        const geo = hasGeo ? {
          lat: parseFloat(post.latitude),
          lng: parseFloat(post.longitude),
        } : null;
        
        return {
          id: post.id,
          title: post.title || post.caption || 'Post sans titre',
          handle: post.slug || post.id,
          description: post.caption || '',
          panels: panels,
          thumbnail: panels.find(p => p.type === 'image')?.media || 
                    (post.media && post.media[0] ? getMediaUrl(post.media[0]) : undefined),
          author: post.author?.name || '',
          category: post.category?.name || '',
          publishedAt: post.taken_at || post.publishedAt || post.createdAt,
          lastVisit: post.taken_at || post.publishedAt || post.createdAt,
          postedDate: post.taken_at || post.publishedAt || post.createdAt,
          username: post.author?.name ? `@${post.author.name}` : '',
          rating: 0,
          address: post.address || '',
          isClosed: post.is_closed || false,
          geo: geo,
        } as Story;
      });
    },
  });
};
