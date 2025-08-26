'use strict';
// Enable loading of TS config files (admin.ts, database.ts, etc.) when bootstrapping programmatically
try { require('@strapi/typescript-utils/register'); } catch {}

const slugify = (s) =>
  String(s || '')
    .replace(/^@/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_\-]+/g, '-')
    .replace(/^-+|-+$/g, '');

async function ensureStrapi() {
  if (global.strapi) return global.strapi;
  let create;
  try {
    ({ createStrapi: create } = require('@strapi/strapi'));
  } catch {}
  if (!create) {
    const mod = require('@strapi/strapi');
    create = mod.createStrapi || mod.default || mod;
  }
  const app = await create().load();
  global.strapi = app;
  return app;
}

async function run() {
  const app = await ensureStrapi();
  try {
    const pageSize = 500;
    let offset = 0;
    let processed = 0;
    let updated = 0;
    for (;;) {
      const list = await strapi.entityService.findMany('api::article.article', {
        fields: ['id', 'username', 'title'],
        populate: { author: true },
        limit: pageSize,
        offset,
      });
      if (!list || list.length === 0) break;
      for (const art of list) {
        processed++;
        try {
          if (art.author) continue;
          const uname = String(art.username || '').trim();
          if (!uname) continue;
          const displayName = uname;
          const slug = slugify(uname);
          // Find author by slug or name (case-insensitive)
          const found = await strapi.entityService.findMany('api::author.author', {
            filters: {
              $or: [
                { slug: { $eqi: slug } },
                { name: { $eqi: displayName } },
              ],
            },
            limit: 1,
          });
          const author = (Array.isArray(found) && found[0])
            ? found[0]
            : await strapi.entityService.create('api::author.author', { data: { name: displayName, slug } });
          await strapi.entityService.update('api::article.article', art.id, { data: { author: Number(author.id) } });
          updated++;
        } catch {}
      }
      offset += list.length;
      if (list.length < pageSize) break;
    }
    console.log(`[backfill-authors] processed=${processed} updated=${updated}`);
  } catch (e) {
    console.error('[backfill-authors] error', e?.message || e);
    process.exitCode = 1;
  } finally {
    await strapi.destroy();
  }
}

run();
