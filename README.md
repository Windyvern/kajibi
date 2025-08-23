
Production deployment (reverse proxy)
- Use `docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build` to run with Nginx as the only public entrypoint.
- Generate an admin Basic Auth file and mount it at `apps/nginx/.htpasswd`:
  - `printf "admin:$(openssl passwd -apr1 YOUR_PASSWORD)\n" > apps/nginx/.htpasswd`
- The Nginx proxy routes:
  - `/` → frontend web container
  - `/api/*` → internal read-only proxy (GET/HEAD)
  - `/uploads/*` → Strapi media
  - `/admin/*` → Strapi admin protected by HTTP Basic Auth
  - Strapi and the internal proxy are not exposed publicly.
