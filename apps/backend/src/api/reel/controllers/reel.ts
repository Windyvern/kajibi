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
  const p = query.populate;

  // If caller requested broad populate ("*" or missing), enforce safe defaults
  if (!p || p === '*' || p === true || p === 'deep') {
    query.populate = { ...safeDefault } as any;
    return query;
  }

  // If articles is present, clamp it to safe fields only (no back-populate of posts/reels)
  try {
    if (typeof p === 'object') {
      query.populate = { ...p };
      query.populate.media = true;
      if ('articles' in p) {
        query.populate.articles = { ...safeArticles } as any;
      }
    } else {
      // Unknown format: fall back to safe defaults
      query.populate = { ...safeDefault } as any;
    }
  } catch {
    query.populate = { ...safeDefault } as any;
  }
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
