import { useQuery } from '@tanstack/react-query';
import { STRAPI_URL, strapiFetch } from '@/integrations/strapi/client';

export interface MediaItem {
  id: string;
  caption?: string;
  takenAt?: string;
  thumbUrl?: string;
}

function getMediaUrl(file: any): string | undefined {
  if (!file) return undefined;
  const entry = file?.data?.attributes ? file.data : file;
  const url = entry?.attributes?.url || entry?.url;
  if (url) return `${STRAPI_URL}${url}`;
  return undefined;
}

const mapItems = (data: any[]): MediaItem[] => {
  return (data || []).map((e: any) => {
    const attrs = e.attributes ?? e;
    const mediaArr = Array.isArray(attrs.media?.data)
      ? attrs.media.data
      : Array.isArray(attrs.media)
        ? attrs.media
        : [];
    const first = mediaArr[0]?.attributes || mediaArr[0];
    return {
      id: String(e.id || attrs.id || attrs.documentId || ''),
      caption: attrs.caption,
      takenAt: attrs.taken_at,
      thumbUrl: getMediaUrl(first),
    } as MediaItem;
  });
};

export const useAuthorPosts = (slugOrName?: string) => {
  return useQuery({
    queryKey: ['author-posts', slugOrName],
    enabled: !!slugOrName,
    queryFn: async (): Promise<MediaItem[]> => {
      const filter = `filters%5Bauthor%5D%5Bslug%5D%5B%24eqi%5D=${encodeURIComponent(slugOrName || '')}`;
      const alt = `filters%5Bauthor%5D%5Bname%5D%5B%24eqi%5D=${encodeURIComponent(slugOrName || '')}`;
      const res = await strapiFetch<any>(
        '/api/posts',
        `${filter}&populate%5Bmedia%5D=true&pagination%5BpageSize%5D=1000`
      ).catch(() => strapiFetch<any>(
        '/api/posts',
        `${alt}&populate%5Bmedia%5D=true&pagination%5BpageSize%5D=1000`
      ));
      return mapItems(res.data || []);
    }
  });
};

export const useAuthorReels = (slugOrName?: string) => {
  return useQuery({
    queryKey: ['author-reels', slugOrName],
    enabled: !!slugOrName,
    queryFn: async (): Promise<MediaItem[]> => {
      const filter = `filters%5Bauthor%5D%5Bslug%5D%5B%24eqi%5D=${encodeURIComponent(slugOrName || '')}`;
      const alt = `filters%5Bauthor%5D%5Bname%5D%5B%24eqi%5D=${encodeURIComponent(slugOrName || '')}`;
      const res = await strapiFetch<any>(
        '/api/reels',
        `${filter}&populate%5Bmedia%5D=true&pagination%5BpageSize%5D=1000`
      ).catch(() => strapiFetch<any>(
        '/api/reels',
        `${alt}&populate%5Bmedia%5D=true&pagination%5BpageSize%5D=1000`
      ));
      return mapItems(res.data || []);
    }
  });
};

