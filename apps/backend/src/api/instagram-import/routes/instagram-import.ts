export default {
  routes: [
    {
      method: 'POST',
      path: '/instagram-import',
      handler: 'api::instagram-import.instagram-import.importZip',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/instagram-import/status',
      handler: 'api::instagram-import.instagram-import.status',
      config: {
        auth: false,
      },
    },
  ],
};
