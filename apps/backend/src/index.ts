// import type { Core } from '@strapi/strapi';

import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);

type Extracted = {
  subject?: string;
  description?: string;
  comment?: string;
};

function extractXmpFromXml(xml: string): Extracted {
  const out: Extracted = {};
  try {
    // dc:description: prefer rdf:Alt/rdf:li, fallback to direct text
    let m = xml.match(/<dc:description\b[^>]*>([\s\S]*?)<\/dc:description>/i);
    if (m && m[1]) {
      const inner = m[1];
      const li = inner.match(/<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/i);
      const raw = li && li[1] ? li[1] : stripTags(inner);
      if (raw) out.description = decodeXmlEntities(raw.trim());
    }

    // dc:subject: may be rdf:Bag or rdf:Seq of rdf:li, or direct text
    m = xml.match(/<dc:subject\b[^>]*>([\s\S]*?)<\/dc:subject>/i);
    if (m && m[1]) {
      const inner = m[1];
      const items = Array.from(inner.matchAll(/<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/gi)).map((mm) => decodeXmlEntities(mm[1].trim()));
      if (items.length) out.subject = items.join(', ');
      else {
        const raw = stripTags(inner);
        if (raw) out.subject = decodeXmlEntities(raw.trim());
      }
    }
    const cmtMatch = xml.match(/<xmp:Comment>([\s\S]*?)<\/xmp:Comment>/i);
    if (cmtMatch && cmtMatch[1]) out.comment = decodeXmlEntities(cmtMatch[1].trim());
  } catch {}
  return out;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '');
}

function extractXmpFromBuffer(buf: Buffer): Extracted {
  try {
    const text = buf.toString('utf8');
    const startIdx = text.indexOf('<x:xmpmeta');
    if (startIdx !== -1) {
      const endIdx = text.indexOf('</x:xmpmeta>');
      if (endIdx !== -1) {
        const xml = text.slice(startIdx, endIdx + '</x:xmpmeta>'.length);
        return extractXmpFromXml(xml);
      }
    }
    // Fallback: attempt to parse XMP tags directly from given text
    return extractXmpFromXml(text);
  } catch {
    return {};
  }
}

