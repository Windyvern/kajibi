/**
 *  article controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::article.article', ({ strapi }) => ({
  async append(ctx) {
    const keeperId = Number(ctx.params.id);
    if (!keeperId) { ctx.badRequest('Missing article id'); return; }
    const api = strapi.entityService as any;
    const uid = (v: any) => (typeof v === 'string' || typeof v === 'number') ? v : v?.id;
    const toDate = (v: any) => v ? new Date(v) : null;
    try {
      const keeper = await api.findOne('api::article.article', keeperId, { populate: { append_article: true, media: true, lists: true, prizes: true, tags: true, blocks: { populate: '*' } } });
      const donorId = uid(keeper?.append_article);
      if (!donorId) { ctx.badRequest('No append_article set on this article'); return; }
      const donor = await api.findOne('api::article.article', donorId, { populate: { media: true, lists: true, prizes: true, tags: true, posts: true, reels: true, blocks: { populate: '*' } } });
      if (!donor) { ctx.notFound('Donor not found'); return; }

      const mediaSet: any[] = [];
      const listSet = new Map<string, any>();
      const prizeSet = new Map<string, any>();
      const tagSet = new Map<string, any>();
      const blocks: any[] = [];
      const collect = (art: any) => {
        (art.media || []).forEach((m: any) => mediaSet.push(m));
        (art.lists || []).forEach((l: any) => listSet.set(String(uid(l)), l));
        (art.prizes || []).forEach((p: any) => prizeSet.set(String(uid(p)), p));
        (art.tags || []).forEach((t: any) => tagSet.set(String(uid(t)), t));
        (art.blocks || []).forEach((b: any) => blocks.push(b));
      };
      collect(keeper);
      collect(donor);

      const byTime = (a: any, b: any) => {
        const ta = toDate(a.taken_at || a.createdAt || a.updatedAt) || new Date(0);
        const tb = toDate(b.taken_at || b.createdAt || b.updatedAt) || new Date(0);
        return ta.getTime() - tb.getTime();
      };
      mediaSet.sort(byTime);

      await api.update('api::article.article', keeperId, {
        data: {
          media: mediaSet.map((m: any) => uid(m)),
          lists: Array.from(listSet.values()).map((l: any) => uid(l)),
          prizes: Array.from(prizeSet.values()).map((p: any) => uid(p)),
          tags: Array.from(tagSet.values()).map((t: any) => uid(t)),
          blocks,
        }
      });

      // Try to republish keeper (Strapi v5 documents API) so changes are visible immediately
      try {
        const documents = (strapi as any).documents?.('api::article.article');
        if (documents) {
          const keeperDoc = await documents.findOne({ documentId: (keeper as any).documentId || keeperId });
          if (keeperDoc) {
            try { await documents.unpublish({ documentId: keeperDoc.documentId }); } catch {}
            await documents.publish({ documentId: keeperDoc.documentId });
          }
        }
      } catch {}

      // Re-link posts/reels from donor to keeper
      try {
        const postIds = (donor.posts || []).map((p: any) => uid(p));
        const reelIds = (donor.reels || []).map((r: any) => uid(r));
        for (const pid of postIds) {
          const post = await api.findOne('api::post.post', pid, { populate: { articles: true } });
          const arts = new Map<string, any>();
          (post.articles || []).forEach((a: any) => arts.set(String(uid(a)), a));
          arts.delete(String(donorId));
          arts.set(String(keeperId), { id: keeperId });
          await api.update('api::post.post', pid, { data: { articles: Array.from(arts.keys()) } });
        }
        for (const rid of reelIds) {
          const reel = await api.findOne('api::reel.reel', rid, { populate: { articles: true } });
          const arts = new Map<string, any>();
          (reel.articles || []).forEach((a: any) => arts.set(String(uid(a)), a));
          arts.delete(String(donorId));
          arts.set(String(keeperId), { id: keeperId });
          await api.update('api::reel.reel', rid, { data: { articles: Array.from(arts.keys()) } });
        }
      } catch {}

      // Hide donor from public (unpublish)
      try { await api.update('api::article.article', donorId, { data: { publishedAt: null } }); } catch {}

      ctx.body = { ok: true, mergedFrom: donorId, into: keeperId };
    } catch (e: any) {
      ctx.status = 500;
      ctx.body = { error: 'append failed', detail: String(e?.message || e) };
    }
  },
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
