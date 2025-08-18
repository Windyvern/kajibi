Strapi API Token Proxy

Small Express-based proxy that forwards requests to Strapi using a server-side API token.

Environment variables:

- STRAPI_URL: Base URL for Strapi (default: `http://api:1337`).
- STRAPI_API_TOKEN: Required Strapi API token used in `Authorization: Bearer ...`.

Notes:

- Only paths under `/api/*` are proxied; admin/internal routes are blocked.
- Supports GET/POST/PUT/PATCH/DELETE with raw body passthrough.
- CORS is open (`*`); restrict as needed for production.

Docker

The service is wired in the root `docker-compose.yml` as `proxy` and exposed on `:4000`.
Provide a token at runtime, e.g.:

```bash
STRAPI_API_TOKEN=... docker compose up proxy
```

