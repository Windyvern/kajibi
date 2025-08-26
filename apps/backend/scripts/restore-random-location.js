'use strict';
try { require('@strapi/typescript-utils/register'); } catch {}

async function ensureStrapi() {
  if (global.strapi) return global.strapi;
  let create;
  try { ({ createStrapi: create } = require('@strapi/strapi')); } catch {}
  if (!create) {
    const mod = require('@strapi/strapi');
    create = mod.createStrapi || mod.default || mod;
  }
  const app = await create().load();
  global.strapi = app;
  return app;
}

async function getTag(name) {
  const found = await strapi.entityService.findMany('api::tag.tag', {
    filters: { name: { $eqi: name } },
    limit: 1,
  });
  return (Array.isArray(found) && found[0]) ? found[0] : null;
}

async function run() {
  const app = await ensureStrapi();
  try {
    const tag = await getTag('random-location');
    if (!tag) { console.log('[restore-random-location] tag not found, nothing to do'); return; }
    const tagId = Number(tag.id);

    const pageSize = 500;
    let offset = 0;
    let processed = 0;
    let updated = 0;
    for (;;) {
      const list = await strapi.entityService.findMany('api::article.article', {
        fields: ['id', 'latitude', 'longitude', 'title'],
        populate: { tags: true },
        filters: { tags: { id: { $eq: tagId } } },
        limit: pageSize,
        offset,
      });
      if (!list || list.length === 0) break;
      for (const art of list) {
        processed++;
        try {
          await strapi.entityService.update('api::article.article', art.id, {
            data: {
              latitude: null,
              longitude: null,
              tags: { disconnect: [tagId] },
            }
          });
          updated++;
        } catch {}
      }
      offset += list.length;
      if (list.length < pageSize) break;
    }
    console.log(`[restore-random-location] processed=${processed} updated=${updated}`);
  } catch (e) {
    console.error('[restore-random-location] error', e?.message || e);
    process.exitCode = 1;
  } finally {
    await strapi.destroy();
  }
}

run();
