import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import mime from 'mime-types';

// Keep originals to preserve extensions and avoid .bin classification
const convertImagesToWebp = false;

const execFileAsync = promisify(execFile);
const TMP_ROOT = process.env.IG_IMPORT_TMPDIR || '/tmp';

// Simple in-memory job registry for progress reporting
type JobStage = 'queued' | 'unzipping' | 'processing' | 'finalizing' | 'done' | 'error';
type Job = {
  id: string;
  dir: string;
  stage: JobStage;
  percent: number; // 0–100
  stats: ImportStats;
  error?: string;
  startedAt: number;
  updatedAt: number;
  done: boolean;
  messages: Array<{ t: number; text: string }>; // rolling log
};
const jobs: Record<string, Job> = Object.create(null);
const newJobId = () => `job_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const now = () => Date.now();
const setJob = (j: Job, patch: Partial<Job>) => {
  Object.assign(j, patch);
  j.updatedAt = now();
};
const pushMsg = (j: Job, text: string) => {
  try {
    j.messages.push({ t: now(), text });
    // keep last 100 messages
    if (j.messages.length > 100) j.messages.splice(0, j.messages.length - 100);
    j.updatedAt = now();
  } catch {}
};

const extractMentions = (title?: string): string[] => {
  if (!title) return [];
  const out = new Set<string>();
  const re = /@([A-Za-z0-9_](?:[A-Za-z0-9_.]*[A-Za-z0-9_])?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(title))) {
    out.add('@' + (m[1] || ''));
  }
  return Array.from(out);
};

// Try to read GPS coordinates from an Instagram JSON item
const extractGpsFromItem = (item: any): { lat: number; lon: number } | null => {
  const tryNum = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const lat = tryNum(pickField(item, [
    'media_map_data.0.lat', 'media_map_data.0.latitude', 'media_map_data.lat', 'media_map_data.latitude',
    'location.latitude', 'lat', 'latitude'
  ]));
  const lon = tryNum(pickField(item, [
    'media_map_data.0.long', 'media_map_data.0.lng', 'media_map_data.0.longitude', 'media_map_data.long', 'media_map_data.longitude',
    'location.longitude', 'lng', 'long', 'longitude'
  ]));
  if (lat != null && lon != null) return { lat, lon };
  return null;
};

// Parse timestamp from our IG-imported filename pattern: user_YYYY-MM-DD_HH-mm-ss.ext
const parseTsFromName = (name?: string): number | null => {
  try {
    if (!name) return null;
    const base = String(name).replace(/\.[^.]+$/, '');
    const m = base.match(/_(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})(?:$|[_-])/);
    if (!m) return null;
    const [_, y, mo, d, h, mi, s] = m;
    const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}Z`;
    const t = Date.parse(iso);
    return Number.isFinite(t) ? t : null;
  } catch { return null; }
};

// Ensure Article.media list is sorted by underlying media timestamp and updated in Strapi
const sortArticleMediaByDate = async (strapi: any, articleId: number) => {
  try {
    const populated = await strapi.entityService.findOne('api::article.article', articleId, { populate: { media: true } });
    const list = Array.isArray((populated as any)?.media?.data)
      ? (populated as any).media.data
      : (Array.isArray((populated as any)?.media) ? (populated as any).media : []);
    if (!Array.isArray(list) || !list.length) return;
    const items = list.map((m: any) => {
      const attrs = m?.attributes || m;
      const name = attrs?.name || attrs?.filename || '';
      const createdAt = attrs?.createdAt ? Date.parse(attrs.createdAt) : 0;
      const ts = parseTsFromName(name) || createdAt || 0;
      return { id: attrs?.id || m?.id, ts };
    }).filter((x: any) => x && x.id);
    items.sort((a: any, b: any) => a.ts - b.ts);
    const orderedIds = items.map((x: any) => x.id);
    await strapi.entityService.update('api::article.article', articleId, { data: { media: orderedIds } });
  } catch {}
};

// Append alternative text line (if any) into Article.description without duplicates
const appendAltToDescription = async (strapi: any, articleId: number, alt?: string) => {
  try {
    const txt = (alt || '').trim();
    if (!txt) return;
    const art = await strapi.entityService.findOne('api::article.article', articleId, { fields: ['description'] });
    const current = (art as any)?.description || '';
    const lines = current ? String(current).split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : [];
    if (lines.includes(txt)) return;
    lines.push(txt);
    await strapi.entityService.update('api::article.article', articleId, { data: { description: lines.join('\n') } });
  } catch {}
};

const ensureFolder = async (strapi: any, name: string) => {
  const pathWanted = `/${name}`;
  const byPath = await strapi.entityService.findMany('plugin::upload.folder', {
    filters: { path: { $eq: pathWanted } },
    fields: ['id', 'path', 'pathId', 'name'],
    limit: 1,
  });
  if (byPath && byPath[0]) return byPath[0];

  const existing = await strapi.entityService.findMany('plugin::upload.folder', {
    filters: { name: { $eqi: name } },
    fields: ['id', 'path', 'pathId', 'name'],
    limit: 1,
  });
  if (existing && existing[0]) return existing[0];

  // Create folder using the Upload plugin's folder service so required
  // computed fields (path, pathId) are handled correctly by Strapi.
  const folderSvc = strapi?.plugin?.('upload')?.service?.('folder');
  if (folderSvc && typeof folderSvc.create === 'function') {
    const created = await folderSvc.create({ name, parent: null });
    const full = await strapi.entityService.findOne('plugin::upload.folder', created.id, {
      fields: ['id', 'path', 'pathId', 'name'],
    });
    return full || created;
  }

  // Fallback: return undefined so uploads go to root folder
  return undefined;
};

const fileExists = async (p: string) => {
  try { await fs.promises.access(p, fs.constants.R_OK); return true; } catch { return false; }
};

const resolveMediaPath = async (tmpBase: string, catJsonPath: string, rel: string): Promise<string | null> => {
  const candidates = [
    path.join(tmpBase, rel.replace(/^\/?/, '')),
    path.join(tmpBase, 'your_instagram_activity', rel.replace(/^\/?/, '')),
    path.join(path.dirname(catJsonPath), '..', '..', rel.replace(/^\/?/, '')),
  ].map((p) => path.normalize(p));
  for (const c of candidates) {
    if (await fileExists(c)) return c;
  }
  return null;
};

const resolveProfileMedia = async (tmpBase: string, rel: string): Promise<string | null> => {
  const relNorm = rel.replace(/^\/?/, '');
  const candidates = [
    path.join(tmpBase, relNorm),
    path.join(tmpBase, 'your_instagram_activity', relNorm),
  ].map((p) => path.normalize(p));
  for (const c of candidates) {
    if (await fileExists(c)) return c;
  }
  return null;
};

const getVideoDimensions = async (p: string): Promise<{ width: number; height: number }> => {
  try {
    const { stdout } = await execFileAsync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=s=x:p=0', p]);
    const [w, h] = stdout.trim().split('x').map((n) => parseInt(n, 10));
    return { width: w || 0, height: h || 0 };
  } catch {
    return { width: 0, height: 0 };
  }
};

