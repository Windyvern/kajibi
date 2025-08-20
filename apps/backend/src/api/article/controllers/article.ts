/**
 *  article controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::article.article', ({ strapi }) => ({
  async refreshAll(ctx) {
    try {
      // Fetch a large batch of articles with media and cover populated
      const articles: any[] = await strapi.entityService.findMany('api::article.article', {
        populate: { media: true, cover: true },
        limit: 1000,
      });

      let updated = 0;
      let published = 0;
      let failed: Array<{ id: number; error: string }> = [];

      // Prefer Strapi v5 documents API if available for publish
      const hasDocumentsApi = typeof (strapi as any).documents === 'function';
      const documentsApi = hasDocumentsApi ? (strapi as any).documents('api::article.article') : null;

      for (const art of articles) {
        try {
          // Attempt to republish document (v5) to simulate the Publish button
          if (documentsApi && art.documentId) {
            try {
              await documentsApi.publish({ documentId: art.documentId });
              published++;
              continue;
            } catch (e: any) {
              // Try unpublish then publish if direct publish failed
              try {
                await documentsApi.unpublish({ documentId: art.documentId });
                await documentsApi.publish({ documentId: art.documentId });
                published++;
                continue;
              } catch (e2: any) {
                // fall through to relation re-assignment
              }
            }
          }

          // Fallback: re-assign media and cover relations to force refresh
          const mediaList = Array.isArray(art.media?.data)
            ? art.media.data
            : Array.isArray(art.media)
              ? art.media
              : [];
          const mediaIds = mediaList
            .map((m: any) => (m?.id ?? m?.documentId ?? null))
            .filter(Boolean);
          const coverId = art.cover?.id ?? art.cover?.data?.id ?? null;

          await strapi.entityService.update('api::article.article', art.id, {
            data: {
              media: mediaIds,
              cover: coverId,
            },
          });
          updated++;
        } catch (err: any) {
          failed.push({ id: art.id, error: String(err?.message || err) });
        }
      }

      ctx.body = { count: articles.length, republished: published, reassigned: updated, failed };
    } catch (err: any) {
      ctx.status = 500;
      ctx.body = { error: 'refreshAll failed', detail: String(err?.message || err) };
    }
  },
}));
