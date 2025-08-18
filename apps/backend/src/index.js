module.exports = {
  async bootstrap({ strapi }) {
    const count = await strapi.entityService.count('api::place.place');
    if (count === 0) {
      await strapi.entityService.create('api::place.place', {
        data: {
          title: 'Demo Location',
          description: 'Example description',
          gps: [48.8566, 2.3522],
          // ...
        },
      });
    }
  },
};