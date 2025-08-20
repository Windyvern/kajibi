export default ({ env }) => ({
  level: env('STRAPI_LOG_LEVEL', 'debug'),
  exposeInContext: true,
  requests: true,
});

