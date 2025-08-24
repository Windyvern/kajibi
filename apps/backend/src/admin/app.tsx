import type { StrapiApp } from '@strapi/strapi/admin';
import CameraIcon from './icons/CameraIcon';

type Extracted = {
  subject?: string;
  description?: string;
  comment?: string;
};

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

async function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return await file.arrayBuffer();
}

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

function extractXmpFromBuffer(buf: Uint8Array): Extracted {
  try {
    const text = new TextDecoder('utf-8').decode(buf);
    const startIdx = text.indexOf('<x:xmpmeta');
    if (startIdx !== -1) {
      const endIdx = text.indexOf('</x:xmpmeta>');
      if (endIdx !== -1) {
        const xml = text.slice(startIdx, endIdx + '</x:xmpmeta>'.length);
        return extractXmpFromXml(xml);
      }
    }
    return extractXmpFromXml(text);
  } catch {
    return {};
  }
}

function extractXmpFromWebp(buf: Uint8Array): Extracted {
  try {
    if (buf.length < 12) return {};
    const riff = String.fromCharCode(buf[0], buf[1], buf[2], buf[3]);
    const webp = String.fromCharCode(buf[8], buf[9], buf[10], buf[11]);
    if (riff !== 'RIFF' || webp !== 'WEBP') return {};
    let p = 12;
    const len = buf.length;
    while (p + 8 <= len) {
      const type = String.fromCharCode(buf[p], buf[p+1], buf[p+2], buf[p+3]);
      const size = buf[p+4] | (buf[p+5]<<8) | (buf[p+6]<<16) | (buf[p+7]<<24);
      const dataStart = p + 8;
      const dataEnd = Math.min(dataStart + size, len);
      if (type === 'XMP ') {
        const xml = new TextDecoder('utf-8').decode(buf.slice(dataStart, dataEnd));
        return extractXmpFromBuffer(new TextEncoder().encode(xml));
      }
      p = dataStart + size + (size % 2);
    }
  } catch {}
  return {};
}

