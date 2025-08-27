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
            // Allow Google Maps admin plugin and assets
            "script-src": [
              "'self'",
              ...(strictCsp ? [] : ["'unsafe-inline'", "'unsafe-eval'"]),
              'https://maps.googleapis.com',
              'https://maps.gstatic.com',
            ],
            "style-src": [
              "'self'",
              ...(strictCsp ? [] : ["'unsafe-inline'"]),
              'https://fonts.googleapis.com',
            ],
            "font-src": [
              "'self'",
              'data:',
              'https://fonts.gstatic.com',
            ],
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
    {
      name: 'strapi::body',
      config: {
        jsonLimit: '10mb',
        formLimit: '10mb',
        textLimit: '10mb',
        formidable: {
          // Allow very large multipart uploads (e.g., 2GB Instagram archive)
          maxFileSize: env.int('UPLOAD_MAX_FILESIZE', 2 * 1024 * 1024 * 1024),
        },
      },
    },
    {
      name: 'strapi::session',
      config: {
        cookie: {
          // For local HTTP (no TLS), set to false to avoid browsers dropping the cookie
          secure: env.bool('SESSION_COOKIE_SECURE', false),
          // Lax avoids third-party issues while remaining permissive for same-site navigation
          sameSite: env('SESSION_COOKIE_SAMESITE', 'lax'),
        },
      },
    },
    'strapi::favicon',
    'strapi::public',
  ];
};
