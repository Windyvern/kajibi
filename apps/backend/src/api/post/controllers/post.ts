import { factories } from '@strapi/strapi';

// Limit default population to avoid circular populate between Post ↔ Article
// Only include the media of the post and selected fields on related articles.
function sanitizePopulate(q: any) {
  const safeArticles = {
    fields: ['slug', 'title', 'username', 'latitude', 'longitude'],
    populate: { cover: true, media: true },
  } as const;
  const safeDefault = { media: true, articles: safeArticles } as const;

  const query = q || {};
  // Force a safe shape regardless of incoming params
  (query as any).fields = ['id','caption','taken_at','createdAt','updatedAt','username','latitude','longitude','address','slug'];
  (query as any).populate = { ...safeDefault } as any;
  // Cap pagination (avoid exceeding Strapi's default max pageSize)
  try {
    const inPag = (query as any).pagination || {};
    const pageSizeRaw = Number(inPag.pageSize || 100);
    const pageSize = Math.max(1, Math.min(100, isNaN(pageSizeRaw) ? 100 : pageSizeRaw));
    (query as any).pagination = { ...inPag, pageSize };
  } catch {}
  // Prevent accidental deep populate through unknown keys
  delete (query as any).filters;
  return query;
}

export default factories.createCoreController('api::post.post', ({ strapi }) => ({
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