function extractFromJpegIptc(buf: Uint8Array): Extracted {
  try {
    if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return {};
    let p = 2;
    const len = buf.length;
    const header = new TextEncoder().encode('Photoshop 3.0\x00');
    const eightBim = new TextEncoder().encode('8BIM');
    while (p + 4 <= len) {
      if (buf[p] !== 0xff) break;
      const marker = buf[p + 1];
      p += 2;
      if (marker === 0xda) break; // SOS
      if (p + 2 > len) break;
      const segLen = (buf[p] << 8) | buf[p + 1];
      p += 2;
      const segStart = p;
      const segEnd = Math.min(p + segLen - 2, len);
      if (marker === 0xed /* APP13 */) {
        if (segEnd - segStart >= header.length) {
          let ok = true;
          for (let i = 0; i < header.length; i++) if (buf[segStart + i] !== header[i]) { ok = false; break; }
          if (ok) {
            let q = segStart + header.length;
            while (q + 12 <= segEnd) {
              let is8 = true;
              for (let i = 0; i < 4; i++) if (buf[q + i] !== eightBim[i]) { is8 = false; break; }
              if (!is8) break;
              q += 4;
              if (q + 2 > segEnd) break;
              const resId = (buf[q] << 8) | buf[q + 1]; q += 2;
              if (q >= segEnd) break;
              const nameLen = buf[q]; q += 1;
              q += nameLen;
              if ((1 + nameLen) % 2 === 1) q += 1;
              if (q + 4 > segEnd) break;
              const size = (buf[q] << 24) | (buf[q + 1] << 16) | (buf[q + 2] << 8) | buf[q + 3]; q += 4;
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
      }
      p = segEnd;
    }
  } catch {}
  return {};
}

function parseIptcData(data: Uint8Array): Extracted {
  const out: Extracted = {};
  let p = 0;
  const len = data.length;
  while (p + 5 <= len) {
    if (data[p] !== 0x1c) { p++; continue; }
    const record = data[p + 1];
    const dataset = data[p + 2];
    p += 3;
    if (p + 2 > len) break;
    let size = (data[p] << 8) | data[p + 1]; p += 2;
    if ((size & 0x8000) !== 0) {
      if (p + 4 > len) break;
      size = (data[p] << 24) | (data[p + 1] << 16) | (data[p + 2] << 8) | data[p + 3];
      p += 4;
    }
    if (p + size > len) break;
    const value = data.slice(p, p + size); p += size;
    if (record === 2) {
      if (dataset === 5) {
        out.subject = decodeMaybeLatin1(value);
      } else if (dataset === 120) {
        out.description = decodeMaybeLatin1(value);
      } else if (dataset === 116) {
        out.comment = decodeMaybeLatin1(value);
      }
    }
  }
  return out;
}

function decodeMaybeLatin1(arr: Uint8Array): string {
  try {
    const utf = new TextDecoder('utf-8', { fatal: false }).decode(arr);
    if (/\ufffd/.test(utf)) return new TextDecoder('iso-8859-1').decode(arr);
    return utf;
  } catch {
    return new TextDecoder('iso-8859-1').decode(arr);
  }
}

function extractFromMp4(buf: Uint8Array): Extracted {
  const out: Extracted = {};
  try {
    const len = buf.length;
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const textLatin1 = (off: number, n: number) => {
      let s = '';
      for (let i = 0; i < n; i++) s += String.fromCharCode(buf[off + i]);
      return s;
    };
    function walk(start: number, end: number) {
      let p = start;
      while (p + 8 <= end) {
        let size = dv.getUint32(p);
        const type = textLatin1(p + 4, 4);
        if (!size) break;
        let header = 8;
        if (size === 1) { // 64-bit size
          if (p + 16 > end) break;
          const high = dv.getUint32(p + 8);
          const low = dv.getUint32(p + 12);
          size = high * 4294967296 + low;
          header = 16;
        }
        const boxStart = p + header;
        const boxEnd = Math.min(p + size, end);
        if (boxEnd <= boxStart) break;
        if (type === 'meta') {
          walk(Math.min(boxStart + 4, boxEnd), boxEnd);
        } else if (type === 'moov' || type === 'udta' || type === 'ilst') {
          walk(boxStart, boxEnd);
        } else if (type === '©cmt' || type === 'desc') {
          let q = boxStart;
          while (q + 8 <= boxEnd) {
            const dSize = dv.getUint32(q);
            const dType = textLatin1(q + 4, 4);
            if (!dSize) break;
            const dStart = q + 8;
            const dEnd = Math.min(q + dSize, boxEnd);
            if (dType === 'data') {
              let payloadStart = dStart + 8; // skip ver/flags + type
              if (dStart + 12 <= dEnd && dv.getUint32(dStart + 8) === 0) {
                payloadStart = dStart + 16; // skip locale
              }
              const payload = buf.slice(payloadStart, dEnd);
              const text = new TextDecoder('utf-8').decode(payload).replace(/\0+/g, '').trim();
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

function mapFieldsByMime(extracted: Extracted, mime: string): { caption?: string; alternativeText?: string } {
  const lower = (mime || '').toLowerCase();
  if (lower.includes('image/jpeg') || lower.includes('image/jpg') || lower.includes('jpeg') || lower.includes('jpg') || lower.includes('webp')) {
    return { caption: extracted.subject, alternativeText: extracted.description };
  }
  if (lower.includes('video/mp4')) {
    return { caption: extracted.comment, alternativeText: extracted.description };
  }
  return {};
}

function extractExifFromWebp(buf: Uint8Array): Extracted {
  try {
    if (buf.length < 12) return {};
    const head = String.fromCharCode(buf[0], buf[1], buf[2], buf[3]);
    const webp = String.fromCharCode(buf[8], buf[9], buf[10], buf[11]);
    if (head !== 'RIFF' || webp !== 'WEBP') return {};
    let p = 12;
    const len = buf.length;
    while (p + 8 <= len) {
      const type = String.fromCharCode(buf[p], buf[p+1], buf[p+2], buf[p+3]);
      const size = buf[p+4] | (buf[p+5]<<8) | (buf[p+6]<<16) | (buf[p+7]<<24);
      const dataStart = p + 8;
      const dataEnd = Math.min(dataStart + size, len);
      if (type === 'EXIF') {
        return parseTiff(new Uint8Array(buf.buffer, buf.byteOffset + dataStart, Math.max(0, dataEnd - dataStart)));
      }
      p = dataStart + size + (size % 2);
    }
  } catch {}
  return {};
}

function parseTiff(data: Uint8Array): Extracted {
  const out: Extracted = {};
  if (data.length < 8) return out;
  const endian = String.fromCharCode(data[0], data[1]);
  const le = endian === 'II';
  const rd16 = (o: number) => le ? (data[o] | (data[o+1]<<8)) : ((data[o]<<8) | data[o+1]);
  const rd32 = (o: number) => le ? (data[o] | (data[o+1]<<8) | (data[o+2]<<16) | (data[o+3]<<24)) : ((data[o]<<24) | (data[o+1]<<16) | (data[o+2]<<8) | data[o+3]);
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
      let value: Uint8Array;
      const typeSize = (type === 1 || type === 2 || type === 6 || type === 7) ? 1 : (type === 3 ? 2 : (type === 4 || type === 9 ? 4 : 8));
      const valueBytes = num * typeSize;
      if (valueBytes <= 4) {
        value = data.slice(valOff, valOff + Math.min(4, valueBytes));
      } else {
        const off2 = rd32(valOff);
        if (off2 + valueBytes > data.length) continue;
        value = data.slice(off2, off2 + valueBytes);
      }
      if (tag === 0x010E) {
        const t = decodeExifString(value).replace(/\0+$/g, '').trim();
        if (t) out.description = t;
      } else if (tag === 0x9C9F) {
        try {
          // XPSubject UTF-16LE
          const dv = new DataView(value.buffer, value.byteOffset, value.byteLength);
          let s = '';
          for (let k = 0; k + 1 < value.length; k += 2) {
            const ch = dv.getUint16(k, true);
            if (ch === 0) break;
            s += String.fromCharCode(ch);
          }
          if (s) out.subject = s;
        } catch {}
      }
    }
  };
  parseIfd(ifd0);
  return out;
}

function decodeExifString(value: Uint8Array): string {
  try {
    const utf = new TextDecoder('utf-8', { fatal: false }).decode(value);
    // Heuristic: if replacement chars or common mojibake sequences appear, fallback to Windows-1252
    if (/\ufffd/.test(utf) || /Ã./.test(utf) || /Â./.test(utf)) {
      try {
        return new TextDecoder('windows-1252' as any).decode(value);
      } catch {
        return new TextDecoder('iso-8859-1' as any).decode(value);
      }
    }
    return utf;
  } catch {
    try { return new TextDecoder('windows-1252' as any).decode(value); } catch {}
    return new TextDecoder('iso-8859-1' as any).decode(value);
  }
}
function fillInputsInModal(index: number, values: { caption?: string; alternativeText?: string }) {
  const modal = document.querySelector('[role="dialog"]');
  if (!modal) return;
  // Try to find inputs by name pattern first (Formik uses dot/array indices)
  const candidates = [
    [`input[name="assets.${index}.caption"], textarea[name="assets.${index}.caption"]`, values.caption],
    [`input[name="assets.${index}.alternativeText"], textarea[name="assets.${index}.alternativeText"]`, values.alternativeText],
  ] as const;
  for (const [sel, val] of candidates) {
    if (!val) continue;
    const el = modal.querySelector<HTMLInputElement | HTMLTextAreaElement>(sel);
    if (el && !el.value) {
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
  // Fallback: find per-asset blocks and select nth inputs labeled Caption/Alternative text
  if (index === 0) {
    const allCaptions = modal.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input[name$=".caption"], textarea[name$=".caption"]');
    const allAlts = modal.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input[name$=".alternativeText"], textarea[name$=".alternativeText"]');
    if (values.caption && allCaptions[index] && !allCaptions[index].value) {
      allCaptions[index].value = values.caption;
      allCaptions[index].dispatchEvent(new Event('input', { bubbles: true }));
      allCaptions[index].dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (values.alternativeText && allAlts[index] && !allAlts[index].value) {
      allAlts[index].value = values.alternativeText;
      allAlts[index].dispatchEvent(new Event('input', { bubbles: true }));
      allAlts[index].dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
}

function watchUploadModal() {
  const observer = new MutationObserver(async (mutations) => {
    for (const m of mutations) {
      for (const node of Array.from(m.addedNodes)) {
        if (!(node instanceof HTMLElement)) continue;
        const dialog = node.matches('[role="dialog"]') ? node : node.querySelector('[role="dialog"]');
        if (!dialog) continue;

        // Prevent duplicates for the same dialog instance
        if ((dialog as any)._metaPrefillAttached) continue;
        (dialog as any)._metaPrefillAttached = true;

        const handleFiles = async (filesList: FileList | File[]) => {
          const files = Array.from(filesList as any as File[]);
          if (!files.length) return;
          console.debug('[media-meta] files detected in modal:', files.map((f) => `${f.name} (${f.type})`));
          for (let i = 0; i < files.length; i++) {
            try {
              const f = files[i];
              const ab = await fileToArrayBuffer(f);
              const u8 = new Uint8Array(ab);
              let extracted: Extracted = {};
              let type = f.type || '';
              if (!type) {
                const name = (f.name || '').toLowerCase();
                if (name.endsWith('.webp')) type = 'image/webp';
                else if (name.endsWith('.jpg') || name.endsWith('.jpeg')) type = 'image/jpeg';
                else if (name.endsWith('.mp4')) type = 'video/mp4';
              }
              if (type === 'image/jpeg' || type === 'image/jpg') {
                const iptc = extractFromJpegIptc(u8);
                const xmp = extractXmpFromBuffer(u8);
                extracted = { ...xmp, ...iptc };
      } else if (type === 'image/webp') {
        const exif = extractExifFromWebp(u8);
        const xmp = extractXmpFromWebp(u8);
        extracted = { ...xmp, ...exif };
      } else if (type === 'video/mp4') {
                const mp4 = extractFromMp4(u8);
                const xmp = extractXmpFromBuffer(u8);
                extracted = { ...xmp, ...mp4 };
              } else {
                extracted = extractXmpFromBuffer(u8);
              }
              const mapped = mapFieldsByMime(extracted, type);
              console.debug('[media-meta] mapped fields for', f.name, mapped);
              if (mapped.caption || mapped.alternativeText) {
                // Try several times to account for async field rendering
                for (const delay of [50, 150, 300, 600, 1000]) {
                  setTimeout(() => fillInputsInModal(i, mapped), delay);
                }
              }
            } catch (e) {
              console.debug('[media-meta] extraction error:', e);
            }
          }
        };

        // Hidden file input change (click-to-upload)
        const fileInput = dialog.querySelector<HTMLInputElement>('input[type="file"]');
        if (fileInput) {
          fileInput.addEventListener('change', () => handleFiles(fileInput.files || []), { once: false });
        }

        // Drag & drop onto the dialog
        const dropHandler = (ev: Event) => {
          const e = ev as DragEvent;
          if (!e.dataTransfer) return;
          const files = e.dataTransfer.files;
          if (!files || files.length === 0) return;
          handleFiles(files);
        };
        dialog.addEventListener('drop', dropHandler, true);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

export default {
  config: {
    locales: [],
  },
  bootstrap(app: StrapiApp) {
    try {
      watchUploadModal();
      // eslint-disable-next-line no-console
      console.debug('[media-meta] Admin prefill enabled');
      // Register a simple page for Instagram Import
      try {
        // @ts-ignore
        app.addMenuLink({
          to: '/plugins/instagram-import',
          icon: CameraIcon,
          intlLabel: { id: 'instagram-import.menu.label', defaultMessage: 'Instagram Import' },
          Component: async () => {
            const React = await import('react');
            const Page = () => {
              const [fileLabel, setFileLabel] = React.useState<string>('');
              const [progress, setProgress] = React.useState<number>(0);
              const [phase, setPhase] = React.useState<'idle'|'upload'|'processing'|'done'|'error'>('idle');
              const [message, setMessage] = React.useState<string>('');
              const [messages, setMessages] = React.useState<Array<{ t: number; text: string }>>([]);
              const [summary, setSummary] = React.useState<string>('');
              const [jobId, setJobId] = React.useState<string>('');
              const pollRef = React.useRef<any>(null);
              const fileInputRef = React.useRef<HTMLInputElement | null>(null);
              const STRAPI_BLUE = '#4945FF';

              const pickToken = (): string => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const w: any = typeof window !== 'undefined' ? window : {};
                let token = '';
                try { token = w.strapi?.admin?.auth?.getToken?.() || ''; } catch {}
                if (!token) {
                  try { token = w.strapi?.token?.getToken?.() || ''; } catch {}
                }
                if (!token && w.localStorage) {
                  token = localStorage.getItem('jwtToken') || localStorage.getItem('token') || localStorage.getItem('strapi_jwt') || '';
                }
                return token || '';
              };

              const startProcessingTicker = React.useCallback(() => {
                // From 10% to 95% while waiting for server processing
                setPhase('processing');
                setMessage('Préparation… vous pouvez quitter la page.');
                let current = 10;
                setProgress((p) => { current = Math.max(p, 10); return current; });
                const id = setInterval(() => {
                  current = Math.min(current + 1, 95);
                  setProgress(current);
                  if (current >= 95) clearInterval(id);
                }, 2000);
                return () => clearInterval(id);
              }, []);

              const handleFilesSelected = (list: FileList | File[] | null) => {
                const arr = list ? Array.from(list as any) as File[] : [];
                if (!arr.length) return;
                setFileLabel(arr.length === 1 ? arr[0].name : `${arr.length} fichiers sélectionnés`);
                setPhase('upload');
                setMessage('Téléchargement… veuillez ne pas quitter la page.');
                setProgress(0);

                const form = new FormData();
                for (const f of arr) {
                  form.append('files', f, f.name);
                }
                const token = pickToken();

                const xhr = new XMLHttpRequest();
                xhr.open('POST', '/api/instagram-import');
                if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                xhr.withCredentials = true;

                xhr.upload.onprogress = (ev) => {
                  if (!ev.lengthComputable) return;
                  const frac = ev.loaded / Math.max(1, ev.total);
                  const pct = Math.floor(frac * 10); // 0–10%
                  setProgress(pct);
                };

                // When the upload fully finishes, switch UI to processing immediately
                xhr.upload.onload = () => {
                  if (phase === 'upload') {
                    setProgress((p) => (p < 10 ? 10 : p));
                    // Begin simulated processing ticker up to 95%
                    if (!stopTicker) stopTicker = startProcessingTicker();
                  }
                };

                let stopTicker: any = null;
                xhr.onreadystatechange = () => {
                  // Backup: if headers are received before onload fires, start ticker
                  if (xhr.readyState === 2 && phase === 'upload') {
                    if (!stopTicker) stopTicker = startProcessingTicker();
                  }
                };

                xhr.onload = () => {
                  if (stopTicker) try { stopTicker(); } catch {}
                  const text = xhr.responseText || '';
                  let json: any = null;
                  try { json = JSON.parse(text); } catch {}
                  if (xhr.status >= 200 && xhr.status < 300 && json?.ok) {
                    // If job-based, start polling progress
                    if (json?.jobId) {
                      const id = String(json.jobId);
                      setJobId(id);
                      setPhase('processing');
                      setMessage('Préparation… vous pouvez quitter la page.');
                      const poll = async () => {
                        try {
                          const res = await fetch(`/api/instagram-import/status?job=${encodeURIComponent(id)}`, { credentials: 'include' });
                          const st = await res.json();
                          if (st?.percent != null) setProgress(Math.max(10, Math.min(100, Number(st.percent))));
                          const msgs = Array.isArray(st?.messages) ? st.messages : [];
                          if (msgs.length) {
                            setMessages(msgs);
                            setMessage(String(msgs[msgs.length - 1]?.text || ''));
                          }
                          else if (st?.stage) setMessage(String(st.stage));
                          if (st?.done) {
                            // Build final summary
                            const by = st?.stats?.byCategory || {};
                            const nPosts = (by.posts?.uploaded || 0);
                            const nReels = (by.reels?.uploaded || 0);
                            const nStories = (by.stories?.uploaded || 0);
                            const created = st?.stats?.articlesCreated || 0;
                            const updated = st?.stats?.articlesUpdated || 0;
                            let sentence = `${nPosts} posts, ${nReels} reels et ${nStories} stories ajoutés`;
                            if (created && !updated) sentence += `, ${created} articles créés !`;
                            else if (!created && updated) sentence += `, ${updated} articles mis à jour !`;
                            else if (created && updated) sentence += `, ${created} articles créés, ${updated} articles mis à jour !`;
                            else sentence += ' !';
                            setSummary(sentence);
                            setPhase('done');
                            setProgress(100);
                            clearInterval(pollRef.current);
                            pollRef.current = null;
                          }
                        } catch {}
                      };
                      if (pollRef.current) clearInterval(pollRef.current);
                      pollRef.current = setInterval(poll, 1000);
                      poll();
                    } else {
                      // legacy immediate response path
                      setPhase('done');
                      setProgress(100);
                      const by = json?.stats?.byCategory || {};
                      const nPosts = (by.posts?.uploaded || 0);
                      const nReels = (by.reels?.uploaded || 0);
                      const nStories = (by.stories?.uploaded || 0);
                      const created = json?.stats?.articlesCreated || 0;
                      const updated = json?.stats?.articlesUpdated || 0;
                      let sentence = `${nPosts} posts, ${nReels} reels et ${nStories} stories ajoutés`;
                      if (created && !updated) sentence += `, ${created} articles créés !`;
                      else if (!created && updated) sentence += `, ${updated} articles mis à jour !`;
                      else if (created && updated) sentence += `, ${created} articles créés, ${updated} articles mis à jour !`;
                      else sentence += ' !';
                      setSummary(sentence);
                    }
                  } else {
                    setPhase('error');
                    const errText = json ? JSON.stringify(json) : (text || `HTTP ${xhr.status}`);
                    setMessage('Échec de l\'import : ' + errText);
                  }
                };

                xhr.onerror = () => {
                  if (stopTicker) try { stopTicker(); } catch {}
                  setPhase('error');
                  setMessage('Échec de l\'import (réseau).');
                };

                xhr.send(form);
              };

              const onChooseFile = () => fileInputRef.current?.click();

              return (
                React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: 24 } },
                  React.createElement('div', { style: { maxWidth: 900, textAlign: 'center' } },
                    React.createElement('h1', { style: { fontSize: 36, fontWeight: 800, color: STRAPI_BLUE, marginBottom: 8 } }, 'Importeur Instagram'),
                    React.createElement('p', { style: { fontSize: 16, color: '#666', marginBottom: 6 } }, 'Uploader ici l\'archive .zip Instagram. Le serveur va automatiquement trier le contenu et créer ou mettre à jour les articles.'),
                    React.createElement('p', { style: { fontSize: 14, color: '#666', fontStyle: 'italic', marginBottom: 24 } }, 'Récupérez votre archive Instagram via l\'Espace Comptes Meta. Important : si le format d\'export est en HTML, sélectionnez JSON, sinon l\'import échouera.'),

                    React.createElement('input', { ref: fileInputRef, type: 'file', accept: '.zip', multiple: true, style: { display: 'none' }, onChange: (e: any) => handleFilesSelected(e.target.files) }),
                    React.createElement('button', {
                      type: 'button', onClick: onChooseFile,
                      style: {
                        background: STRAPI_BLUE,
                        color: 'white',
                        border: 'none',
                        borderRadius: 9999,
                        padding: '18px 28px',
                        fontSize: 16,
                        cursor: 'pointer',
                        minWidth: 280,
                      },
                    }, fileLabel ? fileLabel : 'Choisir un fichier'),

                    (phase !== 'idle') && React.createElement('div', { style: { marginTop: 24 } },
                      React.createElement('div', { style: { height: 10, background: '#eee', borderRadius: 9999, overflow: 'hidden' } },
                        React.createElement('div', { style: { height: '100%', width: `${progress}%`, background: STRAPI_BLUE, transition: 'width 0.3s ease' } })
                      ),
                      React.createElement('div', { style: { marginTop: 8, color: '#444' } }, message),
                      messages && messages.length > 0 && React.createElement('div', { style: { marginTop: 6, color: '#555', textAlign: 'left', maxWidth: 700, marginLeft: 'auto', marginRight: 'auto' } },
                        messages.slice(-6).map((m, i) => React.createElement('div', { key: `${m.t}-${i}`, style: { fontSize: 12, opacity: 0.85 } }, `• ${m.text}`))
                      ),
                      summary && React.createElement('div', { style: { marginTop: 8, fontWeight: 600 } }, summary),
                    ),
                  )
                )
              );
            };
            // @ts-ignore
            return () => React.createElement(Page);
          },
          permissions: [],
        });
      } catch {}
    } catch {}
  },
};
