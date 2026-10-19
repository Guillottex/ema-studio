import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { config, uploadsDir } from '../config';
import { one } from '../db';
import { HttpError } from '../middleware/error';
import { sanitizeSvg } from './sanitize';
import { logger } from '../logger';

export const ALLOWED: Record<string, { mime: string; kind: 'image' | 'video' | 'audio' | 'pdf' }> = {
  jpg: { mime: 'image/jpeg', kind: 'image' },
  jpeg: { mime: 'image/jpeg', kind: 'image' },
  png: { mime: 'image/png', kind: 'image' },
  svg: { mime: 'image/svg+xml', kind: 'image' },
  webp: { mime: 'image/webp', kind: 'image' },
  gif: { mime: 'image/gif', kind: 'image' },
  mp4: { mime: 'video/mp4', kind: 'video' },
  mp3: { mime: 'audio/mpeg', kind: 'audio' },
  pdf: { mime: 'application/pdf', kind: 'pdf' },
};

export function ensureDirs() {
  fs.mkdirSync(uploadsDir(), { recursive: true });
  fs.mkdirSync(path.join(config.dataDir, 'exports'), { recursive: true });
}

/** Verifica la firma binaria del archivo para que coincida con la extensión declarada */
export function checkSignature(ext: string, buf: Buffer): boolean {
  const b = buf;
  const ascii = (start: number, len: number) => b.subarray(start, start + len).toString('latin1');
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    case 'png':
      return b[0] === 0x89 && ascii(1, 3) === 'PNG';
    case 'gif':
      return ascii(0, 4) === 'GIF8';
    case 'webp':
      return ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP';
    case 'pdf':
      return ascii(0, 5) === '%PDF-';
    case 'mp4':
      return ascii(4, 4) === 'ftyp';
    case 'mp3':
      return ascii(0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0);
    case 'svg': {
      const head = b.subarray(0, 2048).toString('utf8').toLowerCase();
      return head.includes('<svg');
    }
  }
  return false;
}

const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'archivo';

export interface MediaRow {
  id: string;
  name: string;
  stored_name: string;
  mime: string;
  kind: string;
  size: number;
  width: number | null;
  height: number | null;
  thumb_name: string | null;
  created_at: string;
}

/**
 * Guarda un archivo en la biblioteca: valida extensión/firma/tamaño, optimiza imágenes,
 * genera miniatura y deduplica por checksum.
 */
export async function storeMedia(originalName: string, input: Buffer, userId: string | null): Promise<MediaRow> {
  const ext = path.extname(originalName).slice(1).toLowerCase();
  const info = ALLOWED[ext];
  if (!info) throw new HttpError(400, `Tipo de archivo no permitido (.${ext}). Permitidos: ${Object.keys(ALLOWED).join(', ')}`);
  if (!checkSignature(ext, input)) throw new HttpError(400, 'El contenido del archivo no coincide con su extensión');
  const limitMb = info.kind === 'image' ? config.maxImageMb : config.maxUploadMb;
  if (input.length > limitMb * 1024 * 1024) throw new HttpError(413, `El archivo supera el máximo de ${limitMb} MB`);

  let buf = input;
  if (ext === 'svg') buf = Buffer.from(sanitizeSvg(input.toString('utf8')), 'utf8');
  const checksum = crypto.createHash('sha256').update(buf).digest('hex');
  const existing = await one<MediaRow>(`SELECT * FROM media WHERE checksum = $1`, [checksum]);
  if (existing && fs.existsSync(path.join(uploadsDir(), existing.stored_name))) return existing;

  ensureDirs();
  const base = slug(path.basename(originalName, path.extname(originalName)));
  const storedName = `${base}-${crypto.randomBytes(4).toString('hex')}.${ext === 'jpeg' ? 'jpg' : ext}`;
  let width: number | null = null;
  let height: number | null = null;
  let thumbName: string | null = null;

  if (info.kind === 'image') {
    try {
      if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
        const img = sharp(buf, { failOn: 'none' }).rotate();
        const meta = await img.metadata();
        let pipeline = img;
        if ((meta.width || 0) > config.imageMaxWidth) pipeline = pipeline.resize({ width: config.imageMaxWidth, withoutEnlargement: true });
        const out =
          ext === 'png'
            ? await pipeline.png({ compressionLevel: 9, palette: (meta.channels || 3) <= 4 && buf.length > 600_000 }).toBuffer()
            : ext === 'webp'
              ? await pipeline.webp({ quality: 82 }).toBuffer()
              : await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
        if (out.length < buf.length || (meta.width || 0) > config.imageMaxWidth) buf = out;
      }
      const meta2 = await sharp(buf, { failOn: 'none', animated: false }).metadata();
      width = meta2.width || null;
      height = meta2.height || null;
      thumbName = `thumb-${storedName.replace(/\.[^.]+$/, '')}.webp`;
      await sharp(buf, { failOn: 'none', animated: false }).resize({ width: 360, height: 240, fit: 'inside', withoutEnlargement: true }).webp({ quality: 70 }).toFile(path.join(uploadsDir(), thumbName));
    } catch (e) {
      logger.warn({ err: e }, 'No se pudo procesar la imagen; se guarda sin optimizar');
      thumbName = null;
    }
  }
  fs.writeFileSync(path.join(uploadsDir(), storedName), buf);
  const row = await one<MediaRow>(
    `INSERT INTO media (name, stored_name, mime, kind, size, width, height, thumb_name, checksum, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [originalName.slice(0, 200), storedName, info.mime, info.kind, buf.length, width, height, thumbName, checksum, userId]
  );
  return row!;
}

export function assetPath(storedName: string): string | null {
  if (!/^[A-Za-z0-9._-]+$/.test(storedName)) return null;
  const p = path.join(uploadsDir(), storedName);
  return fs.existsSync(p) ? p : null;
}

export function assetExists(storedName: string): boolean {
  return !!assetPath(storedName);
}

export async function removeMediaFiles(row: { stored_name: string; thumb_name: string | null }) {
  for (const n of [row.stored_name, row.thumb_name]) {
    if (!n) continue;
    const p = path.join(uploadsDir(), n);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}
