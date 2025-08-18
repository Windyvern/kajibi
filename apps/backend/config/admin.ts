export default ({ env }) => ({
  auth: {
    secret: env('ADMIN_JWT_SECRET'),
  },
  apiToken: {
    salt: env('API_TOKEN_SALT'),
  },
  transfer: {
    token: {
      salt: env('TRANSFER_TOKEN_SALT'),
    },
  },
  // Extend Vite dev server FS allow list to include /opt/node_modules
  // This fixes dynamic import errors in Docker where dependencies are installed outside /opt/app
  vite: {
    server: {
      fs: {
        allow: ['/opt/app', '/opt/node_modules', '/opt/node_modules/vite/dist/client'],
      },
    },
  },
  flags: {
    nps: env.bool('FLAG_NPS', true),
    promoteEE: env.bool('FLAG_PROMOTE_EE', true),
  },
});
