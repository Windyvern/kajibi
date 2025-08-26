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

function randBetween(min, max) {
  return min + Math.random() * (max - min);
}

function pickRandomLocation() {
  const r = Math.random();
  if (r < 0.6) {
    // Paris bounds
    return { lat: randBetween(48.80, 48.90), lng: randBetween(2.25, 2.42), label: 'Paris' };
  } else if (r < 0.9) {
    // Tokyo bounds
    return { lat: randBetween(35.60, 35.75), lng: randBetween(139.65, 139.85), label: 'Tokyo' };
  } else {
    // 10% across other options
    const idx = Math.floor(Math.random() * 5);
    switch (idx) {
      case 0: // London
        return { lat: randBetween(51.45, 51.55), lng: randBetween(-0.25, 0.10), label: 'London' };
      case 1: // Bangkok
        return { lat: randBetween(13.65, 13.85), lng: randBetween(100.45, 100.65), label: 'Bangkok' };
      case 2: // Seoul
        return { lat: randBetween(37.47, 37.60), lng: randBetween(126.90, 127.10), label: 'Seoul' };
      case 3: // Italy (broad)
        return { lat: randBetween(36.60, 46.60), lng: randBetween(6.60, 18.50), label: 'Italy' };
      default: // Rome area fallback
        return { lat: randBetween(41.80, 41.95), lng: randBetween(12.40, 12.60), label: 'Italy' };
    }
  }
}

async function ensureTag(name) {
  const found = await strapi.entityService.findMany('api::tag.tag', {
    filters: { name: { $eqi: name } },
    limit: 1,
  });
  if (Array.isArray(found) && found[0]) return found[0];
  return await strapi.entityService.create('api::tag.tag', { data: { name } });
}

async function run() {
  const app = await ensureStrapi();
  try {
    const tag = await ensureTag('random-location');
    const pageSize = 500;
    let offset = 0;
    let processed = 0;
    let updated = 0;
    for (;;) {
      const list = await strapi.entityService.findMany('api::article.article', {
        fields: ['id', 'latitude', 'longitude', 'title'],
        populate: { tags: true },
        limit: pageSize,
        offset,
      });
      if (!list || list.length === 0) break;
      for (const art of list) {
        processed++;
        const hasGeo = (art.latitude != null && art.longitude != null);
        if (hasGeo) continue;
        const loc = pickRandomLocation();
        const data = {
          latitude: Number(loc.lat.toFixed(6)),
          longitude: Number(loc.lng.toFixed(6)),
          tags: { connect: [Number(tag.id)] },
        };
        try {
          await strapi.entityService.update('api::article.article', art.id, { data });
          updated++;
        } catch (e) {
          // Ignore and continue
        }
      }
      offset += list.length;
      if (list.length < pageSize) break;
    }
    console.log(`[add-random-location] processed=${processed} updated=${updated}`);
  } catch (e) {
    console.error('[add-random-location] error', e?.message || e);
    process.exitCode = 1;
  } finally {
    await strapi.destroy();
  }
}

run();