function extractXmpFromWebp(buf: Buffer): Extracted {
  try {
    if (buf.length < 12) return {};
    if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return {};
    let p = 12;
    const len = buf.length;
    while (p + 8 <= len) {
      const type = buf.toString('ascii', p, p + 4);
      const size = buf.readUInt32LE(p + 4);
      const dataStart = p + 8;
      const dataEnd = Math.min(dataStart + size, len);
      if (type === 'XMP ') {
        const xml = buf.slice(dataStart, dataEnd).toString('utf8');
        // Reuse XMP parser by passing only the chunk text
        return extractXmpFromBuffer(Buffer.from(xml, 'utf8'));
      }
      p = dataStart + size + (size % 2);
    }
  } catch {}
  return {};
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function mapFieldsByMime(extracted: Extracted, mime: string): { caption?: string; alternativeText?: string } {
  const lower = (mime || '').toLowerCase();
  if (lower.includes('image/jpeg') || lower.includes('image/jpg') || lower.includes('jpeg') || lower.includes('jpg') || lower.includes('webp')) {
    return {
      caption: extracted.subject,
      alternativeText: extracted.description,
    };
  }
  if (lower.includes('video/mp4')) {
    return {
      caption: extracted.comment,
      alternativeText: extracted.description,
    };
  }
  return {};
}

function extractExifFromWebp(buf: Buffer): Extracted {
  // Parse RIFF WEBP container and look for 'EXIF' chunk; parse TIFF for ImageDescription (0x010E) and XPSubject (0x9C9F)
  try {
    if (buf.length < 12) return {};
    if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return {};
    let p = 12;
    const len = buf.length;
    while (p + 8 <= len) {
      const type = buf.toString('ascii', p, p + 4);
      const size = buf.readUInt32LE(p + 4);
      const dataStart = p + 8;
      const dataEnd = Math.min(dataStart + size, len);
      if (type === 'EXIF') {
        const ex = parseTiff(buf.slice(dataStart, dataEnd));
        return ex;
      }
      p = dataStart + size + (size % 2); // chunks are padded to even
    }
  } catch {}
  return {};
}

function parseTiff(data: Buffer): Extracted {
  const out: Extracted = {};
  if (data.length < 8) return out;
  const endian = data.toString('ascii', 0, 2);
  const le = endian === 'II';
  const rd16 = (o: number) => le ? data.readUInt16LE(o) : data.readUInt16BE(o);
  const rd32 = (o: number) => le ? data.readUInt32LE(o) : data.readUInt32BE(o);
  if (rd16(2) !== 0x2a) return out;
  const ifd0 = rd32(4);
  const parseIfd = (off: number) => {
    if (off + 2 > data.length) return;
    const count = rd16(off);
    let p = off + 2;
    for (let i = 0; i < count; i++) {
      const base = p + i * 12;
      if (base + 12 > data.length) break;
      const tag = rd16(base);
      const type = rd16(base + 2);
      const num = rd32(base + 4);
      const valOff = base + 8;
      let valueBuf: Buffer;
      const typeSize = type === 1 || type === 2 || type === 6 || type === 7 ? 1 : (type === 3 ? 2 : (type === 4 || type === 9 ? 4 : 8));
      const valueBytes = num * typeSize;
      if (valueBytes <= 4) {
        valueBuf = data.slice(valOff, valOff + Math.min(4, valueBytes));
      } else {
        const off = rd32(valOff);
        if (off + valueBytes > data.length) continue;
        valueBuf = data.slice(off, off + valueBytes);
      }
      if (tag === 0x010E) { // ImageDescription
        const text = decodeExifString(valueBuf).replace(/\0+$/g, '').trim();
        if (text) out.description = text;
      } else if (tag === 0x9C9F) { // XPSubject (UTF-16LE)
        try {
          const u16 = new Uint16Array(valueBuf.buffer, valueBuf.byteOffset, Math.floor(valueBuf.length / 2));
          let s = '';
          for (let k = 0; k < u16.length; k++) { const ch = u16[k]; if (ch === 0) break; s += String.fromCharCode(ch); }
          if (s) out.subject = s;
        } catch {}
      }
    }
  };
  parseIfd(ifd0);
  return out;
}

function decodeExifString(buf: Buffer): string {
  try {
    const utf = buf.toString('utf8');
    // If the decoded string contains many replacement characters or mojibake sequences, fallback
    const hasBad = /\uFFFD/.test(utf) || /Ã./.test(utf) || /Â./.test(utf);
    if (hasBad) {
      return buf.toString('latin1');
    }
    return utf;
  } catch {
    return buf.toString('latin1');
  }
}

async function extractViaFfprobe(absPath: string): Promise<Extracted> {
  try {
    const { stdout } = await execFileAsync('ffprobe', ['-v', 'quiet', '-print_format', 'json', '-show_format', absPath], { timeout: 8000 });
    const json = JSON.parse(stdout || '{}');
    const tags = (json && json.format && json.format.tags) || {};
    const out: Extracted = {};
    if (typeof (tags as any).comment === 'string' && (tags as any).comment.trim()) out.comment = (tags as any).comment.trim();
    if (typeof (tags as any).description === 'string' && (tags as any).description.trim()) out.description = (tags as any).description.trim();
    if (!out.comment && typeof (tags as any).title === 'string' && (tags as any).title.trim()) out.comment = (tags as any).title.trim();
    return out;
  } catch {
    return {};
  }
}

function extractFromJpegIptc(buf: Buffer): Extracted {
  // Look for APP13 (0xFFED) Photoshop IRB and parse IPTC (resource 0x0404)
  try {
    if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return {};
    let p = 2;
    const len = buf.length;
    while (p + 4 <= len) {
      if (buf[p] !== 0xff) break;
      const marker = buf[p + 1];
      p += 2;
      if (marker === 0xda /* SOS */) break;
      if (p + 2 > len) break;
      const segLen = buf.readUInt16BE(p);
      p += 2;
      const segStart = p;
      const segEnd = Math.min(p + segLen - 2, len);
      if (marker === 0xed /* APP13 */) {
        // Check Photoshop header
        const header = Buffer.from('Photoshop 3.0\x00', 'latin1');
        if (segEnd - segStart >= header.length && buf.slice(segStart, segStart + header.length).equals(header)) {
          let q = segStart + header.length;
          while (q + 12 <= segEnd) {
            if (!buf.slice(q, q + 4).equals(Buffer.from('8BIM', 'ascii'))) break;
            q += 4;
            if (q + 2 > segEnd) break;
            const resId = buf.readUInt16BE(q); q += 2;
            if (q >= segEnd) break;
            // Pascal string name, padded to even
            const nameLen = buf[q]; q += 1;
            q += nameLen;
            if ((1 + nameLen) % 2 === 1) q += 1;
            if (q + 4 > segEnd) break;
            const size = buf.readUInt32BE(q); q += 4;
            if (q + size > segEnd) break;
            const dataBlock = buf.slice(q, q + size);
            q += size;
            if (q % 2 === 1) q += 1;
            if (resId === 0x0404) {
              const iptc = parseIptcData(dataBlock);
              if (iptc.subject || iptc.description || iptc.comment) return iptc;
            }
          }
        }
      }
      p = segEnd;
    }
  } catch {}
  return {};
}

function parseIptcData(data: Buffer): Extracted {
  const out: Extracted = {};
  let p = 0;
  const len = data.length;
  while (p + 5 <= len) {
    if (data[p] !== 0x1c) { p++; continue; }
    const record = data[p + 1];
    const dataset = data[p + 2];
    p += 3;
    if (p + 2 > len) break;
    let size = data.readUInt16BE(p); p += 2;
    if ((size & 0x8000) !== 0) {
      if (p + 4 > len) break;
      size = data.readUInt32BE(p); p += 4;
    }
    if (p + size > len) break;
    const value = data.slice(p, p + size); p += size;
    if (record === 2) {
      if (dataset === 5) {
        out.subject = decodeBufferMaybeLatin1(value);
      } else if (dataset === 120) {
        out.description = decodeBufferMaybeLatin1(value);
      } else if (dataset === 116) { // Copyright Notice sometimes used for comments
        out.comment = decodeBufferMaybeLatin1(value);
      }
    }
  }
  return out;
}

function decodeBufferMaybeLatin1(buf: Buffer): string {
  const utf = buf.toString('utf8');
  // If many replacement chars appear, fallback to latin1
  const bad = (utf.match(/\uFFFD/g) || []).length;
  if (bad > 2) return buf.toString('latin1');
  return utf;
}

function extractFromMp4(buf: Buffer): Extracted {
  const out: Extracted = {};
  try {
    const len = buf.length;
    function readUInt32BE(off: number) {
      if (off + 4 > len) return 0;
      return buf.readUInt32BE(off);
    }
    function readType(off: number) {
      if (off + 4 > len) return '';
      return buf.slice(off, off + 4).toString('latin1');
    }
    function walk(start: number, end: number) {
      let p = start;
      while (p + 8 <= end) {
        let size = readUInt32BE(p);
        const type = readType(p + 4);
        if (!size) break;
        let header = 8;
        if (size === 1) { // 64-bit size
          if (p + 16 > end) break;
          const high = buf.readUInt32BE(p + 8);
          const low = buf.readUInt32BE(p + 12);
          size = high * 4294967296 + low;
          header = 16;
        }
        const boxStart = p + header;
        const boxEnd = Math.min(p + size, end);
        if (boxEnd <= boxStart) break;

        if (type === 'meta') {
          // meta starts with 4 bytes version/flags
          const innerStart = Math.min(boxStart + 4, boxEnd);
          walk(innerStart, boxEnd);
        } else if (type === 'moov' || type === 'udta' || type === 'ilst') {
          walk(boxStart, boxEnd);
        } else if (type === '©cmt' || type === 'desc') {
          // Look for 'data' child boxes carrying the string
          let q = boxStart;
          while (q + 8 <= boxEnd) {
            const dSize = readUInt32BE(q);
            const dType = readType(q + 4);
            if (!dSize) break;
            const dStart = q + 8;
            const dEnd = Math.min(q + dSize, boxEnd);
            if (dType === 'data') {
              let payloadStart = dStart + 8; // skip ver/flags + type
              if (dStart + 12 <= dEnd && buf.readUInt32BE(dStart + 8) === 0) {
                payloadStart = dStart + 16; // skip locale
              }
              const payload = buf.slice(payloadStart, dEnd);
              const text = payload.toString('utf8').replace(/\0+/g, '').trim();
              if (type === '©cmt' && text) out.comment = text;
              if (type === 'desc' && text) out.description = text;
            }
            q += dSize;
          }
        }
        p += size;
      }
    }
    walk(0, len);
  } catch {}
  return out;
}

export default {
  register() {
    try {
      // Ensure Sharp preserves metadata when Strapi processes images
      // Some environments strip EXIF/XMP on re-encode; this forces withMetadata()
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const sharpMod = require('sharp');
      const cacheEntry = require.cache && require.cache[require.resolve('sharp')];
      if (cacheEntry && !(sharpMod as any).__kajibiPatched) {
        const original = sharpMod;
        const patched = function patchedSharp(input?: any, options?: any) {
          const instance = original(input, options);
          try {
            if (instance && typeof instance.withMetadata === 'function') instance.withMetadata();
          } catch {}
          return instance;
        } as any;
        Object.assign(patched, original);
        (patched as any).__proto__ = original;
        (patched as any).__kajibiPatched = true;
        cacheEntry.exports = patched;
      }
    } catch {}
  },

  async bootstrap({ strapi }: any) {
    // Ensure Google Maps plugin has sensible defaults for Paris
    try {
      const cfgUid = 'plugin::google-maps.config';
      const existing = await strapi.entityService.findMany(cfgUid, { fields: ['id', 'defaultLatitude', 'defaultLongitude'] });
      if (!existing || !existing.id) {
        await strapi.db.query(cfgUid).create({ data: { defaultLatitude: '48.8566', defaultLongitude: '2.3522' } });
      } else {
        const dl = existing.defaultLatitude || '';
        const dln = existing.defaultLongitude || '';
        if (!dl || !dln) {
          await strapi.db.query(cfgUid).update({ where: { id: existing.id }, data: {
            defaultLatitude: dl || '48.8566',
            defaultLongitude: dln || '2.3522',
          } });
        }
      }
    } catch {}

    strapi.db.lifecycles.subscribe({
      models: ['plugin::upload.file'],
      async afterCreate(event: any) {
        try {
          const file = event.result;
          if (!file || !file.mime || !file.url) return;

          const needsCaption = !file.caption;
          const needsAlt = !file.alternativeText;
          // If ZIP archive detected, trigger Instagram importer in background
          const isZip = (file.mime || '').toLowerCase().includes('zip') || (file.ext || '').toLowerCase() === '.zip';
          if (isZip) {
            try {
              instagramImportFromZip(strapi, file).catch(() => {});
            } catch {}
          }
          if (!needsCaption && !needsAlt) return;

          const publicDir = (strapi.dirs && (strapi.dirs as any).public) || path.join(process.cwd(), 'public');
          const urlPath = typeof file.url === 'string' ? file.url : '';
          const absPath = path.join(publicDir, urlPath.startsWith('/') ? urlPath.slice(1) : urlPath);

          if (!fs.existsSync(absPath)) return;
          const buf = await fs.promises.readFile(absPath);

          let extracted: Extracted = {};
          const mime = (file.mime || '').toLowerCase();
          const isJpeg = mime.includes('jpeg') || mime.includes('jpg');
          const isWebp = mime.includes('webp');
          const isMp4 = mime.includes('mp4');

          if (isJpeg) {
            // Prefer IPTC when available; fallback to XMP
            const iptc = extractFromJpegIptc(buf);
            const xmp = extractXmpFromBuffer(buf);
            extracted = { ...xmp, ...iptc };
          } else if (isWebp) {
            const exif = extractExifFromWebp(buf);
            const xmp = extractXmpFromWebp(buf);
            extracted = { ...xmp, ...exif };
          } else if (isMp4) {
            const mp4 = extractFromMp4(buf);
            const probe = await extractViaFfprobe(absPath);
            const xmp = extractXmpFromBuffer(buf);
            extracted = { ...xmp, ...mp4, ...probe };
          } else {
            extracted = extractXmpFromBuffer(buf);
          }
          const mapped = mapFieldsByMime(extracted, file.mime);
          
          const data: any = {};
          if (needsCaption && mapped.caption) data.caption = mapped.caption;
          if (needsAlt && mapped.alternativeText) data.alternativeText = mapped.alternativeText;
          
          if (Object.keys(data).length) {
            await strapi.entityService.update('plugin::upload.file', file.id, { data });
            try { strapi.log.debug(`[media-meta] Set fields for ${file.name || file.hash} (${file.mime}): ${JSON.stringify(data)}`); } catch {}
          } else {
            try { strapi.log.debug(`[media-meta] No metadata mapped for ${file.name || file.hash} (${file.mime}). Extracted=${JSON.stringify(extracted)}`); } catch {}
          }
        } catch (err) {
          // Swallow errors to avoid interrupting uploads
        }
      },
    });
  },
};

async function instagramImportFromZip(strapi: any, file: any) {
  let tmpBase: string | null = null;
  try {
    const zipUrl = file.url as string;
    const publicDir = (strapi.dirs && (strapi.dirs as any).public) || path.join(process.cwd(), 'public');
    const absPath = path.join(publicDir, zipUrl.startsWith('/') ? zipUrl.slice(1) : zipUrl);
    const TMP_ROOT = process.env.IG_IMPORT_TMPDIR || '/tmp';
    tmpBase = path.join(TMP_ROOT, `igimport-${file.id}-${Date.now()}`);
    await fs.promises.mkdir(tmpBase, { recursive: true });
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execFileAsync = promisify(execFile);
    try {
      await execFileAsync('unzip', ['-qq', absPath, '-d', tmpBase], { timeout: 60000 });
    } catch (e) {
      try { strapi.log.error(`[media-meta] unzip failed for ${file.name}: ${(e as any)?.message}`); } catch {}
      return;
    }

    const zipName = path.basename(file.name || file.hash || '');
    const m = zipName.match(/instagram-([^\-]+)-/i);
    const defaultUser = m ? m[1] : 'user';

    const contentDir = path.join(tmpBase, 'your_instagram_activity', 'content');
    const keys = ['posts', 'stories', 'reels'];
    for (const key of keys) {
      const candidates = [`${key}.json`, `${key}_1.json`, `${key}_2.json`];
      let jsonPath: string | null = null;
      for (const name of candidates) {
        const p = path.join(contentDir, name);
        try { await fs.promises.access(p, fs.constants.R_OK); jsonPath = p; break; } catch {}
      }
      if (!jsonPath) { try { strapi.log.debug(`[ig-import] json not found for ${key}`); } catch {} continue; }
      await processCategory(strapi, { key, json: jsonPath, folderName: key.charAt(0).toUpperCase() + key.slice(1) }, defaultUser);
    }
  } catch {
    // ignore
  } finally {
    if (tmpBase) {
      try { await fs.promises.rm(tmpBase, { recursive: true, force: true }); } catch {}
    }
  }
}

function extractMentions(title: string | undefined): string[] {
  if (!title) return [];
  const out = new Set<string>();
  const re = /@([A-Za-z0-9_](?:[A-Za-z0-9_.]*[A-Za-z0-9_])?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(title))) {
    out.add('@' + (m[1] || ''));
  }
  return Array.from(out);
}

