export default ({ env }) => {
  // Allow inline/eval scripts to support Strapi admin (Vite) during local development
  // If you need strict CSP in production, set STRICT_CSP=true in the environment
  const strictCsp = env.bool('STRICT_CSP', false);

  return [
    'strapi::logger',
    'strapi::errors',
    // Relax CSP in non-production to unblock admin dynamic imports/inline scripts used by Vite
    {
      name: 'strapi::security',
      config: {
        contentSecurityPolicy: {
          useDefaults: true,
          directives: {
            "script-src": ["'self'", ...(strictCsp ? [] : ["'unsafe-inline'", "'unsafe-eval'"])],
            "style-src": ["'self'", ...(strictCsp ? [] : ["'unsafe-inline'"])],
            "img-src": ["'self'", 'data:', 'blob:', 'https:', 'http:'],
            "media-src": ["'self'", 'data:', 'blob:', 'https:', 'http:'],
            "connect-src": [
              "'self'",
              'https:',
              'http:',
              'ws:',
              'wss:',
              'localhost:1337',
              '127.0.0.1:1337',
            ],
            "frame-src": ["'self'"],
          },
        },
      },
    },
    {
      name: 'strapi::cors',
      config: {
        origin: env.array('FRONTEND_URL', ['http://localhost:3000']),
      },
    },
    'strapi::poweredBy',
    'strapi::query',
    'strapi::body',
    'strapi::session',
    'strapi::favicon',
    'strapi::public',
  ];
};
