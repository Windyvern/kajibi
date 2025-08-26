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
    const mergeUsername: string | undefined = payload.merge_article_with || data?.merge_article_with;
    if (!mergeUsername) return;
    const norm = (u: string) => u.trim().replace(/^@+/, '').toLowerCase();
    const targetHandle = norm(mergeUsername);
    const uid = (id: any) => (typeof id === 'string' || typeof id === 'number') ? id : id?.id;
    const toDate = (v: any) => v ? new Date(v) : null;
    const api = (strapi as any).entityService;
    // Find candidate article(s) by username
    const candidates = await api.findMany('api::article.article', {
      filters: { username: { $containsi: targetHandle } },
      populate: { media: true, lists: true, prizes: true, tags: true, blocks: { populate: '*' }, posts: true, reels: true }
    });
    if (!Array.isArray(candidates) || candidates.length === 0) return;
    // Include current article in comparison if username matches
    const curr = data;
    const all = [curr, ...candidates.filter((c: any) => uid(c.id) !== uid(curr.id))];
    // Choose keeper by most recent last_visit (fallback to publishedAt/updatedAt)
    const score = (a: any) => toDate(a.last_visit) || toDate(a.publishedAt) || toDate(a.updatedAt) || new Date(0);
    let keeper = all[0];
    for (const a of all) if (score(a) > score(keeper)) keeper = a;
    const donors = all.filter((a: any) => uid(a.id) !== uid(keeper.id));
    if (donors.length === 0) return;
    // Merge donors into keeper
    const keeperId = uid(keeper.id);
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
    donors.forEach(collect);
    // Sort blocks by date if any timestamps exist, else keep order
    // For media panels: sort by taken_at/createdAt in ascending (chronological)
    const byTime = (a: any, b: any) => {
      const ta = toDate(a.taken_at || a.createdAt || a.updatedAt) || new Date(0);
      const tb = toDate(b.taken_at || b.createdAt || b.updatedAt) || new Date(0);
      return ta.getTime() - tb.getTime();
    };
    mediaSet.sort(byTime);
    // Re-attach relations on keeper
    await api.update('api::article.article', keeperId, {
      data: {
        media: mediaSet.map((m: any) => uid(m)),
        lists: Array.from(listSet.values()).map((l: any) => uid(l)),
        prizes: Array.from(prizeSet.values()).map((p: any) => uid(p)),
        tags: Array.from(tagSet.values()).map((t: any) => uid(t)),
        blocks,
        merge_article_with: null,
      }
    });
    // Re-link posts/reels from donors to keeper, then delete donors
    for (const d of donors) {
      const did = uid(d.id);
      try {
        const donorFull = await api.findOne('api::article.article', did, { populate: { posts: true, reels: true } });
        const postIds = (donorFull.posts || []).map((p: any) => uid(p));
        const reelIds = (donorFull.reels || []).map((r: any) => uid(r));
        for (const pid of postIds) {
          const post = await api.findOne('api::post.post', pid, { populate: { articles: true } });
          const arts = new Map<string, any>();
          (post.articles || []).forEach((a: any) => arts.set(String(uid(a)), a));
          arts.delete(String(did));
          arts.set(String(keeperId), { id: keeperId });
          await api.update('api::post.post', pid, { data: { articles: Array.from(arts.keys()) } });
        }
        for (const rid of reelIds) {
          const reel = await api.findOne('api::reel.reel', rid, { populate: { articles: true } });
          const arts = new Map<string, any>();
          (reel.articles || []).forEach((a: any) => arts.set(String(uid(a)), a));
          arts.delete(String(did));
          arts.set(String(keeperId), { id: keeperId });
          await api.update('api::reel.reel', rid, { data: { articles: Array.from(arts.keys()) } });
        }
        // Remove donor article
        await api.delete('api::article.article', did);
      } catch (e) {
        // Continue merging others even if one fails
      }
    }
  },
};
