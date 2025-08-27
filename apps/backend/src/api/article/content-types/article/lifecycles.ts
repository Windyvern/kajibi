function syncLocationToFields(data: any) {
  if (!data) return;
  const raw = data.location;
  if (!raw) return;
  let loc: any = raw;
  if (typeof raw === 'string') {
    try { loc = JSON.parse(raw); } catch { return; }
  }
  if (!loc || typeof loc !== 'object') return;
  const addr = loc.address;
  const coords = loc.coordinates || loc.coords;
  if (coords && typeof coords.lat !== 'undefined') {
    const n = Number(coords.lat);
    if (!Number.isNaN(n)) data.latitude = n;
  }
  if (coords && typeof coords.lng !== 'undefined') {
    const n = Number(coords.lng);
    if (!Number.isNaN(n)) data.longitude = n;
  }
  if (typeof addr === 'string' && addr.trim()) {
    data.address = addr.trim();
  }
}

export default {
  beforeCreate(event: any) {
    try { syncLocationToFields(event.params?.data); } catch {}
  },
  beforeUpdate(event: any) {
    try { syncLocationToFields(event.params?.data); } catch {}
  },
  async afterUpdate(event: any) {
    const data = event.result;
    const payload = event.params?.data || {};
    const uid = (id: any) => (typeof id === 'string' || typeof id === 'number') ? id : id?.id;
    const toDate = (v: any) => v ? new Date(v) : null;
    const api = (strapi as any).entityService;

    // Use append_article one-to-one relation: Article A (keeper) has append_article pointing to Article B (donor)
    const keeperId = uid(data?.id);
    const donorRef = payload.append_article || data?.append_article;
    const donorId = uid(donorRef);
    if (!donorId || donorId === keeperId) return;

    // Load full keeper + donor
    const [keeper, donor] = await Promise.all([
      api.findOne('api::article.article', keeperId, { populate: { media: true, lists: true, prizes: true, tags: true, blocks: { populate: '*' } } }),
      api.findOne('api::article.article', donorId, { populate: { media: true, lists: true, prizes: true, tags: true, posts: true, reels: true, blocks: { populate: '*' } } }),
    ]);
    if (!donor) return;

    // Merge media chronologically + merge lists/prizes/tags/blocks
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

    // Update keeper with merged relations; keep append_article relation for redirect mapping
    await api.update('api::article.article', keeperId, {
      data: {
        media: mediaSet.map((m: any) => uid(m)),
        lists: Array.from(listSet.values()).map((l: any) => uid(l)),
        prizes: Array.from(prizeSet.values()).map((p: any) => uid(p)),
        tags: Array.from(tagSet.values()).map((t: any) => uid(t)),
        blocks,
      }
    });

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

    // Hide donor from public (unpublish) but keep entity for slug redirect mapping
    try {
      await api.update('api::article.article', donorId, { data: { publishedAt: null } });
    } catch {}
  },
};
