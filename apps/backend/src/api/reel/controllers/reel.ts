import { factories } from '@strapi/strapi';

// Limit default population to avoid circular populate between Reel ↔ Article
// Only include the media of the reel and selected fields on related articles.
function sanitizePopulate(q: any) {
  const safeArticles = {
    fields: ['slug', 'title', 'username', 'latitude', 'longitude'],
    populate: { cover: true, media: true },
  } as const;
  const safeDefault = { media: true, articles: safeArticles } as const;

  const query = q || {};
  // Force a safe shape regardless of incoming params
  (query as any).fields = ['id','caption','taken_at','createdAt','updatedAt','username','latitude','longitude','slug'];
  (query as any).populate = { ...safeDefault } as any;
  try {
    const inPag = (query as any).pagination || {};
    const pageSizeRaw = Number(inPag.pageSize || 100);
    const pageSize = Math.max(1, Math.min(100, isNaN(pageSizeRaw) ? 100 : pageSizeRaw));
    (query as any).pagination = { ...inPag, pageSize };
  } catch {}
  delete (query as any).filters;
  return query;
}

export default factories.createCoreController('api::reel.reel', ({ strapi }) => ({
  async find(ctx) {
    ctx.query = sanitizePopulate(ctx.query);
    // @ts-ignore super provided by Strapi factory
    return await super.find(ctx);
  },

  async findOne(ctx) {
    ctx.query = sanitizePopulate(ctx.query);
    // @ts-ignore super provided by Strapi factory
    return await super.findOne(ctx);
  },
}));
