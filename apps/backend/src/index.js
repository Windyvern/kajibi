module.exports = {
  async bootstrap({ strapi }) {
    if (process.env.SKIP_BOOTSTRAP === 'true') return;
    const uid = 'api::place.place';
    const hasPlace = Boolean(strapi.contentTypes && strapi.contentTypes[uid]);
    if (!hasPlace) return; // skip when content-type doesn't exist
    try {
      const count = await strapi.entityService.count(uid);
      if (count === 0) {
        await strapi.entityService.create(uid, {
          data: {
            title: 'Demo Location',
            description: 'Example description',
            gps: [48.8566, 2.3522],
          },
        });
      }
    } catch (e) {
      // best-effort bootstrap; ignore errors in scripts/one-off runs
    }
  },
};
