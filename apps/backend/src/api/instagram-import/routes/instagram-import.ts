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
  ],
};
