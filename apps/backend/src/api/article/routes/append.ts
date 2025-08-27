export default {
  routes: [
    {
      method: 'POST',
      path: '/articles/:id/append',
      handler: 'article.append',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};

