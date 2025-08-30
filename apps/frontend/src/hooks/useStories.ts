import { useQuery } from '@tanstack/react-query';
import { strapiFetch, STRAPI_URL } from '@/integrations/strapi/client';
import { Story, StoryPanelData } from '@/types/story';

function getMediaUrl(file: any): string | undefined {
  if (!file) return undefined;
  if (typeof file === 'string') {
    return `${STRAPI_URL}/uploads/${file}`;
  }
  // Support shapes: { data: { attributes: { url } } } or { attributes: { url } } or { url }
  const entry = file?.data?.attributes ? file.data : file;
  const hls = entry?.attributes?.hlsPlaylist || entry?.hlsPlaylist || entry?.attributes?.formats?.hls?.url || entry?.formats?.hls?.url;
  if (hls) return `${STRAPI_URL}${hls}`;
  const url = entry?.attributes?.url || entry?.url;
  if (url) return `${STRAPI_URL}${url}`;
  return undefined;
}

function isVideoFile(file: any, url?: string): boolean {
  const mime = file?.data?.attributes?.mime || file?.mime;
  if (typeof mime === 'string' && mime.toLowerCase().includes('video')) return true;
  const entry = file?.data?.attributes ? file.data : file;
  if (entry?.hlsPlaylist || entry?.formats?.hls?.url) return true;
  const u = url || file?.data?.attributes?.url || file?.url || '';
  return /\.(mp4|mov|webm)$/i.test(u);
}

function getMime(file: any): string | undefined {
  const entry = file?.data?.attributes ? file.data : file;
  return entry?.attributes?.mime || entry?.mime;
}

function getAttr(file: any, key: string): string | undefined {
  const entry = file?.data?.attributes ? file.data : file;
  return entry?.attributes?.[key] || entry?.[key];
}

