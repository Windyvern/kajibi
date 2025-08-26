import express from 'express';

const app = express();
const STRAPI_URL = process.env.STRAPI_URL || 'http://api:1337';
const TOKEN = process.env.STRAPI_API_TOKEN;

// Parse raw body so we can forward non-GET requests
app.use(express.raw({ type: '*/*', limit: '10mb' }));

app.use((req, res, next) => {
  // basic CORS (tighten origin if needed)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Local health endpoint (does not hit upstream)
app.get('/_health', (_req, res) => {
  res.status(200).json({ ok: true });
});

// Optional API token: allow public GET/HEAD without a token so Strapi Public role applies.
// Require a token only for write operations to avoid exposing unsafe methods.
app.use((req, res, next) => {
  const method = req.method.toUpperCase();
  const isRead = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
  if (!TOKEN && !isRead) {
    return res.status(401).json({ error: 'API token required for non-read operations' });
  }
  next();
});

// Allowlist paths to proxy (REST and public uploads). Prevent admin/internal access.
const ALLOW_PREFIXES = ['/api', '/uploads', '/_health'];
app.use((req, res, next) => {
  if (!ALLOW_PREFIXES.some((p) => req.path === p || req.path.startsWith(p + '/'))) {
    return res.status(404).json({ error: 'Not found' });
  }
  next();
});

// Generic proxy handler
app.all('*', async (req, res) => {
  try {
    const url = `${STRAPI_URL}${req.originalUrl}`;
    console.log(`[proxy] ${req.method} ${req.originalUrl} -> ${url}`);

    // Build headers for upstream request
    const headers = new Headers();
    // Preserve content-type for body passthrough
    const contentType = req.headers['content-type'];
    if (contentType) headers.set('content-type', contentType);
    const method = req.method.toUpperCase();
    const isRead = method === 'GET' || method === 'HEAD';
    // Attach Authorization for all methods when token is provided
    if (TOKEN) headers.set('authorization', `Bearer ${TOKEN}`);

    const hasBody = !isRead && req.body && req.body.length > 0;

    const upstream = await fetch(url, {
      method,
      headers,
      body: hasBody ? req.body : undefined,
    });

    // Forward status, content-type and body
    const ct = upstream.headers.get('content-type') || 'application/json';
    res.status(upstream.status).type(ct);
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  } catch (err) {
    console.error('[proxy error]', req.method, req.originalUrl, '-', err?.stack || err?.message || err);
    res.status(502).json({ error: 'Bad gateway', detail: String(err?.message || err) });
  }
});

app.listen(4000, () => console.log('Proxy listening on :4000'));
