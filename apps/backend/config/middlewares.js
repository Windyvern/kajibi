module.exports = ({ env }) => {
  const strictCsp = env.bool('STRICT_CSP', false);
  return [
    'strapi::logger',
    'strapi::errors',
    {
      name: 'strapi::security',
      config: {
        contentSecurityPolicy: {
          useDefaults: true,
          directives: {
            'script-src': [
              "'self'",
              ...(strictCsp ? [] : ["'unsafe-inline'", "'unsafe-eval'"]),
              'https://maps.googleapis.com',
            ],
            'style-src': ["'self'", ...(strictCsp ? [] : ["'unsafe-inline'"])],
            'img-src': ["'self'", 'data:', 'blob:', 'https:', 'http:'],
            'media-src': ["'self'", 'data:', 'blob:', 'https:', 'http:'],
            'connect-src': [
              "'self'",
              'https:',
              'http:',
              'ws:',
              'wss:',
              'localhost:1337',
              '127.0.0.1:1337',
            ],
            'frame-src': ["'self'"],
          },
        },
      },
    },
    {
      name: 'strapi::cors',
      config: { origin: env.array('FRONTEND_URL', ['http://localhost:3000']) },
    },
    'strapi::poweredBy',
    'strapi::query',
    {
      name: 'strapi::body',
      config: {
        jsonLimit: '10mb',
        formLimit: '10mb',
        textLimit: '10mb',
        formidable: { maxFileSize: env.int('UPLOAD_MAX_FILESIZE', 2 * 1024 * 1024 * 1024) },
      },
    },
    {
      name: 'strapi::session',
      config: {
        cookie: {
          secure: env.bool('SESSION_COOKIE_SECURE', false),
          sameSite: env('SESSION_COOKIE_SAMESITE', 'lax'),
        },
      },
    },
    'strapi::favicon',
    'strapi::public',
  ];
};