async function ensureFolder(strapi: any, name: string) {
  const existing = await strapi.entityService.findMany('plugin::upload.folder', {
    filters: { name: { $eqi: name } },
    fields: ['id', 'path', 'pathId', 'name'],
    limit: 1,
  });
  if (existing && existing[0]) return existing[0];
  const folderSvc = strapi?.plugin?.('upload')?.service?.('folder');
  if (folderSvc && typeof folderSvc.create === 'function') {
    const created = await folderSvc.create({ name, parent: null });
    const full = await strapi.entityService.findOne('plugin::upload.folder', created.id, {
      fields: ['id', 'path', 'pathId', 'name'],
    });
    return full || created;
  }
  return undefined;
}

async function processCategory(strapi: any, cat: any, usernameFromZip: string) {
  try {
    const folder = await ensureFolder(strapi, cat.folderName);
    let raw: any;
    try {
      const buf = await fs.promises.readFile(cat.json);
      const text = buf.toString('utf8');
      raw = JSON.parse(text);
    } catch {
      return;
    }
    const firstArray = (arr: any): any[] => (Array.isArray(arr) ? arr : []);
    const itemsCandidate = Array.isArray(raw)
      ? raw
      : (raw && typeof raw === 'object'
          ? (Object.values(raw).find((v) => Array.isArray(v)) as any[] | undefined)
          : undefined);
    const items: any[] = firstArray(itemsCandidate).slice().sort((a, b) => (a?.creation_timestamp || 0) - (b?.creation_timestamp || 0));
    if (!items.length) return;
    try { strapi.log.debug(`[ig-import] processing ${items.length} items for ${cat.folderName}`); } catch {}
    for (const item of items) {
      if (!item) continue;
      const rel: any = (item as any).uri || (item as any).path || (item as any)?.media?.[0]?.uri || (item as any)?.attachments?.[0]?.data?.uri;
      const ts: any = (item as any).creation_timestamp || (item as any).taken_at || (item as any)?.media?.[0]?.creation_timestamp;
      const title: any = (item as any).title || (item as any).caption || (item as any)?.media?.[0]?.title || (item as any)?.string_map_data?.Caption?.value || '';
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
      const candidatesForFile = [
        path.join(tmpBase, relNorm),
        path.join(tmpBase, 'your_instagram_activity', relNorm),
      ].map((p) => path.normalize(p));
      let srcPath: string | null = null;
      for (const c of candidatesForFile) { try { await fs.promises.access(c, fs.constants.R_OK); srcPath = c; break; } catch {} }
      if (!srcPath) { try { strapi.log.debug(`[ig-import] media not found for rel=${relNorm}`); } catch {} continue; }
      const ext = path.extname(srcPath).toLowerCase();
      const isImage = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);
      const isVideo = ['.mp4', '.mov'].includes(ext);
      const baseName = `${usernameFromZip}_${dateStr}`;
      let targetExt = ext;
      let targetName = `${baseName}${targetExt}`;

      // Dedup by name
      const exists = await strapi.entityService.findMany('plugin::upload.file', { filters: { name: targetName }, limit: 1 });
      if (exists && exists[0]) continue;

      let tmpOut = srcPath;
      // Keep original files to preserve extension/mime

      // Upload via upload service
      try {
        const uploadSvc = strapi.plugin('upload').service('upload');
        const stat = await fs.promises.stat(tmpOut);
        const mime = (require('mime-types').lookup(srcPath) || (isVideo ? 'video/mp4' : 'image/jpeg')) as string;
        const files = {
          path: tmpOut,
          filepath: tmpOut,
          tmpPath: tmpOut,
          name: targetName,
          type: mime,
          mime,
          ext: targetExt,
          size: stat.size,
          stream: fs.createReadStream(tmpOut),
        };
        const data = {
          fileInfo: {
            name: targetName,
            alternativeText: title || undefined,
            caption: mentions.join(' '),
          },
        } as any;
        const args: any = {
          data: { ...data, folder: (folder as any)?.id },
          files: [files],
        };
        try { strapi.log.debug(`[ig-import] svc upload to folderId=${(folder as any)?.id || 'root'}`); } catch {}
        const created = await uploadSvc.upload(args);
        const createdFile = Array.isArray(created) ? created[0] : created;
        try { await strapi.entityService.update('plugin::upload.file', createdFile.id, { data: { mime, ext: targetExt } }); } catch {}
        try {
          if ((folder as any)?.id) {
            await strapi.db.query('plugin::upload.file').update({ where: { id: createdFile.id }, data: { folder: (folder as any).id, folderPath: (folder as any).path || '/' } });
          }
        } catch {}
        try { strapi.log.debug(`[ig-import] uploaded file id=${createdFile?.id} name=${createdFile?.name}`); } catch {}
        // Upsert article per @username mentions
        const usernames = mentions.length ? mentions.map((m) => m) : [`@${usernameFromZip}`];
        for (const mention of usernames) {
          const uname = mention.startsWith('@') ? mention : `@${mention}`;
          const found = await strapi.entityService.findMany('api::article.article', { filters: { username: uname }, limit: 1 });
          const baseNameOnly = targetName.replace(/\.[^.]+$/, '');
          const truncate = (s: string, max: number) => {
            const arr = [...(s || '')];
            return arr.length > max ? arr.slice(0, max).join('') : s;
          };
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
                },
              });
            } catch (e) {
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
          try { await strapi.entityService.update('api::article.article', article.id, { data: { media: { connect: [createdFile.id] } } }); } catch {}
          try { await strapi.entityService.update('api::article.article', article.id, { data: { cover: createdFile?.id ? { connect: [createdFile.id] } : undefined } }); } catch {}
          // Update visit dates
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
  } catch {}
}
