export default ({ env }) => ({
  // Google Maps plugin configuration (package name: @amicaldo/strapi-google-maps)
  // Strapi plugin key is 'google-maps' per plugin metadata
  'google-maps': {
    enabled: true,
    config: {
      // Provide your Google Maps JS API key via env
      apiKey: env('GOOGLE_MAPS_API_KEY'),
      // Default map center/zoom: Paris
      defaultCenter: { lat: 48.8566, lng: 2.3522 },
      defaultZoom: 12,
    },
  },
});
