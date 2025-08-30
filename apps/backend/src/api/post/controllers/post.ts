import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::post.post', ({ strapi }) => ({
  async find(ctx) {
    ctx.query = { ...ctx.query, populate: { media: true } };
    return await super.find(ctx);
  },
  async findOne(ctx) {
    ctx.query = { ...ctx.query, populate: { media: true } };
    return await super.findOne(ctx);
  },
}));