export const useStories = () => {
  return useQuery({
    queryKey: ['stories'],
    queryFn: async (): Promise<Story[]> => {
      const response = await strapiFetch<any>(
        '/api/articles',
        // Strapi v5: deep-populate dynamic zone and specific relations
        'populate%5Bblocks%5D%5Bpopulate%5D=*' +
          '&populate%5Bcover%5D=true' +
          '&populate%5Bauthor%5D%5Bpopulate%5D=avatar' +
          '&populate%5Bcategory%5D=true' +
          '&populate%5Btypes%5D=true' +
          // Include appended donor for redirect mapping when needed
          '&populate%5Bappend_article%5D=true' +
          // Prizes: include icon and colors
          '&populate%5Bprizes%5D%5Bpopulate%5D=icon' +
          // Populate media relation (Strapi returns all items for multi-media relations)
          '&populate%5Bmedia%5D=true' +
          // Populate avatar image
          '&populate%5Bavatar%5D=true' +
          // Populate lists and their cover for thumbnails
          '&populate%5Blists%5D%5Bpopulate%5D=cover' +
          // Populate posts and reels relations to identify content types
          '&populate%5Bposts%5D=true' +
          '&populate%5Breels%5D=true' +
          '&pagination%5BpageSize%5D=1000'
      );
      const articles = response.data;

      return articles.map((article: any) => {
        // Support Strapi v4 (attributes wrapper) and v5 (flat attributes)
        const attrs = article.attributes ?? article;
        let panels: StoryPanelData[] = [];

        (attrs.blocks || []).forEach((block: any, index: number) => {
          switch (block.__component) {
            case 'shared.rich-text':
              panels.push({
                id: `${article.id}-rich-${index}`,
                type: 'text',
                content: block.body,
                slug: `${article.id}-rich-${index}`,
                orderIndex: index,
              });
              break;
            case 'shared.quote':
              panels.push({
                id: `${article.id}-quote-${index}`,
                type: 'quote',
                title: block.title,
                content: block.body,
                slug: `${article.id}-quote-${index}`,
                orderIndex: index,
              });
              break;
            case 'shared.media':
              panels.push({
                id: `${article.id}-media-${index}`,
                type: 'image',
                media: getMediaUrl(block.file),
                altText: getAttr(block.file, 'alternativeText'),
                caption: getAttr(block.file, 'caption'),
                slug: `${article.id}-media-${index}`,
                orderIndex: index,
              });
              break;
            case 'shared.slider':
              (block.files || []).forEach((file: any, fileIndex: number) => {
                panels.push({
                  id: `${article.id}-slider-${index}-${fileIndex}`,
                  type: 'image',
                  media: getMediaUrl(file),
                  altText: getAttr(file, 'alternativeText'),
                  caption: getAttr(file, 'caption'),
                  slug: `${article.id}-slider-${index}-${fileIndex}`,
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
                    altText: getAttr(file, 'alternativeText'),
                    caption: getAttr(file, 'caption'),
                    slug: `${article.id}-media-${baseIndex + i}`,
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
        // Prefer the first visual panel (image or video) for fallbacks
        const imagePanel = panels.find(p => p.type === 'image' || p.type === 'video');

        // Map prizes (support v4 and v5 shapes)
        const prizesList: Array<{ id: string; name: string; slug?: string; iconUrl?: string; textColor?: string; bgColor?: string; priority?: number; useTextColor?: boolean }> = (() => {
          const src = attrs.prizes?.data ?? attrs.prizes ?? attrs.awards ?? [];
          const arr = Array.isArray(src) ? src : [];
          const mapped = arr.map((p: any) => {
            const entry = p?.attributes ? p : { attributes: p, id: p?.id };
            const at = entry?.attributes || {};
            return {
              id: String(entry?.id || at.id || at.slug || at.name || Math.random()),
              name: at.name || at.title || '',
              slug: at.slug || undefined,
              iconUrl: getMediaUrl(at.icon),
              textColor: at.text_color || at.textColor || undefined,
              bgColor: at.bg_color || at.bgColor || undefined,
              priority: typeof at.priority === 'number' ? at.priority : 100,
              useTextColor: Boolean(at.use_text_color ?? at.useTextColor ?? false),
            };
          }).filter((x: any) => x && x.name);
          // Sort by priority asc (lower = higher priority), then by name desc
          mapped.sort((a, b) => {
            const pa = typeof a.priority === 'number' ? a.priority : 100;
            const pb = typeof b.priority === 'number' ? b.priority : 100;
            if (pa !== pb) return pa - pb;
            const an = a.name || '';
            const bn = b.name || '';
            return bn.localeCompare(an, undefined, { numeric: true, sensitivity: 'base' });
          });
          return mapped;
        })();

        // Derive primary type label and all type names
        const typeLabel: string | undefined = (() => {
          const src = attrs.types?.data ?? attrs.types ?? [];
          const arr = Array.isArray(src) ? src : [];
          const first = arr[0];
          const at = first?.attributes || first || {};
          return at?.name || undefined;
        })();
        const typeNames: string[] = (() => {
          const src = attrs.types?.data ?? attrs.types ?? [];
          const arr = Array.isArray(src) ? src : [];
          return arr
            .map((t: any) => (t?.attributes?.name || t?.name))
            .filter((n: any) => typeof n === 'string' && n.trim().length > 0);
        })();

        // Normalize author relation across Strapi shapes
        const authorEntry = attrs.author?.data?.attributes || attrs.author?.attributes || attrs.author || {};
        const authorName: string = authorEntry?.name || attrs.author?.name || (attrs.username || '');
        const authorSlug: string | undefined = authorEntry?.slug || attrs.author?.slug || undefined;
        const authorAvatarUrl = getMediaUrl(authorEntry?.avatar) || getMediaUrl(attrs.avatar);

        // Alias info from appended donor, if present
        const appended = attrs.append_article?.data?.attributes || attrs.append_article || undefined;
        const appendedSlug = appended?.slug || undefined;
        const appendedTitle = appended?.title || undefined;
        const appendedUsername = appended?.username || undefined;

        return {
          id: article.id.toString(),
          title: attrs.title,
          author: authorName,
          authorSlug,
          subtitle: undefined,
          handle: attrs.slug,
          // Expose donor alias information for redirects and search
          appendedFromSlug: appendedSlug,
          appendedFromTitle: appendedTitle,
          appendedFromUsername: appendedUsername,
          publishedAt: attrs.publishedAt || attrs.createdAt,
          postedDate: attrs.posted_date || attrs.postedDate || undefined,
          firstVisit: attrs.first_visit || undefined,
          lastVisit: attrs.last_visit || undefined,
          panels,
          // Prefer image cover; otherwise fall back to first visual panel
          thumbnail: thumbFromCover ?? imagePanel?.media,
          thumbnailPanelId: imagePanel?.id,
          rating: attrs.rating != null ? Number(attrs.rating) : undefined,
          category: (attrs.category?.data?.attributes?.name || attrs.category?.name || undefined),
          type: typeLabel,
          types: typeNames.length ? typeNames : undefined,
          prizes: prizesList.length ? prizesList : undefined,
          username: attrs.username || undefined,
          avatarUrl: authorAvatarUrl,
          mentions: Array.isArray(attrs.mentions) ? attrs.mentions.filter((x: any) => typeof x === 'string') : undefined,
          lists: Array.isArray(attrs.lists)
            ? attrs.lists.map((l: any) => ({
                id: String(l.id || l.documentId || ''),
                name: l.name,
                slug: l.slug,
                thumbnail: getMediaUrl(l.cover)
              }))
            : Array.isArray(attrs.lists?.data)
              ? attrs.lists.data.map((e: any) => ({
                  id: String(e.id || e.documentId || ''),
                  name: e.attributes?.name || e.name,
                  slug: e.attributes?.slug || e.slug,
                  thumbnail: getMediaUrl(e.attributes?.cover || e.cover)
                }))
              : undefined,
          tags: undefined,
          address: attrs.address || undefined,
          description: attrs.description,
          geo:
            attrs.latitude && attrs.longitude
              ? { lat: Number(attrs.latitude), lng: Number(attrs.longitude) }
              : undefined,
          isClosed: Boolean(attrs.is_closed ?? attrs.isClosed ?? false),
        } as Story;
      });
    },
  });
};
