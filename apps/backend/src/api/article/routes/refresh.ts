export default {
  routes: [
    {
      method: 'POST',
      path: '/articles/refresh',
      handler: 'article.refreshAll',
      config: {
        // Make this route callable from the local proxy without extra auth setup
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/articles/refresh',
      handler: 'article.refreshAll',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