const createVideoVariants = async (strapi: any, absVideo: string, file: any) => {
  const variants = [
    { key: '480p', height: 480, bitrate: '800k' },
    { key: '720p', height: 720, bitrate: '1500k' },
  ];
  const publicDir = (strapi.dirs && (strapi.dirs as any).public) || path.join(process.cwd(), 'public');
  const relUrl = file?.url || '';
  const relDir = relUrl.startsWith('/') ? path.posix.dirname(relUrl.slice(1)) : path.posix.dirname(relUrl);
  const formats = (file && file.formats) ? { ...file.formats } : {};
  for (const v of variants) {
    if (formats[v.key]) continue;
    const name = `${file.hash}-${v.key}${file.ext}`;
    const destPath = path.join(publicDir, relDir, name);
    try {
      await execFileAsync('ffmpeg', ['-y', '-i', absVideo, '-vf', `scale=-2:${v.height}`, '-b:v', v.bitrate, destPath]);
      const st = await fs.promises.stat(destPath);
      const { width, height } = await getVideoDimensions(destPath);
      const url = `/${path.posix.join(relDir, name)}`;
      formats[v.key] = {
        ext: file.ext,
        mime: file.mime,
        size: st.size / 1024,
        width,
        height,
        hash: `${file.hash}-${v.key}`,
        name,
        path: null,
        url,
      };
    } catch {}
  }
  try {
    await strapi.entityService.update('plugin::upload.file', file.id, { data: { formats } });
    file.formats = formats;
  } catch {}
};

const pickJsonPath = async (contentDir: string, base: string): Promise<string | null> => {
  const names = [
    `${base}.json`,
    `${base}_1.json`,
    `${base}_2.json`,
  ];
  for (const n of names) {
    const p = path.join(contentDir, n);
    if (await fileExists(p)) return p;
  }
  return null;
};

