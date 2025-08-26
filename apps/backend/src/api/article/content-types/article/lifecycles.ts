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
};
