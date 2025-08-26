module.exports = ({ env }) => ({
  'google-maps': {
    enabled: true,
    config: {
      apiKey: env('GOOGLE_MAPS_API_KEY'),
      defaultCenter: { lat: 48.8566, lng: 2.3522 },
      defaultZoom: 12,
    },
  },
});
