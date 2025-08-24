Troubleshooting (Admin + Importer)

Admin 404/502 on prod (Nginx)
- Symptom: Visiting `http://localhost/admin` returns 404/502; Strapi logs show `ENOENT ... @strapi/admin/build/index.html`.
- Cause: Admin bundle not built or watch-mode enabled in prod.
- Fix:
  1) Rebuild API for prod: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build api nginx`
  2) If still failing, build inside container then restart:
     - `docker compose -f docker-compose.yml -f docker-compose.prod.yml exec api npm run build`
     - `docker compose -f docker-compose.yml -f docker-compose.prod.yml restart api`
  3) Verify build exists: `docker compose -f docker-compose.yml -f docker-compose.prod.yml exec api sh -lc 'ls -lah /opt/app/build | head -20'`
  4) Ensure `STRAPI_ADMIN_WATCH=false` in `docker-compose.prod.yml` for `api`.

Dev vs Prod URLs
- Dev (no Nginx): `http://localhost:1337/admin`
- Prod (Nginx): `http://localhost/admin`

Admin “Remember me” spins
- Cause: Secure cookies on HTTP localhost.
- Fix: In `apps/backend/config/middlewares.ts` we set session cookie to non-secure by default. For HTTPS prod, set `SESSION_COOKIE_SECURE=true` in `apps/backend/.env` and use `https://`.

Importer 413 Request Entity Too Large
- Fix Nginx route `/api/instagram-import`: `client_max_body_size 0`, long timeouts.
- Fix Strapi upload limit: set `UPLOAD_MAX_FILESIZE=3221225472` (3 GB) in compose prod for `api`.

Importer 500 errors
- Tail logs: `docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f api | grep -iE "\[ig-import\]|unzip|json not|media not|upload error"`
- Check response body in admin Network tab. Backend now returns structured error with `error.detail`.
- Verify `/tmp` space inside API container and that `unzip` is available: `which unzip && unzip -v | head -2`.
- "No space left on device" during unzip:
  - We extract to a configurable temp dir (`IG_IMPORT_TMPDIR`, default `/tmp`). In prod compose, it's set to `/ig-tmp` and backed by a named volume `ig_tmp`.
  - Ensure the volume has enough free space for all ZIPs plus extracted contents.
  - Recreate API after changes: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build api`.

Switching stacks cleanly
- Stop everything: `docker compose down`
- Start prod: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build api nginx`
- Start dev: `docker compose up -d api`

Nginx 503 on /admin
- Cause: rate limiting or wrong upstream.
- Fix: We disabled admin rate limit and route admin/plugin APIs directly to `api:1337`.
