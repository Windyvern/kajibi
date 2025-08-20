import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import mime from 'mime-types';

// Keep originals to preserve extensions and avoid .bin classification
const convertImagesToWebp = false;

const execFileAsync = promisify(execFile);

const extractMentions = (title?: string): string[] => {
  if (!title) return [];
  return title.split(/\s+/).filter((w) => /^@[\w.]+$/.test(w));
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

const processCategory = async (strapi: any, cat: any, usernameFromZip: string) => {
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

  try { strapi.log.info(`[ig-import] processing ${items.length} items for ${cat.folderName}`); } catch {}
  for (const item of items) {
    if (!item) continue;
    const rel = pickField(item, ['uri', 'path', 'media[0].uri', 'attachments[0].data.uri', 'media_map_data.0.uri']);
    const ts = pickField(item, ['creation_timestamp', 'taken_at', 'media[0].creation_timestamp']);
    const titleRaw = pickField(item, ['title', 'caption', 'media[0].title', 'string_map_data.Caption.value']) || '';
    const title = fixMojibake((typeof titleRaw === 'string' ? titleRaw : String(titleRaw || '')).normalize('NFC'));
    if (!rel || !ts) { try { strapi.log.debug(`[ig-import] skip item missing rel/ts rel=${!!rel} ts=${!!ts}`); } catch {} continue; }
    const mentions = extractMentions(title);
    const visitDate = new Date(ts * 1000);
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
      continue;
    }
    const ext = path.extname(srcPath).toLowerCase();
    const isImage = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);
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
        const outPath = path.join('/tmp', `ig-${Date.now()}-${Math.random().toString(36).slice(2)}.webp`);
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
      const usernames = mentions.length ? mentions.map((m) => m) : [`@${usernameFromZip}`];
      const truncate = (s: string, max: number) => {
        const arr = [...(s || '')];
        return arr.length > max ? arr.slice(0, max).join('') : s;
      };
      for (const mention of usernames) {
        const uname = mention.startsWith('@') ? mention : `@${mention}`;
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
                description: truncate(title || '', 80),
                cover: createdFile?.id ? { connect: [createdFile.id] } : undefined,
                publishedAt: new Date().toISOString(),
              },
            });
          } catch (e) {
            // Retry without description if it violates constraints
            article = await strapi.entityService.create('api::article.article', {
              data: {
                username: uname,
                title: uname,
                slug: uname.replace(/^@/, ''),
                cover: createdFile?.id ? { connect: [createdFile.id] } : undefined,
                publishedAt: new Date().toISOString(),
              },
            });
          }
        }
        // Ensure article is published
        try {
          if (!(article as any)?.publishedAt) {
            await strapi.entityService.update('api::article.article', article.id, { data: { publishedAt: new Date().toISOString() } });
          }
        } catch {}
        // Try to connect uploaded file to an optional 'media' field if it exists; ignore if it doesn't
        try { await strapi.entityService.update('api::article.article', article.id, { data: { media: { connect: [createdFile.id] } } }); } catch {}
        // Ensure cover is set if not already
        try { await strapi.entityService.update('api::article.article', article.id, { data: { cover: createdFile?.id ? { connect: [createdFile.id] } : undefined } }); } catch {}
        // Update visit dates: preserve first_visit, refresh last_visit
        try {
          const current = await strapi.entityService.findOne('api::article.article', article.id, { fields: ['first_visit','last_visit'] });
          const patch: any = { last_visit: visitDate.toISOString() };
          if (!current?.first_visit) patch.first_visit = visitDate.toISOString();
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
    const filesObj = (ctx.request && ctx.request.files) || {};
    try { ctx.strapi.log.debug(`[ig-import] received files keys=${JSON.stringify(Object.keys(filesObj || {}))}`); } catch {}
    let file: any = undefined;
    if (Array.isArray((filesObj as any).files)) file = (filesObj as any).files[0];
    else if ((filesObj as any).files) file = (filesObj as any).files;
    else if ((filesObj as any).file) file = (filesObj as any).file;
    else {
      const vals = Object.values(filesObj || {});
      if (vals && vals.length) file = vals[0];
    }
    if (!file) {
      ctx.status = 400;
      ctx.body = { error: 'zip file is required (field: file or files)', details: Object.keys(filesObj || {}) };
      return;
    }
    const tmpBase = path.join('/tmp', `igimport-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.promises.mkdir(tmpBase, { recursive: true });
    const tmpZip = path.join(tmpBase, path.basename(file.name || file.originalFilename || file.newFilename || 'archive.zip'));
    try {
      const sourcePath = (file.filepath || file.path || (file.files && file.files.path));
      if (!sourcePath) throw new Error('no tmp path on uploaded file');
      await fs.promises.copyFile(sourcePath, tmpZip);
    } catch (e) {
      ctx.status = 500;
      ctx.body = { error: 'failed to stage file' };
      return;
    }
    try {
      await execFileAsync('unzip', ['-qq', tmpZip, '-d', tmpBase], { timeout: 60000 });
    } catch (e: any) {
      ctx.status = 500;
      ctx.body = { error: `unzip failed: ${e?.message}` };
      return;
    }
    try { ctx.strapi.log.info(`[ig-import] unzip ok tmpBase=${tmpBase}`); } catch {}
    const zipName = path.basename(tmpZip);
    const m = zipName.match(/instagram-([^\-]+)-/i);
    const defaultUser = m ? m[1] : 'user';

    const contentDir = path.join(tmpBase, 'your_instagram_activity', 'content');
    const categoriesBase = ['posts', 'stories', 'reels'];
    for (const key of categoriesBase) {
      let jsonPath = await pickJsonPath(contentDir, key);
      if (!jsonPath) jsonPath = await findJsonAnywhere(tmpBase, key);
      if (!jsonPath) { try { ctx.strapi.log.info(`[ig-import] json not found for ${key}`); } catch {} continue; }
      try { ctx.strapi.log.info(`[ig-import] using json for ${key}: ${jsonPath}`); } catch {}
      await processCategory(strapi, { key, json: jsonPath, folderName: key.charAt(0).toUpperCase() + key.slice(1) }, defaultUser);
    }
    ctx.body = { ok: true };
  },
};