const findJsonAnywhere = async (root: string, base: string): Promise<string | null> => {
  const wanted = new RegExp(`^${base}(?:_\\d+)?\\.json$`, 'i');
  const queue: string[] = [root];
  const seen = new Set<string>();
  while (queue.length) {
    const dir = queue.shift()!;
    if (seen.has(dir)) continue;
    seen.add(dir);
    let ents: fs.Dirent[] = [];
    try { ents = await fs.promises.readdir(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of ents) {
      const full = path.join(dir, e.name);
      if (e.isFile() && wanted.test(e.name)) return full;
      if (e.isDirectory()) queue.push(full);
    }
  }
  return null;
};

// Heuristic discovery of Instagram JSONs regardless of filename/localization.
// Returns an array of { key: 'posts'|'reels'|'stories', path }
const discoverCategoryJsons = async (root: string): Promise<Array<{ key: string; path: string }>> => {
  const results: Array<{ key: string; path: string }> = [];
  const queue: string[] = [root];
  const seen = new Set<string>();
  while (queue.length) {
    const dir = queue.shift()!;
    if (seen.has(dir)) continue;
    seen.add(dir);
    let ents: fs.Dirent[] = [];
    try { ents = await fs.promises.readdir(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of ents) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { queue.push(full); continue; }
      if (!e.isFile()) continue;
      if (!/\.json$/i.test(e.name)) continue;
      // Skip obviously unrelated large JSONs (>25MB) to avoid heavy I/O
      try {
        const st = await fs.promises.stat(full);
        if (st.size > 25 * 1024 * 1024) continue;
      } catch { continue; }
      // Try to parse and detect shape
      try {
        const txt = await fs.promises.readFile(full, 'utf8');
        const json = JSON.parse(txt);
        const arr: any[] = Array.isArray(json) ? json : (json && typeof json === 'object' ? (Object.values(json).find((v) => Array.isArray(v)) as any[] | undefined) : undefined) || [];
        if (!Array.isArray(arr) || !arr.length) continue;
        // Sample a few items to see if they look like IG media entries
        const sample = arr.slice(0, Math.min(arr.length, 5));
        let looksMedia = false;
        let anyUri = '';
        let anyTs = 0;
        for (const it of sample) {
          const uri = pickField(it, ['uri', 'path', 'media[0].uri', 'attachments[0].data.uri', 'media_map_data.0.uri']);
          const ts = pickField(it, ['creation_timestamp', 'taken_at', 'media[0].creation_timestamp']);
          if (uri && (typeof ts === 'number' || typeof ts === 'string')) { looksMedia = true; anyUri = String(uri); anyTs = Number(ts) || 0; break; }
        }
        if (!looksMedia) continue;
        // Classify as posts/reels/stories by path hints
        const hintPath = `${full} ${anyUri}`.toLowerCase();
        const key = /reel|clips/.test(hintPath) ? 'reels' : (/storie|stories/.test(hintPath) ? 'stories' : 'posts');
        results.push({ key, path: full });
      } catch {}
    }
  }
  // Deduplicate by file path (keep first occurrence)
  const seenPath = new Set<string>();
  return results.filter((r) => (seenPath.has(r.path) ? false : (seenPath.add(r.path), true)));
};

type IgItem = any;
const pickField = (item: IgItem, keys: string[]): any => {
  for (const k of keys) {
    const parts = k.split('.');
    let v: any = item;
    for (const p of parts) {
      if (v == null) break;
      if (p.endsWith(']')) {
        // handle simple arr[0] access
        const m = p.match(/^(.*)\[(\d+)\]$/);
        if (m) { v = v[m[1]]?.[Number(m[2])]; continue; }
      }
      v = v[p];
    }
    if (v != null) return v;
  }
  return undefined;
};

type ImportStats = {
  categories: string[];
  jsonFound: Array<{ key: string; path: string }>;
  itemsTotal: number;
  uploaded: number;
  skippedMissingMedia: number;
  uploadErrors: number;
  byCategory: Record<string, { items: number; uploaded: number; earliestTs?: number }>;
  articlesCreated: number;
  articlesUpdated: number;
  usernamesTouched: string[];
};

let CURRENT_AUTHOR_ID: number | undefined;

const processCategory = async (
  strapi: any,
  cat: any,
  usernameFromZip: string,
  touchedArticleIds: Set<number>,
  stats: ImportStats,
  onProgress?: (uploaded: number, total: number, msg?: string) => void,
) => {
  const looksMojibake = (s: string) => /[ÂÃ]|â[€€™“”]/.test(s);
  const fixMojibake = (s: string) => {
    try {
      if (!s) return s;
      return looksMojibake(s) ? Buffer.from(s, 'latin1').toString('utf8') : s;
    } catch {
      return s;
    }
  };
  const folder = await ensureFolder(strapi, cat.folderName);
  try { strapi.log.info(`[ig-import] folder resolved name=${cat.folderName} id=${folder?.id} pathId=${folder?.pathId} path=${folder?.path}`); } catch {}
  let raw: any;
  try {
    const buf = await fs.promises.readFile(cat.json);
    const text = buf.toString('utf8');
    raw = JSON.parse(text);
  } catch {
    return;
  }
  const itemsRaw: any[] = Array.isArray(raw)
    ? raw
    : (raw && typeof raw === 'object'
        ? ((Object.values(raw).find((v) => Array.isArray(v)) as any[]) || [])
        : []);
  const items = itemsRaw.slice().sort((a, b) => (a?.creation_timestamp || 0) - (b?.creation_timestamp || 0));
  if (!items.length) return;
  stats.itemsTotal += items.length;
  const catKey = String(cat?.key || cat?.folderName || 'unknown');
  stats.byCategory[catKey] = stats.byCategory[catKey] || { items: 0, uploaded: 0 };
  stats.byCategory[catKey].items += items.length;

  try { strapi.log.info(`[ig-import] processing ${items.length} items for ${cat.folderName}`); } catch {}
  // Track earliest GPS seen to resolve conflicts
  let earliestGps: { ts: number; lat: number; lon: number } | null = null;
  for (const item of items) {
    if (!item) continue;
    const rel = pickField(item, ['uri', 'path', 'media[0].uri', 'attachments[0].data.uri', 'media_map_data.0.uri']);
    const ts = pickField(item, ['creation_timestamp', 'taken_at', 'media[0].creation_timestamp']);
  const titleRaw = pickField(item, ['title', 'caption', 'media[0].title', 'string_map_data.Caption.value']) || '';
    const title = fixMojibake((typeof titleRaw === 'string' ? titleRaw : String(titleRaw || '')).normalize('NFC'));
    if (!rel || !ts) { try { strapi.log.debug(`[ig-import] skip item missing rel/ts rel=${!!rel} ts=${!!ts}`); } catch {} continue; }
    const mentions = extractMentions(title);
    const visitDate = new Date(ts * 1000);
    if (typeof ts === 'number') {
      const prev = stats.byCategory[catKey].earliestTs;
      stats.byCategory[catKey].earliestTs = prev == null ? ts : Math.min(prev, ts);
    }
    const dateStr = visitDate
      .toISOString()
      .replace(/\.\d{3}Z$/, '')
      .replace('T', '_')
      .replace(/:/g, '-');
    const relNorm = String(rel).replace(/^\/?/, '');
    const tmpBase = path.join(path.dirname(cat.json), '..');
    const srcPath = await resolveMediaPath(tmpBase, cat.json, relNorm);
    if (!srcPath) {
      try { strapi.log.info(`[ig-import] media not found for rel=${relNorm}`); } catch {}
      stats.skippedMissingMedia += 1;
      continue;
    }
    const ext = path.extname(srcPath).toLowerCase();
    const isImage = ['.jpg', '.jpeg', '.png', '.webp', '.heic'].includes(ext);
    const isVideo = ['.mp4', '.mov'].includes(ext);
    const baseName = `${usernameFromZip}_${dateStr}`;
    let targetExt = ext;
    let targetName = `${baseName}${targetExt}`;

  const exists = await strapi.entityService.findMany('plugin::upload.file', { filters: { name: targetName }, limit: 1 });
    if (exists && exists[0]) continue;

    let tmpOut = srcPath;
    if (isImage && convertImagesToWebp) {
      try {
        const sharp = require('sharp');
        const outPath = path.join(TMP_ROOT, `ig-${Date.now()}-${Math.random().toString(36).slice(2)}.webp`);
        await sharp(srcPath).webp({ quality: 90 }).toFile(outPath);
        tmpOut = outPath;
        targetExt = '.webp';
        targetName = `${baseName}${targetExt}`;
      } catch {}
    }

    try {
      const uploadSvc = strapi.plugin('upload').service('upload');
      const stat = await fs.promises.stat(tmpOut);
      const guessed = (mime.lookup(srcPath) as string) || (isVideo ? 'video/mp4' : 'image/jpeg');
      const files = {
        path: tmpOut,
        filepath: tmpOut,
        tmpPath: tmpOut,
        name: targetName,
        type: guessed,
        mime: guessed,
        size: stat.size,
        ext: targetExt,
        // Provide a stream explicitly to satisfy upload service
        stream: fs.createReadStream(tmpOut),
      } as any;
    const data = {
        fileInfo: {
          name: targetName,
          alternativeText: fixMojibake(title || '') || undefined,
      caption: fixMojibake(mentions.join(' ')),
        },
      } as any;
      // In Strapi v5, target folders are specified via data.folder
      const uploadArgs: any = {
        data: { ...data, folder: (folder as any)?.id },
        files: [files],
      };
      try { strapi.log.info(`[ig-import] uploading to folderId=${(folder as any)?.id || 'root'}`); } catch {}
      let created: any;
      try {
        created = await uploadSvc.upload(uploadArgs);
      } catch (e: any) {
        const details = (e && (e.details || e.stack || e.message)) || e;
        try { strapi.log.error(`[ig-import] upload error: ${JSON.stringify(details)}`); } catch {}
        // Continue with next item; do not fail the whole request
        stats.uploadErrors += 1;
        continue;
      }
  const createdFile = Array.isArray(created) ? created[0] : created;
      try { await strapi.entityService.update('plugin::upload.file', createdFile.id, { data: { mime: guessed, ext: targetExt } }); } catch {}
      // Ensure file is placed into the expected folder (in case upload service ignores data.folder)
      try {
        if ((folder as any)?.id) {
          await strapi.db.query('plugin::upload.file').update({
            where: { id: createdFile.id },
            data: { folder: (folder as any).id, folderPath: (folder as any).path || '/' },
          });
        }
      } catch {}
      try { strapi.log.info(`[ig-import] uploaded file id=${createdFile?.id} name=${createdFile?.name}`); } catch {}
      // Generate HLS playlist + segments for videos
      if (isVideo) {
        try {
          const publicDir = (strapi.dirs && (strapi.dirs as any).public) || path.join(process.cwd(), 'public');
          const hlsDir = path.join(publicDir, 'uploads', 'hls', String(createdFile.id));
          await fs.promises.mkdir(hlsDir, { recursive: true });
          const playlistPath = path.join(hlsDir, 'index.m3u8');
          await execFileAsync('ffmpeg', [
            '-y',
            '-i', tmpOut,
            '-codec', 'copy',
            '-start_number', '0',
            '-hls_time', '4',
            '-hls_list_size', '0',
            '-f', 'hls',
            '-hls_segment_filename', path.join(hlsDir, 'seg%03d.ts'),
            playlistPath,
          ]);
          const relPlaylist = `/uploads/hls/${createdFile.id}/index.m3u8`;
          const formats = { ...(createdFile.formats || {}), hls: { url: relPlaylist, ext: '.m3u8', mime: 'application/vnd.apple.mpegurl' } };
          await strapi.entityService.update('plugin::upload.file', createdFile.id, { data: { formats, hlsPlaylist: relPlaylist } });
        } catch (e: any) {
          try { strapi.log.warn(`[ig-import] hls generation failed: ${e?.message || e}`); } catch {}
        }
      }
      stats.uploaded += 1;
      stats.byCategory[catKey].uploaded += 1;
      if (onProgress) onProgress(stats.uploaded, stats.itemsTotal || 0);
      // Normalize mentions to lowercase for matching
  const usernames = (mentions.length ? mentions : [`@${usernameFromZip}`]).map((u: string) => u.toLowerCase());
      const truncate = (s: string, max: number) => {
        const arr = [...(s || '')];
        return arr.length > max ? arr.slice(0, max).join('') : s;
      };
      // Branch by category
      const key = String(cat.key || '').toLowerCase();
      const isStories = key === 'stories';
      const isPosts = key === 'posts';
      const isReels = key === 'reels';

  if (isPosts || isReels) {
        // Create or update a Post/Reel entity; do not attach media directly to Article
        const sourceId = targetName.replace(/\.[^.]+$/, '');
        const contentType = isPosts ? 'api::post.post' : 'api::reel.reel';
        let entity = await strapi.entityService.findMany(contentType, { filters: { source_id: sourceId }, limit: 1 });
        entity = (Array.isArray(entity) && entity[0]) ? entity[0] : null;
        let createdEntity: any = null;
        if (!entity) {
          createdEntity = await strapi.entityService.create(contentType, {
            data: {
              source: 'instagram',
              source_id: sourceId,
              caption: title || '',
              taken_at: visitDate.toISOString(),
              media: createdFile?.id ? { connect: [createdFile.id] } : undefined,
              publishedAt: new Date().toISOString(),
              ...(CURRENT_AUTHOR_ID ? { author: CURRENT_AUTHOR_ID } : {}),
            },
          });
        } else {
          // attach media to existing entity
          try {
            await strapi.entityService.update(contentType, (entity as any).id, { data: { media: { connect: [createdFile.id] } } });
          } catch {}
          createdEntity = entity;
        }
        // Ensure author is set on post/reel if provided
        try { if (CURRENT_AUTHOR_ID) await strapi.entityService.update(contentType, (createdEntity as any).id, { data: { author: CURRENT_AUTHOR_ID } }); } catch {}
        // Generate thumbnails for Posts/Reels when applicable
        try {
          const publicDir = (strapi.dirs && (strapi.dirs as any).public) || path.join(process.cwd(), 'public');
          const videoUrl = createdFile?.url as string;
          const isUploadedVideo = typeof videoUrl === 'string' && (/\.(mp4|mov)$/i.test(videoUrl) || (String(guessed || '').toLowerCase().includes('video')));
          const uploadThumbAndAttach = async (thumbPath: string) => {
            try {
              const uploadSvc = strapi.plugin('upload').service('upload');
              const st = await fs.promises.stat(thumbPath);
              const guessedThumb = (require('mime-types').lookup(thumbPath) as string) || 'image/jpeg';
              const files = [{ path: thumbPath, filepath: thumbPath, tmpPath: thumbPath, name: path.basename(thumbPath), type: guessedThumb, mime: guessedThumb, size: st.size, stream: fs.createReadStream(thumbPath) }];
              const createdThumb = await uploadSvc.upload({ data: {}, files });
              const file = Array.isArray(createdThumb) ? createdThumb[0] : createdThumb;
              if (file?.id) {
                try { await strapi.entityService.update(contentType, createdEntity.id, { data: { media: { connect: [file.id] } } }); } catch {}
              }
            } catch {}
          };
          if (isPosts) {
            // For posts: if uploaded media is a video, attach a clean (no overlay) thumbnail
            if (isUploadedVideo && typeof videoUrl === 'string') {
              const absVideo = path.join(publicDir, videoUrl.startsWith('/') ? videoUrl.slice(1) : videoUrl);
              const tmpThumb = path.join(TMP_ROOT, `post-thumb-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`);
              try {
                await execFileAsync('ffmpeg', ['-y', '-ss', '1', '-i', absVideo, '-vframes', '1', '-vf', 'scale=640:-1', tmpThumb]);
                await createVideoVariants(strapi, absVideo, createdFile);
                await uploadThumbAndAttach(tmpThumb);
              } catch {}
            }
          } else if (isReels) {
            // For reels: only generate a fallback if no image thumbnail is present in media
            try {
              const fresh = await strapi.entityService.findOne(contentType, createdEntity.id, { populate: { media: true } });
              const mediaList = Array.isArray((fresh as any)?.media?.data)
                ? (fresh as any).media.data
                : Array.isArray((fresh as any)?.media)
                  ? (fresh as any).media
                  : [];
              const hasImage = mediaList.some((m: any) => String(m?.attributes?.mime || m?.mime || '').toLowerCase().includes('image'));
              if (!hasImage && isUploadedVideo && typeof videoUrl === 'string') {
                const absVideo = path.join(publicDir, videoUrl.startsWith('/') ? videoUrl.slice(1) : videoUrl);
                const tmpThumb = path.join(TMP_ROOT, `reel-thumb-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`);
                try {
                  await execFileAsync('ffmpeg', ['-y', '-ss', '1', '-i', absVideo, '-vframes', '1', '-vf', 'scale=640:-1', tmpThumb]);
                  await createVideoVariants(strapi, absVideo, createdFile);
                  await uploadThumbAndAttach(tmpThumb);
                } catch {}
              } else if (isUploadedVideo && typeof videoUrl === 'string') {
                const absVideo = path.join(publicDir, videoUrl.startsWith('/') ? videoUrl.slice(1) : videoUrl);
                await createVideoVariants(strapi, absVideo, createdFile);
              }
            } catch {}
          }
        } catch {}
        // Link to Article(s) per mention
        for (const mention of usernames) {
          const uname = mention.startsWith('@') ? mention : `@${mention}`;
          // find or create Article
          let articleList = await strapi.entityService.findMany('api::article.article', { filters: { username: uname }, limit: 1 });
          let article = (Array.isArray(articleList) && articleList[0]) ? articleList[0] : null;
          if (!article) {
            try {
              article = await strapi.entityService.create('api::article.article', {
                data: { username: uname, title: uname, slug: uname.replace(/^@/, ''), publishedAt: new Date().toISOString(), ...(CURRENT_AUTHOR_ID ? { author: CURRENT_AUTHOR_ID } : {}) },
              });
              if (article?.id) touchedArticleIds.add(article.id);
            } catch {}
          }
          // Ensure author is set if provided
          try { if (CURRENT_AUTHOR_ID) await strapi.entityService.update('api::article.article', article.id, { data: { author: CURRENT_AUTHOR_ID } }); } catch {}
          try {
            const relField = isPosts ? 'posts' : 'reels';
            await strapi.entityService.update('api::article.article', article.id, {
              data: { [relField]: { connect: [createdEntity.id] } },
            });
            if (article?.id) touchedArticleIds.add(article.id);
          } catch {}
        }
        continue; // skip story-specific linking below
      }

      // Stories: attach media to Article and update dates
      // First, accumulate GPS and location if any, preferring the oldest timestamp
      try {
        const gps = extractGpsFromItem(item);
        if (gps && typeof ts === 'number') {
          if (!earliestGps || ts < earliestGps.ts) {
            earliestGps = { ts, lat: gps.lat, lon: gps.lon };
          }
        }
      } catch {}
      // If there are no mentions but GPS exists, create a placeholder article keyed by GPS
      const gps = extractGpsFromItem(item);
      if ((!usernames || usernames.length === 0) && gps) {
        const key = `${gps.lat.toFixed(6)},${gps.lon.toFixed(6)}`;
        let slugBase = key.replace(/[^0-9.,-]/g, '').replace(/\s+/g, '-');
        let slug = `loc-${slugBase}`;
        try {
          // Ensure slug is unique by appending random token if needed
          const exists = await strapi.entityService.findMany('api::article.article', { filters: { slug }, limit: 1 });
          if (exists && exists[0]) slug = `loc-${slugBase}-${Math.random().toString(36).slice(2, 6)}`;
        } catch {}
        let article = await strapi.entityService.create('api::article.article', {
          data: {
            title: key,
            slug,
            username: undefined,
            description: title || '',
            latitude: gps.lat,
            longitude: gps.lon,
            publishedAt: new Date().toISOString(),
            ...(CURRENT_AUTHOR_ID ? { author: CURRENT_AUTHOR_ID } : {}),
          },
        });
        if (article?.id) { touchedArticleIds.add(article.id); stats.articlesCreated += 1; }
        try { await strapi.entityService.update('api::article.article', article.id, { data: { media: { connect: [createdFile.id] } } }); } catch {}
        // Append alt text to description and re-sort media
        try { await appendAltToDescription(strapi, article.id, (createdFile as any)?.alternativeText || (createdFile as any)?.caption); } catch {}
        await sortArticleMediaByDate(strapi, article.id);
        // Set search/location helper fields if present
        try { await strapi.entityService.update('api::article.article', article.id, { data: { latitude: gps.lat, longitude: gps.lon } }); } catch {}
        continue;
      }
      for (const mention of usernames) {
        const uname = mention.startsWith('@') ? mention : `@${mention}`;
        if (!stats.usernamesTouched.includes(uname)) stats.usernamesTouched.push(uname);
        const found = await strapi.entityService.findMany('api::article.article', { filters: { username: uname }, limit: 1 });
        const baseName = targetName.replace(/\.[^.]+$/, '');
        let article = (found && found[0]) ? found[0] : null;
          if (!article) {
            try {
              article = await strapi.entityService.create('api::article.article', {
                data: {
                  username: uname,
                  title: uname,
                  slug: uname.replace(/^@/, ''),
                  description: title || '',
                  cover: createdFile?.id ? { connect: [createdFile.id] } : undefined,
                  publishedAt: new Date().toISOString(),
                  ...(CURRENT_AUTHOR_ID ? { author: CURRENT_AUTHOR_ID } : {}),
                },
              });
              if (article?.id) { touchedArticleIds.add(article.id); stats.articlesCreated += 1; }
              if (onProgress) onProgress(stats.uploaded, stats.itemsTotal || 0, `Création de l’article pour ${uname}…`);
            } catch (e) {
              // Retry without description if it violates constraints
              article = await strapi.entityService.create('api::article.article', {
                data: {
                  username: uname,
                  title: uname,
                  slug: uname.replace(/^@/, ''),
                  cover: createdFile?.id ? { connect: [createdFile.id] } : undefined,
                  publishedAt: new Date().toISOString(),
                  ...(CURRENT_AUTHOR_ID ? { author: CURRENT_AUTHOR_ID } : {}),
                },
              });
              if (article?.id) { touchedArticleIds.add(article.id); stats.articlesCreated += 1; }
              if (onProgress) onProgress(stats.uploaded, stats.itemsTotal || 0, `Création de l’article pour ${uname}…`);
            }
          }
        // Ensure author set on existing article
        try { if (CURRENT_AUTHOR_ID) await strapi.entityService.update('api::article.article', article.id, { data: { author: CURRENT_AUTHOR_ID } }); } catch {}
        // Ensure article is published
        try {
          if (!(article as any)?.publishedAt) {
            await strapi.entityService.update('api::article.article', article.id, { data: { publishedAt: new Date().toISOString() } });
          }
        } catch {}
  // Try to connect uploaded file to an optional 'media' field if it exists; ignore if it doesn't
        try {
          await strapi.entityService.update('api::article.article', article.id, { data: { media: { connect: [createdFile.id] } } });
          if (article?.id) { touchedArticleIds.add(article.id); stats.articlesUpdated += 1; }
          if (onProgress) onProgress(stats.uploaded, stats.itemsTotal || 0, `Mise à jour de l’article ${uname}`);
        } catch {}
  // Append alt text from this image to article description (newline separated, no duplicates)
  try { await appendAltToDescription(strapi, article.id, (createdFile as any)?.alternativeText || (createdFile as any)?.caption); } catch {}
  // Maintain media ordering chronologically (ensure new media is placed before later media)
  await sortArticleMediaByDate(strapi, article.id);
        // Ensure cover is set if not already; for videos, generate a thumbnail and set as cover
        try {
          if (!article?.cover && createdFile?.id) {
            let coverFileId: number | undefined = createdFile.id;
            if (isVideo) {
              try {
                const publicDir = (strapi.dirs && (strapi.dirs as any).public) || path.join(process.cwd(), 'public');
                const videoUrl = createdFile?.url as string;
                const absVideo = path.join(publicDir, videoUrl.startsWith('/') ? videoUrl.slice(1) : videoUrl);
                const tmpThumb = path.join(TMP_ROOT, `thumb-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`);
                const font = '/usr/share/fonts/dejavu/DejaVuSans.ttf';
                try {
                  await execFileAsync('ffmpeg', ['-y', '-ss', '1', '-i', absVideo, '-vframes', '1', '-vf', `scale=640:-1,drawtext=fontfile=${font}:text=▶:fontcolor=white:fontsize=120:x=(w-text_w)/2:y=(h-text_h)/2:box=1:boxcolor=black@0.4:boxborderw=20`, tmpThumb]);
                } catch {
                  await execFileAsync('ffmpeg', ['-y', '-ss', '1', '-i', absVideo, '-vframes', '1', '-vf', 'scale=640:-1', tmpThumb]);
                }
                await createVideoVariants(strapi, absVideo, createdFile);
                const st2 = await fs.promises.stat(tmpThumb);
                const filesThumb = [{ path: tmpThumb, filepath: tmpThumb, tmpPath: tmpThumb, name: path.basename(tmpThumb), type: 'image/jpeg', mime: 'image/jpeg', size: st2.size, stream: fs.createReadStream(tmpThumb) }];
                const createdThumb = await strapi.plugin('upload').service('upload').upload({ data: {}, files: filesThumb });
                const fileThumb = Array.isArray(createdThumb) ? createdThumb[0] : createdThumb;
                coverFileId = fileThumb?.id || coverFileId;
              } catch {}
            }
            await strapi.entityService.update('api::article.article', article.id, { data: { cover: coverFileId ? { connect: [coverFileId] } : undefined } });
            if (article?.id) { touchedArticleIds.add(article.id); stats.articlesUpdated += 1; }
            if (onProgress) onProgress(stats.uploaded, stats.itemsTotal || 0, `Mise à jour de l’article ${uname}`);
          }
        } catch {}
        // Update visit dates: preserve first_visit, refresh last_visit; and write GPS if provided
        try {
          const current = await strapi.entityService.findOne('api::article.article', article.id, { fields: ['first_visit','last_visit'] });
          const patch: any = { last_visit: visitDate.toISOString() };
          if (!current?.first_visit) patch.first_visit = visitDate.toISOString();
          if (gps && (!article.latitude || !article.longitude)) {
            patch.latitude = gps.lat;
            patch.longitude = gps.lon;
          }
          await strapi.entityService.update('api::article.article', article.id, { data: patch });
        } catch {}
      }
    } catch (e) {
      try { strapi.log.error(`[ig-import] upload failed: ${(e as any)?.message}`); } catch {}
    }
  }
};

export default {
  async importZip(ctx: any) {
    let tmpBase: string | null = null;
    let shouldCleanup = true;
    try {
      const stats: ImportStats = {
        categories: [],
        jsonFound: [],
        itemsTotal: 0,
        uploaded: 0,
        skippedMissingMedia: 0,
        uploadErrors: 0,
        byCategory: {},
        articlesCreated: 0,
        articlesUpdated: 0,
        usernamesTouched: [],
      };

      const filesObj = (ctx.request && ctx.request.files) || {};
      try { ctx.strapi.log.debug(`[ig-import] received files keys=${JSON.stringify(Object.keys(filesObj || {}))}`); } catch {}

      // Only pick multipart fields likely to hold files
      const collect: any[] = [];
      const addMany = (v: any) => { if (!v) return; const arr = Array.isArray(v) ? v : [v]; for (const f of arr) { const p = (f && (f.filepath || f.path)); if (p) collect.push(f); } };
      addMany((filesObj as any).files);
      addMany((filesObj as any).file);

      // Deduplicate by tmp path/name
      const seen = new Set<string>();
      const files = collect.filter((f) => {
        const k = String((f as any).filepath || (f as any).path || (f as any).name || Math.random());
        if (seen.has(k)) return false; seen.add(k); return true;
      });
      if (!files.length) {
        ctx.status = 400;
        ctx.body = { error: 'At least one .zip file is required (use field: files)' };
        return;
      }

      tmpBase = path.join(TMP_ROOT, `igimport-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      await fs.promises.mkdir(tmpBase, { recursive: true });

      // Create job and start background processing
      const jobId = newJobId();
      const job: Job = {
        id: jobId,
        dir: tmpBase,
        stage: 'queued',
        percent: 10,
        stats,
        startedAt: now(),
        updatedAt: now(),
        done: false,
        messages: [],
      };
      jobs[jobId] = job;

      // Stage uploads into job dir first
      for (const f of files) {
        const displayName = f.name || f.originalFilename || f.newFilename || 'archive.zip';
        const tmpZip = path.join(tmpBase, path.basename(displayName));
        const sourcePath = (f.filepath || f.path || (f.files && f.files.path));
        if (!sourcePath) {
          setJob(job, { stage: 'error', error: 'failed to stage file (no tmp path)', done: true });
          ctx.status = 500; ctx.body = { error: 'failed to stage file (no tmp path)' }; return;
        }
        await fs.promises.copyFile(sourcePath, tmpZip);
      }

      // Snapshot staging context to avoid closure races
      const workDir = tmpBase as string;
      const stagedFiles = files.slice();

      // Kick off async worker
      (async () => {
        let dir: string | null = null;
        try {
          dir = workDir;
          if (!dir || typeof dir !== 'string') {
            setJob(job, { stage: 'error', error: 'internal: no working directory', done: true });
            return;
          }
          setJob(job, { stage: 'unzipping', percent: Math.max(job.percent, 12) });
          pushMsg(job, 'Décompression des archives…');
          let defaultUser = 'user';
          // Unzip each staged archive
          for (const f of stagedFiles) {
            const displayName = f.name || f.originalFilename || f.newFilename || 'archive.zip';
            const tmpZip = path.join(dir, path.basename(displayName));
            try {
              await execFileAsync('unzip', ['-qq', tmpZip, '-d', dir], { timeout: 0 });
            } catch (e: any) {
              setJob(job, { stage: 'error', error: `unzip failed: ${e?.message || e}`, done: true, percent: job.percent });
              return;
            }
            const m = String(displayName).match(/instagram-([^\-]+)-/i);
            if (m) defaultUser = m[1];
          }

          // Quick visibility into extracted tree (top-level only)
          try {
            const tops = await fs.promises.readdir(dir, { withFileTypes: true });
            const names = tops.map((e) => (e.isDirectory() ? e.name + '/' : e.name)).slice(0, 20).join(', ');
            pushMsg(job, `Racine extraite: ${names}`);
          } catch {}

          const contentDir = path.join(dir, 'your_instagram_activity', 'content');
          const mediaDir = path.join(dir, 'your_instagram_activity', 'media');
          const categoriesBase = ['posts', 'stories', 'reels'];
          const touched = new Set<number>();

          // Ensure Author exists and handle profile photo
          let authorId: number | undefined;
          try {
            const authorName = String(defaultUser || '').trim();
            if (authorName) {
              const existing = await strapi.entityService.findMany('api::author.author', { filters: { name: { $eqi: authorName } }, limit: 1 });
              let author = (Array.isArray(existing) && existing[0]) ? existing[0] : null;
              if (!author) {
                const slug = authorName.replace(/^@/, '').trim().toLowerCase().replace(/[^a-z0-9_\-]+/g, '-').replace(/^-+|-+$/g, '');
                author = await strapi.entityService.create('api::author.author', { data: { name: authorName, slug } });
              }
              {
                const aid = Number((author as any)?.id);
                authorId = Number.isFinite(aid) ? aid : undefined;
                CURRENT_AUTHOR_ID = authorId;
              }
              // Load latest profile photo and upload to Profiles/; only set author.avatar if not already set
              const profileJson = path.join(mediaDir, 'profile_photos.json');
              if (await fileExists(profileJson)) {
                const txt = await fs.promises.readFile(profileJson, 'utf8');
                const arr = JSON.parse(txt);
                const list: any[] = Array.isArray(arr) ? arr : [];
                const latest = list.slice().sort((a, b) => (b?.creation_timestamp || 0) - (a?.creation_timestamp || 0))[0];
                const uri = latest?.uri || latest?.path;
                const ts = latest?.creation_timestamp ? Number(latest.creation_timestamp) : Math.floor(Date.now() / 1000);
                if (uri) {
                  const p = await resolveProfileMedia(dir, String(uri));
                  if (p) {
                    const profilesFolder = await ensureFolder(strapi, 'Profiles');
                    const dt = new Date(ts * 1000).toISOString().replace(/\..*$/, '').replace(/[:T]/g, '-');
                    const nameSafe = `${authorName.replace(/[^A-Za-z0-9_\-]+/g, '_')}-profile-${dt}${path.extname(p) || '.jpg'}`;
                    const st = await fs.promises.stat(p);
                    const guessed = (mime.lookup(p) as string) || 'image/jpeg';
                    const files = [{ path: p, filepath: p, tmpPath: p, name: nameSafe, type: guessed, mime: guessed, size: st.size, stream: fs.createReadStream(p) }];
                    try {
                      const created = await strapi.plugin('upload').service('upload').upload({ data: { folder: (profilesFolder as any)?.id }, files });
                      const file = Array.isArray(created) ? created[0] : created;
                      try {
                        const populated = await strapi.entityService.findOne('api::author.author', author.id, { populate: { avatar: true } });
                        const hasAvatar = !!(populated as any)?.avatar;
                        if (!hasAvatar && file?.id) {
                          await strapi.entityService.update('api::author.author', author.id, { data: { avatar: { connect: [file.id] } } });
                        }
                      } catch {}
                    } catch {}
                  }
                }
              }
            }
          } catch {}
          // Discover JSONs (robust to localized/new archive formats)
          const discovered = await (async () => {
            const list: Array<{ key: string; path: string }> = [];
            for (const key of categoriesBase) {
              let jsonPath = await pickJsonPath(contentDir, key);
              if (!jsonPath) jsonPath = await findJsonAnywhere(dir, key);
              if (jsonPath) list.push({ key, path: jsonPath });
            }
            if (list.length) return list;
            // Fallback to heuristic scan
            const heuristic = await discoverCategoryJsons(dir);
            if (!heuristic.length) return list;
            // Log which files were picked
            try { pushMsg(job, `Découverte heuristique: ${heuristic.map((h) => path.basename(h.path)).join(', ')}`); } catch {}
            return heuristic;
          })();

          // Compute progress targets and messages
          for (const meta of discovered) {
            const key = meta.key;
            const jsonPath = meta.path;
            stats.categories.push(key);
            stats.jsonFound.push({ key, path: jsonPath });
            try {
              const buf = await fs.promises.readFile(jsonPath);
              const raw = JSON.parse(buf.toString('utf8'));
              const arr: any[] = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' ? ((Object.values(raw).find((v) => Array.isArray(v)) as any[]) || []) : []);
              stats.itemsTotal += arr.length;
              let earliest = Infinity;
              for (const it of arr) {
                const ts = (it && (it.creation_timestamp || (it as any).taken_at || ((it as any).media && (it as any).media[0] && (it as any).media[0].creation_timestamp))) || 0;
                if (ts && ts < earliest) earliest = ts;
              }
              if (earliest !== Infinity) {
                const d = new Date(earliest * 1000);
                const dd = String(d.getDate()).padStart(2, '0');
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const yyyy = d.getFullYear();
                const label = key === 'stories' ? 'stories' : key === 'reels' ? 'reels' : 'posts';
                pushMsg(job, `Import des ${label} du ${dd}/${mm}/${yyyy}`);
              }
            } catch {}
          }

          setJob(job, { stage: 'processing', percent: Math.max(job.percent, stats.itemsTotal ? 20 : 15) });
          if (!stats.itemsTotal) pushMsg(job, 'Aucun élément détecté dans les JSON');

          const onProgress = (uploaded: number, total: number, msg?: string) => {
            // Map uploaded/total into 10% → 90%
            const base = 10;
            const span = 80; // keep headroom for finalizing
            const frac = total > 0 ? Math.min(1, uploaded / total) : 0;
            const pct = Math.min(90, Math.floor(base + frac * span));
            setJob(job, { percent: Math.max(job.percent, pct) });
            if (msg) pushMsg(job, msg);
          };

          // Now process each category with progress callback
          for (const meta of stats.jsonFound) {
            const key = meta.key;
            await processCategory(
              strapi,
              { key, json: meta.path, folderName: key.charAt(0).toUpperCase() + key.slice(1) },
              defaultUser,
              touched,
              stats,
              onProgress,
            );
          }

          // Finalization stage
          setJob(job, { stage: 'finalizing', percent: Math.max(job.percent, 95) });
          pushMsg(job, 'Sauvegarde…');
          try {
            const ids = Array.from(touched);
            if (ids.length) {
              const hasDocumentsApi = typeof (strapi as any).documents === 'function';
              const documentsApi = hasDocumentsApi ? (strapi as any).documents('api::article.article') : null;
              for (const id of ids) {
                try {
                  const art = await strapi.entityService.findOne('api::article.article', id, { populate: { media: true, cover: true } });
                  if (!art) continue;
                  const artAny: any = art as any;
                  if (documentsApi && artAny.documentId) {
                    try { await documentsApi.publish({ documentId: artAny.documentId }); }
                    catch { try { await documentsApi.unpublish({ documentId: artAny.documentId }); await documentsApi.publish({ documentId: artAny.documentId }); } catch {} }
                  } else {
                    const mediaList = Array.isArray(artAny.media?.data) ? artAny.media.data : (Array.isArray(artAny.media) ? artAny.media : []);
                    const mediaIds = mediaList.map((m: any) => (m?.id ?? m?.documentId ?? null)).filter(Boolean);
                    const coverId = artAny.cover?.id ?? artAny.cover?.data?.id ?? null;
                    await strapi.entityService.update('api::article.article', id, { data: { media: mediaIds, cover: coverId } });
                  }
                } catch {}
              }
            }
          } catch {}

          // Final summary message
          try {
            const by = stats.byCategory || {} as any;
            const nPosts = by.posts?.uploaded || 0;
            const nReels = by.reels?.uploaded || 0;
            const nStories = by.stories?.uploaded || 0;
            const created = stats.articlesCreated || 0;
            const updated = stats.articlesUpdated || 0;
            let sentence = `${nPosts} posts, ${nReels} reels et ${nStories} stories ajoutés`;
            if (created && !updated) sentence += `, ${created} articles créés !`;
            else if (!created && updated) sentence += `, ${updated} articles mis à jour !`;
            else if (created && updated) sentence += `, ${created} articles créés, ${updated} articles mis à jour !`;
            else sentence += ' !';
            pushMsg(job, sentence);
          } catch {}
          setJob(job, { stage: 'done', percent: 100, done: true });
        } catch (e: any) {
          setJob(job, { stage: 'error', error: String(e?.message || e), done: true });
        } finally {
          // Cleanup job dir
          try { if (dir) await fs.promises.rm(dir, { recursive: true, force: true }); } catch {}
        }
      })();

      // Respond immediately with job id for polling. Prevent request-level cleanup;
      // background worker will handle tmp dir removal.
      ctx.body = { ok: true, jobId };
      shouldCleanup = false; // background worker owns cleanup
      return;

      // Extract each archive into the same folder
      let defaultUser = 'user';
      for (const f of files) {
        const displayName = f.name || f.originalFilename || f.newFilename || 'archive.zip';
        const tmpZip = path.join(tmpBase, path.basename(displayName));
        const sourcePath = (f.filepath || f.path || (f.files && f.files.path));
        if (!sourcePath) {
          ctx.status = 500; ctx.body = { error: 'failed to stage file (no tmp path)', file: displayName }; return;
        }
        await fs.promises.copyFile(sourcePath, tmpZip);
        try {
          await execFileAsync('unzip', ['-qq', tmpZip, '-d', tmpBase], { timeout: 0 });
        } catch (e: any) {
          ctx.status = 500; ctx.body = { error: `unzip failed: ${e?.message}`, file: displayName }; return;
        }
        try { ctx.strapi.log.info(`[ig-import] unzip ok tmpBase=${tmpBase} from ${displayName}`); } catch {}
        const m = String(displayName).match(/instagram-([^\-]+)-/i);
        if (m) defaultUser = m[1];
      }

      const contentDir = path.join(tmpBase, 'your_instagram_activity', 'content');
      const mediaDir = path.join(tmpBase, 'your_instagram_activity', 'media');
      const categoriesBase = ['posts', 'stories', 'reels'];
      const touched = new Set<number>();

      // Ensure Author & handle profile photo in synchronous path
          let authorId: number | undefined;
          try {
            const authorName = String(defaultUser || '').trim();
            if (authorName) {
              const existing = await strapi.entityService.findMany('api::author.author', { filters: { name: { $eqi: authorName } }, limit: 1 });
              let author = (Array.isArray(existing) && existing[0]) ? existing[0] : null;
              if (!author) {
                const slug = authorName.replace(/^@/, '').trim().toLowerCase().replace(/[^a-z0-9_\-]+/g, '-').replace(/^-+|-+$/g, '');
                author = await strapi.entityService.create('api::author.author', { data: { name: authorName, slug } });
              }
              {
                const aid = Number((author as any)?.id);
                authorId = Number.isFinite(aid) ? aid : undefined;
                CURRENT_AUTHOR_ID = authorId;
              }
          const profileJson = path.join(mediaDir, 'profile_photos.json');
          if (await fileExists(profileJson)) {
            const txt = await fs.promises.readFile(profileJson, 'utf8');
            const arr = JSON.parse(txt);
            const list: any[] = Array.isArray(arr) ? arr : [];
            const latest = list.slice().sort((a, b) => (b?.creation_timestamp || 0) - (a?.creation_timestamp || 0))[0];
            const uri = latest?.uri || latest?.path;
            const ts = latest?.creation_timestamp ? Number(latest.creation_timestamp) : Math.floor(Date.now() / 1000);
            if (uri) {
              const p = await resolveProfileMedia(tmpBase, String(uri));
              if (p) {
                const profilesFolder = await ensureFolder(strapi, 'Profiles');
                const dt = new Date(ts * 1000).toISOString().replace(/\..*$/, '').replace(/[:T]/g, '-');
                const nameSafe = `${authorName.replace(/[^A-Za-z0-9_\-]+/g, '_')}-profile-${dt}${path.extname(p) || '.jpg'}`;
                const st = await fs.promises.stat(p);
                const guessed = (mime.lookup(p) as string) || 'image/jpeg';
                const files = [{ path: p, filepath: p, tmpPath: p, name: nameSafe, type: guessed, mime: guessed, size: st.size, stream: fs.createReadStream(p) }];
                try {
                  const created = await strapi.plugin('upload').service('upload').upload({ data: { folder: (profilesFolder as any)?.id }, files });
                  const file = Array.isArray(created) ? created[0] : created;
                  try {
                    const populated = await strapi.entityService.findOne('api::author.author', author.id, { populate: { avatar: true } });
                    const hasAvatar = !!(populated as any)?.avatar;
                    if (!hasAvatar && file?.id) {
                      await strapi.entityService.update('api::author.author', author.id, { data: { avatar: { connect: [file.id] } } });
                    }
                  } catch {}
                } catch {}
              }
            }
          }
        }
      } catch {}
      for (const key of categoriesBase) {
        let jsonPath = await pickJsonPath(contentDir, key);
        if (!jsonPath) jsonPath = await findJsonAnywhere(tmpBase, key);
        if (!jsonPath) { try { ctx.strapi.log.info(`[ig-import] json not found for ${key}`); } catch {} continue; }
        stats.categories.push(key);
        stats.jsonFound.push({ key, path: jsonPath });
        try { ctx.strapi.log.info(`[ig-import] using json for ${key}: ${jsonPath}`); } catch {}
        await processCategory(strapi, { key, json: jsonPath, folderName: key.charAt(0).toUpperCase() + key.slice(1) }, defaultUser, touched, stats, undefined);
      }

      // After import, refresh only articles that received new media/cover
      try {
        const ids = Array.from(touched);
        if (ids.length) {
          const hasDocumentsApi = typeof (strapi as any).documents === 'function';
          const documentsApi = hasDocumentsApi ? (strapi as any).documents('api::article.article') : null;
          let republished = 0;
          let reassigned = 0;
          let failed: Array<{ id: number; error: string }> = [];

          for (const id of ids) {
            try {
              const art = await strapi.entityService.findOne('api::article.article', id, { populate: { media: true, cover: true } });
              if (!art) continue;
              const artAny: any = art as any;
              if (documentsApi && artAny.documentId) {
                try {
                  await documentsApi.publish({ documentId: artAny.documentId });
                  republished++;
                  continue;
                } catch {
                  try {
                    await documentsApi.unpublish({ documentId: artAny.documentId });
                    await documentsApi.publish({ documentId: artAny.documentId });
                    republished++;
                    continue;
                  } catch {}
                }
              }
              const mediaList = Array.isArray(artAny.media?.data)
                ? artAny.media.data
                : Array.isArray(artAny.media)
                  ? artAny.media
                  : [];
              const mediaIds = mediaList.map((m: any) => (m?.id ?? m?.documentId ?? null)).filter(Boolean);
              const coverId = artAny.cover?.id ?? artAny.cover?.data?.id ?? null;
              await strapi.entityService.update('api::article.article', id, { data: { media: mediaIds, cover: coverId } });
              reassigned++;
            } catch (e: any) {
              failed.push({ id, error: String(e?.message || e) });
            }
          }
          ctx.body = { ok: true, stats, refreshed: ids.length, republished, reassigned, failed };
          return;
        }
      } catch (e) {
        // Non-fatal; continue
      }
      ctx.body = { ok: true, stats, refreshed: 0 };
    } catch (err: any) {
      try { ctx.strapi.log.error('[ig-import] fatal error ' + (err?.stack || err?.message || String(err))); } catch {}
      ctx.status = 500;
      ctx.body = { data: null, error: { status: 500, name: 'InternalServerError', message: err?.message || 'import failed', detail: String(err) } };
    } finally {
      // Best-effort cleanup of temporary extraction directory when no background job was started
      if (shouldCleanup && tmpBase) {
        try {
          await fs.promises.rm(tmpBase, { recursive: true, force: true });
          try { ctx.strapi.log.debug(`[ig-import] cleaned tmp dir ${tmpBase}`); } catch {}
        } catch (e) {
          try { ctx.strapi.log.warn(`[ig-import] failed to clean tmp dir ${tmpBase}: ${String((e as any)?.message || e)}`); } catch {}
        }
      }
    }
  },
  async status(ctx: any) {
    const id = String(ctx.request.query?.job || ctx.request.query?.id || '').trim();
    if (!id) { ctx.status = 400; ctx.body = { error: 'job query parameter is required' }; return; }
    const job = jobs[id];
    if (!job) { ctx.status = 404; ctx.body = { error: 'job not found' }; return; }
    ctx.body = {
      id: job.id,
      stage: job.stage,
      percent: job.percent,
      stats: job.stats,
      error: job.error,
      startedAt: job.startedAt,
      updatedAt: job.updatedAt,
      done: job.done,
      messages: job.messages,
    };
  },
};
