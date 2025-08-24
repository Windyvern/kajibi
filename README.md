Production deployment (Nginx entrypoint)
- Build and run all services with Nginx as the only public entrypoint:
  - `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build`
- Backend environment: copy and customize `apps/backend/.env.example` → `apps/backend/.env` with strong secrets:
  - `cp apps/backend/.env.example apps/backend/.env`
  - Replace `APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `TRANSFER_TOKEN_SALT`, `JWT_SECRET` with secure values.
  - Ensure database variables match the Compose `postgres` service (defaults work out-of-the-box).
- Public origin (CORS): set the public site URL for Strapi in `docker-compose.prod.yml` under `api.environment.FRONTEND_URL`, e.g. `https://your.domain`.
- Nginx routes in production:
  - `/` → frontend (static site served by `web`)
  - `/api/*` → internal read-only proxy (public GET/HEAD)
  - `/uploads/*` → Strapi media files
  - `/admin/*` + admin plugin APIs (`/content-manager/`, `/content-type-builder/`, `/i18n/`, `/upload/`, `/users-permissions/`, `/email/`) → Strapi backend
  - Only Nginx is exposed publicly; Strapi (`api`) and the internal proxy are private.

Notes and recommendations
- Admin protection: the admin is protected by Strapi login. HTTP Basic Auth is NOT required and is disabled for `/admin` and `/api/instagram-import` to avoid browser prompts. If you want an additional Basic Auth layer, you can re‑enable it in `apps/nginx/nginx.conf`.
- Large uploads: Nginx is configured with `client_max_body_size 2g` and long timeouts for admin/import routes. Strapi allows large multipart uploads; you can tune `UPLOAD_MAX_FILESIZE` in `apps/backend/.env` if needed.
- Disk space: Instagram ZIP import extracts to `/tmp` inside the `api` container. Ensure the host has enough free space for extraction (at least the size of the ZIP).
- Persist media in production: to keep uploaded files across container rebuilds, mount a volume for Strapi uploads (optional but recommended). Example change to `docker-compose.prod.yml`:
  - Under `services.api`:
    ```yaml
    volumes:
      - uploads:/opt/app/public/uploads
    ```
  - And add this at the bottom:
    ```yaml
    volumes:
      uploads:
    ```

Deploying to a remote server
- Prerequisites: Docker + Docker Compose v2 installed on the server; DNS A/AAAA record pointing your domain to the server.
- Copy the repo and your `apps/backend/.env` to the server.
- Set `FRONTEND_URL` to your public origin (e.g., `https://your.domain`).
- Start the stack:
  - `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build`
- TLS/HTTPS: the provided Nginx listens on port 80. For HTTPS, either:
  - Put Nginx behind a TLS terminator (Caddy, Traefik, cloud load balancer), or
  - Extend `apps/nginx/nginx.conf` and Compose to listen on 443 with your certificates.

Operations
- Reload Nginx without downtime:
  - `docker compose exec nginx nginx -t && docker compose exec nginx nginx -s reload`
- Tail logs during troubleshooting:
  - `docker compose logs -f nginx api`
- Rebuild a single service when configs change (e.g., Nginx):
  - `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build nginx`

Instagram import (admin)
- In Strapi admin, use “Instagram Import” to upload the ZIP. The page reports processing stats after upload.
- If processing seems stalled, check `docker compose logs -f api | rg ig-import` for details.
- Troubleshooting: see `docs/TROUBLESHOOTING.md` for common admin and importer issues (admin 404/502, large uploads, logs).
