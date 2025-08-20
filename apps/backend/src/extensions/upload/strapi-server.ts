export default (plugin: any) => {
  try {
    try {
      const ctrlKeys = plugin.controllers ? Object.keys(plugin.controllers) : [];
      const svcKeys = plugin.services ? Object.keys(plugin.services) : [];
      strapi.log.debug(`[media-meta] Initializing upload plugin extension; controllers=${JSON.stringify(ctrlKeys)} services=${JSON.stringify(svcKeys)}`);
    } catch {}
    const svc = plugin.services?.['image-manipulation'];
    if (svc && typeof svc.getSharpInstance === 'function') {
      const orig = svc.getSharpInstance.bind(svc);
      svc.getSharpInstance = (...args: any[]) => {
        const inst = orig(...args);
        try {
          if (inst && typeof inst.withMetadata === 'function') return inst.withMetadata();
        } catch {}
        return inst;
      };
      try { strapi.log.debug('[media-meta] Patched image-manipulation.getSharpInstance with withMetadata()'); } catch {}
    }

    // Also patch common helpers if present
    if (svc && typeof svc.convertToFormat === 'function') {
      const origConv = svc.convertToFormat.bind(svc);
      svc.convertToFormat = async (...args: any[]) => {
        const result = await origConv(...args);
        try {
          if (result && result.pipeline && typeof result.pipeline.withMetadata === 'function') {
            result.pipeline.withMetadata();
          }
        } catch {}
        return result;
      };
    }
  } catch {}

  try {
    const fs = require('fs');
    const path = require('path');
    const { execFile } = require('child_process');
    const { promisify } = require('util');
    const execFileAsync = promisify(execFile);

    const extractors = (() => {
      function decodeXmlEntities(s: string): string {
        return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
      }
      function stripTags(s: string): string { return s.replace(/<[^>]+>/g, ''); }
      function extractXmpFromXml(xml: string) {
        const out: any = {};
        try {
          let m = xml.match(/<dc:description\b[^>]*>([\s\S]*?)<\/dc:description>/i);
          if (m && m[1]) {
            const inner = m[1];
            const li = inner.match(/<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/i);
            const raw = li && li[1] ? li[1] : stripTags(inner);
            if (raw) out.description = decodeXmlEntities(raw.trim());
          }
          m = xml.match(/<dc:subject\b[^>]*>([\s\S]*?)<\/dc:subject>/i);
          if (m && m[1]) {
            const inner = m[1];
            const items = Array.from(inner.matchAll(/<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/gi)).map((mm: any) => decodeXmlEntities(mm[1].trim()));
            if (items.length) out.subject = items.join(', ');
            else {
              const raw = stripTags(inner);
              if (raw) out.subject = decodeXmlEntities(raw.trim());
            }
          }
          const cmt = xml.match(/<xmp:Comment>([\s\S]*?)<\/xmp:Comment>/i);
          if (cmt && cmt[1]) out.comment = decodeXmlEntities(cmt[1].trim());
        } catch {}
        return out;
      }
      function extractXmpFromBuffer(buf: Buffer) {
        try {
          let text = buf.toString('utf8');
          if (/\uFFFD/.test(text) || /\x00[<a-zA-Z]/.test(text)) {
            try { text = buf.toString('utf16le'); } catch {}
          }
          const start = text.indexOf('<x:xmpmeta');
          if (start !== -1) {
            const end = text.indexOf('</x:xmpmeta>');
            if (end !== -1) {
              const xml = text.slice(start, end + '</x:xmpmeta>'.length);
              return extractXmpFromXml(xml);
            }
          }
          return extractXmpFromXml(text);
        } catch { return {}; }
      }
      function extractXmpFromWebp(buf: Buffer) {
        try {
          if (buf.length < 12) return {};
          if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return {};
          let p = 12;
          while (p + 8 <= buf.length) {
            const type = buf.toString('ascii', p, p + 4);
            const size = buf.readUInt32LE(p + 4);
            const dataStart = p + 8;
            const dataEnd = Math.min(dataStart + size, buf.length);
            if (type === 'XMP ') {
              const raw = buf.slice(dataStart, dataEnd);
              let xml: string;
              try {
                xml = raw.toString('utf8');
                if (/\uFFFD/.test(xml) || /\x00[<a-zA-Z]/.test(xml)) {
                  // fallback: try UTF-16LE if lots of nulls
                  xml = raw.toString('utf16le');
                }
              } catch { xml = raw.toString('utf16le'); }
              return extractXmpFromXml(xml);
            }
            p = dataStart + size + (size % 2);
          }
        } catch {}
        return {};
      }
      function listWebpChunks(buf: Buffer) {
        const out: Array<{type: string; size: number}> = [];
        try {
          if (buf.length < 12) return out;
          if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return out;
          let p = 12;
          while (p + 8 <= buf.length) {
            const type = buf.toString('ascii', p, p + 4);
            const size = buf.readUInt32LE(p + 4);
            out.push({ type, size });
            const dataStart = p + 8;
            p = dataStart + size + (size % 2);
          }
        } catch {}
        return out;
      }
      function extractFromJpegIptc(buf: Buffer) {
        try {
          if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return {};
          let p = 2;
          const header = Buffer.from('Photoshop 3.0\x00', 'latin1');
          const eight = Buffer.from('8BIM', 'ascii');
          while (p + 4 <= buf.length) {
            if (buf[p] !== 0xff) break; const marker = buf[p + 1]; p += 2;
            if (marker === 0xda) break; if (p + 2 > buf.length) break;
            const segLen = buf.readUInt16BE(p); p += 2;
            const segStart = p; const segEnd = Math.min(p + segLen - 2, buf.length);
            if (marker === 0xed) {
              if (segEnd - segStart >= header.length && buf.slice(segStart, segStart + header.length).equals(header)) {
                let q = segStart + header.length;
                while (q + 12 <= segEnd) {
                  if (!buf.slice(q, q + 4).equals(eight)) break; q += 4;
                  if (q + 2 > segEnd) break; const resId = buf.readUInt16BE(q); q += 2;
                  if (q >= segEnd) break; const nameLen = buf[q]; q += 1; q += nameLen; if ((1 + nameLen) % 2 === 1) q += 1;
                  if (q + 4 > segEnd) break; const size = buf.readUInt32BE(q); q += 4;
                  if (q + size > segEnd) break; const block = buf.slice(q, q + size); q += size; if (q % 2 === 1) q += 1;
                  if (resId === 0x0404) {
                    const iptc = parseIptc(block);
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
      function parseIptc(data: Buffer) {
        const out: any = {};
        let p = 0;
        while (p + 5 <= data.length) {
          if (data[p] !== 0x1c) { p++; continue; }
          const record = data[p + 1]; const dataset = data[p + 2]; p += 3;
          if (p + 2 > data.length) break; let size = data.readUInt16BE(p); p += 2;
          if ((size & 0x8000) !== 0) { if (p + 4 > data.length) break; size = data.readUInt32BE(p); p += 4; }
          if (p + size > data.length) break; const value = data.slice(p, p + size); p += size;
          if (record === 2) {
            if (dataset === 5) out.subject = decodeMaybeLatin1(value);
            else if (dataset === 120) out.description = decodeMaybeLatin1(value);
            else if (dataset === 116) out.comment = decodeMaybeLatin1(value);
          }
        }
        return out;
      }
      function decodeMaybeLatin1(buf2: Buffer) {
        const utf = buf2.toString('utf8');
        const bad = (utf.match(/\uFFFD/g) || []).length || /Ã.|Â./.test(utf);
        if (bad) return buf2.toString('latin1');
        return utf;
      }
      function extractFromMp4(buf: Buffer) {
        const out: any = {};
        try {
          const len = buf.length;
          function rd32(o: number) { return buf.readUInt32BE(o); }
          function type(o: number) { return buf.slice(o, o + 4).toString('latin1'); }
          function walk(start: number, end: number) {
            let p = start;
            while (p + 8 <= end) {
              let size = rd32(p); const t = type(p + 4); if (!size) break; let header = 8;
              if (size === 1) { if (p + 16 > end) break; const high = rd32(p + 8); const low = rd32(p + 12); size = high * 4294967296 + low; header = 16; }
              const s = p + header; const e = Math.min(p + size, end); if (e <= s) break;
              if (t === 'meta') { walk(Math.min(s + 4, e), e); }
              else if (t === 'moov' || t === 'udta' || t === 'ilst') { walk(s, e); }
              else if (t === '©cmt' || t === 'desc') {
                let q = s; while (q + 8 <= e) { const ds = rd32(q); const dt = type(q + 4); if (!ds) break; const ds1 = q + 8; const de = Math.min(q + ds, e);
                  if (dt === 'data') { let payload = ds1 + 8; if (ds1 + 12 <= de && rd32(ds1 + 8) === 0) payload = ds1 + 16; const txt = buf.slice(payload, de).toString('utf8').replace(/\0+/g, '').trim(); if (t === '©cmt' && txt) out.comment = txt; if (t === 'desc' && txt) out.description = txt; }
                  q += ds; }
              }
              p += size;
            }
          }
          walk(0, len);
        } catch {}
        return out;
      }
      function extractExifFromWebp(buf: Buffer) {
        try {
          if (buf.length < 12) return {};
          if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return {};
          let p = 12;
          while (p + 8 <= buf.length) {
            const type = buf.toString('ascii', p, p + 4);
            const size = buf.readUInt32LE(p + 4);
            const dataStart = p + 8; const dataEnd = Math.min(dataStart + size, buf.length);
            if (type === 'EXIF') { return parseTiff(buf.slice(dataStart, dataEnd)); }
            p = dataStart + size + (size % 2);
          }
        } catch {}
        return {};
      }
      function parseTiff(data: Buffer) {
        const out: any = {};
        if (data.length < 8) return out; const endian = data.toString('ascii', 0, 2); const le = endian === 'II';
        const rd16 = (o: number) => le ? data.readUInt16LE(o) : data.readUInt16BE(o);
        const rd32 = (o: number) => le ? data.readUInt32LE(o) : data.readUInt32BE(o);
        if (rd16(2) !== 0x2a) return out; const ifd0 = rd32(4);
        const parseIfd = (off: number) => {
          if (off + 2 > data.length) return; const count = rd16(off); let p = off + 2;
          for (let i = 0; i < count; i++) {
            const base = p + i * 12; if (base + 12 > data.length) break; const tag = rd16(base); const type = rd16(base + 2); const num = rd32(base + 4); const valOff = base + 8;
            let valueBuf: Buffer; const typeSize = (type === 1 || type === 2 || type === 6 || type === 7) ? 1 : (type === 3 ? 2 : ((type === 4 || type === 9) ? 4 : 8)); const valueBytes = num * typeSize;
            if (valueBytes <= 4) { valueBuf = data.slice(valOff, valOff + Math.min(4, valueBytes)); } else { const off2 = rd32(valOff); if (off2 + valueBytes > data.length) continue; valueBuf = data.slice(off2, off2 + valueBytes); }
            if (tag === 0x010E) { const text = decodeExifString(valueBuf).replace(/\0+$/g, '').trim(); if (text) out.description = text; }
            else if (tag === 0x9C9F) { try { const u16 = new Uint16Array(valueBuf.buffer, valueBuf.byteOffset, Math.floor(valueBuf.length / 2)); let s = ''; for (let k = 0; k < u16.length; k++) { const ch = u16[k]; if (ch === 0) break; s += String.fromCharCode(ch); } if (s) out.subject = s; } catch {} }
          }
        };
        parseIfd(ifd0); return out;
      }
      function decodeExifString(buf2: Buffer) {
        try {
          const utf = buf2.toString('utf8');
          if (/\uFFFD/.test(utf) || /Ã.|Â./.test(utf)) return buf2.toString('latin1');
          return utf;
        } catch { return buf2.toString('latin1'); }
      }
      function mapFieldsByMime(ex: any, mime: string) {
        const lower = (mime || '').toLowerCase();
        if (lower.includes('mp4')) return { caption: ex.comment, alternativeText: ex.description };
        if (lower.includes('webp') || lower.includes('jpeg') || lower.includes('jpg')) return { caption: ex.subject, alternativeText: ex.description };
        return {};
      }
      return { extractXmpFromBuffer, extractXmpFromWebp, extractFromJpegIptc, extractExifFromWebp, extractFromMp4, mapFieldsByMime, listWebpChunks };
    })();

    // Wrap upload service to inject caption/alt on files before creation
    if (plugin.services?.upload?.upload) {
      try { strapi.log.debug('[media-meta] Wrapping services.upload.upload for pre-extraction'); } catch {}
      const origSvcUpload = plugin.services.upload.upload.bind(plugin.services.upload);
      plugin.services.upload.upload = async (...args: any[]) => {
        try { strapi.log.debug('[media-meta] services.upload.upload called'); } catch {}
        let files: any[] = [];
        let data: any = {};
        if (args.length === 1 && args[0] && typeof args[0] === 'object' && (args[0].files || args[0].data)) {
          files = Array.isArray(args[0].files) ? args[0].files : [args[0].files].filter(Boolean);
          data = args[0].data || {};
        } else if (args.length >= 2) {
          files = Array.isArray(args[0]) ? args[0] : [args[0]].filter(Boolean);
          data = args[1] || {};
        }
        try { strapi.log.debug(`[media-meta] Found ${files.length} incoming file(s) in service`); } catch {}
        const processOne = async (f: any) => {
          try {
            const tmpPath = (f.filepath || f.path || f.tempFilePath || (f.files && f.files.path));
            let mime = (f.mimetype || f.type || '').toLowerCase();
            const name = (f.originalFilename || f.name || (tmpPath && path.basename(tmpPath)) || '').toLowerCase();
            if (!mime) {
              if (name.endsWith('.webp')) mime = 'image/webp';
              else if (name.endsWith('.jpeg') || name.endsWith('.jpg')) mime = 'image/jpeg';
              else if (name.endsWith('.mp4')) mime = 'video/mp4';
            }
            if (!tmpPath || !fs.existsSync(tmpPath)) { try { strapi.log.debug(`[media-meta] Skip file (no tmp path): ${name}`); } catch {}; return; }
            const buf = await fs.promises.readFile(tmpPath);
            let extracted: any = {};
            if (mime.includes('jpeg') || mime.includes('jpg')) {
              const iptc = extractors.extractFromJpegIptc(buf); const xmp = extractors.extractXmpFromBuffer(buf); extracted = { ...xmp, ...iptc };
            } else if (mime.includes('webp')) {
              const chunks = extractors.listWebpChunks(buf);
              try { strapi.log.debug(`[media-meta] [svc] WEBP chunks: ${JSON.stringify(chunks.map((c:any)=>c.type))}`); } catch {}
              const exif = extractors.extractExifFromWebp(buf);
              const xmp = extractors.extractXmpFromWebp(buf);
              let scan: any = {};
              if ((!xmp || (!xmp.subject && !xmp.description)) && (!exif || (!exif.subject && !exif.description))) {
                scan = extractors.extractXmpFromBuffer(buf);
              }
              extracted = { ...scan, ...xmp, ...exif };
              if ((!extracted.subject && !extracted.description)) {
                try {
                  const { stdout } = await execFileAsync('exiftool', ['-j','-XMP-dc:Subject','-XMP-dc:Description','-EXIF:ImageDescription','-XPSubject', tmpPath], { timeout: 6000 });
                  const arr = JSON.parse(stdout || '[]');
                  if (Array.isArray(arr) && arr[0]) {
                    const meta = arr[0];
                    const subj = meta['XMP-dc:Subject'] || meta['Subject'] || meta['XPSubject'];
                    const desc = meta['XMP-dc:Description'] || meta['Description'] || meta['EXIF:ImageDescription'] || meta['ImageDescription'];
                    if (Array.isArray(subj)) extracted.subject = subj.join(', ');
                    else if (typeof subj === 'string') extracted.subject = subj;
                    if (typeof desc === 'string') extracted.description = desc;
                    try { strapi.log.debug(`[media-meta] [svc] exiftool WEBP subj=${JSON.stringify(subj)} desc=${JSON.stringify(desc)}`); } catch {}
                  }
                } catch (e:any) {
                  try { strapi.log.debug(`[media-meta] [svc] exiftool failed: ${e?.message}`); } catch {}
                }
              }
            } else if (mime.includes('mp4')) {
              const mp4 = extractors.extractFromMp4(buf); extracted = { ...mp4 };
            } else {
              extracted = extractors.extractXmpFromBuffer(buf);
            }
            const mapped = extractors.mapFieldsByMime(extracted, mime);
            try { strapi.log.debug(`[media-meta] Pre-map ${name} (${mime}) => ${JSON.stringify(mapped)} from ${JSON.stringify(extracted)}`); } catch {}
            if (mapped.caption && !f.caption) f.caption = mapped.caption;
            if (mapped.alternativeText && !f.alternativeText) f.alternativeText = mapped.alternativeText;
          } catch {}
        };

        for (const f of files) await processOne(f);

        const res = await origSvcUpload(...args);
        try { strapi.log.debug('[media-meta] services.upload.upload finished'); } catch {}
        return res;
      };
    }

    // Generic controller wrapping to pre-extract and post-patch for any upload-related entry point
    const wrapController = (ctrlName: string, actionName: string) => {
      const ctrl = plugin.controllers?.[ctrlName];
      if (!ctrl || typeof ctrl[actionName] !== 'function') return false;
      const original = ctrl[actionName];
      ctrl[actionName] = async (ctx: any, next?: any) => {
        try { strapi.log.debug(`[media-meta] controller ${ctrlName}.${actionName} called`); } catch {}
        // Pre-extract from incoming files
        const filesObj = (ctx?.request && ctx.request.files) || {};
        const list: any[] = [];
        const push = (f: any) => { if (f) list.push(f); };
        if (Array.isArray(filesObj)) list.push(...filesObj);
        else if (filesObj.files) { Array.isArray(filesObj.files) ? list.push(...filesObj.files) : push(filesObj.files); }
        else if (filesObj.file) { Array.isArray(filesObj.file) ? list.push(...filesObj.file) : push(filesObj.file); }
        else if (typeof filesObj === 'object') { Object.values(filesObj).forEach((v: any) => { Array.isArray(v) ? list.push(...v) : push(v as any); }); }
        const premap: Array<{ name: string; mapped: any }> = [];
        for (const f of list) {
          try {
            const tmpPath = (f?.filepath || f?.path || f?.tempFilePath || (f?.files && f.files.path));
            let mime = (f?.mimetype || f?.type || '').toLowerCase();
            const name = (f?.originalFilename || f?.name || (tmpPath && path.basename(tmpPath)) || '').toLowerCase();
            if (!mime) {
              if (name.endsWith('.webp')) mime = 'image/webp';
              else if (name.endsWith('.jpeg') || name.endsWith('.jpg')) mime = 'image/jpeg';
              else if (name.endsWith('.mp4')) mime = 'video/mp4';
            }
            let buf: Buffer | null = null;
            if (tmpPath && fs.existsSync(tmpPath)) {
              buf = await fs.promises.readFile(tmpPath);
            } else if ((f as any)?.buffer) {
              try { buf = Buffer.isBuffer((f as any).buffer) ? (f as any).buffer : Buffer.from((f as any).buffer); } catch {}
            }
            try { strapi.log.debug(`[media-meta] [ctrl] Candidate ${name} (${mime}) tmpPath=${!!tmpPath} bufLen=${buf ? buf.length : 0}`); } catch {}
            if (!buf) { try { strapi.log.debug(`[media-meta] [ctrl] Skip (no buffer): ${name}`); } catch {}; continue; }
            let extracted: any = {};
            if (mime.includes('jpeg') || mime.includes('jpg')) {
              const iptc = extractors.extractFromJpegIptc(buf); const xmp = extractors.extractXmpFromBuffer(buf); extracted = { ...xmp, ...iptc };
            } else if (mime.includes('webp')) {
              const chunks = extractors.listWebpChunks(buf);
              try { strapi.log.debug(`[media-meta] [ctrl] WEBP chunks: ${JSON.stringify(chunks.map((c:any)=>c.type))}`); } catch {}
              const exif = extractors.extractExifFromWebp(buf);
              const xmp = extractors.extractXmpFromWebp(buf);
              let scan: any = {};
              if ((!xmp || (!xmp.subject && !xmp.description)) && (!exif || (!exif.subject && !exif.description))) {
                scan = extractors.extractXmpFromBuffer(buf);
              }
              extracted = { ...scan, ...xmp, ...exif };
              if ((!extracted.subject && !extracted.description) && tmpPath) {
                try {
                  const { stdout } = await execFileAsync('exiftool', ['-j','-XMP-dc:Subject','-XMP-dc:Description','-EXIF:ImageDescription','-XPSubject', tmpPath], { timeout: 6000 });
                  const arr = JSON.parse(stdout || '[]');
                  if (Array.isArray(arr) && arr[0]) {
                    const meta = arr[0] as any;
                    const subj = (meta['XMP-dc:Subject'] ?? meta['Subject'] ?? meta['XPSubject']);
                    const desc = (meta['XMP-dc:Description'] ?? meta['Description'] ?? meta['EXIF:ImageDescription'] ?? meta['ImageDescription']);
                    if (Array.isArray(subj)) extracted.subject = (subj as any[]).join(', ');
                    else if (typeof subj === 'string') extracted.subject = subj;
                    if (typeof desc === 'string') extracted.description = desc;
                    try { strapi.log.debug(`[media-meta] [ctrl] exiftool WEBP subj=${JSON.stringify(subj)} desc=${JSON.stringify(desc)}`); } catch {}
                  }
                } catch (e:any) {
                  try { strapi.log.debug(`[media-meta] [ctrl] exiftool failed: ${e?.message}`); } catch {}
                }
              }
            } else if (mime.includes('mp4')) {
              const mp4 = extractors.extractFromMp4(buf); extracted = { ...mp4 };
            } else {
              extracted = extractors.extractXmpFromBuffer(buf);
            }
            const mapped = extractors.mapFieldsByMime(extracted, mime);
            premap.push({ name: (f?.originalFilename || f?.name || (tmpPath && path.basename(tmpPath)) || name), mapped });
            try { strapi.log.debug(`[media-meta] [ctrl] Pre-map ${name} (${mime}) => ${JSON.stringify(mapped || {})} from ${JSON.stringify(extracted || {})}`); } catch {}
          } catch {}
        }
        let result;
        try {
          result = await original.call(ctrl, ctx, next);
        } catch (e: any) {
          try { strapi.log.error(`[media-meta] controller ${ctrlName}.${actionName} error: ${e?.message}`); } catch {}
          throw e;
        }
        try {
          const body = ctx.body || {};
          const data = body.data || body;
          const files = Array.isArray(data) ? data : (data && data.length === undefined && data.id ? [data] : []);
          for (const created of files) {
            try {
              const name = created.name || created.hash || created.url || '';
              const match = premap.find((m) => m.name === created.name) || premap.find((m) => name && m.name && name.includes(m.name));
              if (!match || (!match.mapped.caption && !match.mapped.alternativeText)) continue;
              const patch: any = {};
              if (!created.caption && match.mapped.caption) patch.caption = match.mapped.caption;
              if (!created.alternativeText && match.mapped.alternativeText) patch.alternativeText = match.mapped.alternativeText;
              if (Object.keys(patch).length) await strapi.entityService.update('plugin::upload.file', created.id, { data: patch });
            } catch {}
          }
        } catch {}
        return result;
      };
      return true;
    };

    // Try wrapping known controllers likely handling uploads in v5
    const candidates = [
      ['admin-upload', 'upload'],
      ['admin-file', 'create'],
      ['content-api', 'upload'],
    ];
    let wrappedAny = false;
    for (const [c, a] of candidates) {
      const ok = wrapController(c, a);
      if (ok) { wrappedAny = true; try { strapi.log.debug(`[media-meta] Wrapped controller ${c}.${a}`); } catch {} }
    }
    if (!wrappedAny) {
      // As a fallback, wrap all functions of admin-upload controller
      const ctrl = plugin.controllers?.['admin-upload'];
      if (ctrl) {
        for (const key of Object.keys(ctrl)) {
          if (typeof ctrl[key] === 'function') {
            wrapController('admin-upload', key);
            try { strapi.log.debug(`[media-meta] Wrapped controller admin-upload.${key}`); } catch {}
          }
        }
      }
    }
  } catch {}
  return plugin;
};
