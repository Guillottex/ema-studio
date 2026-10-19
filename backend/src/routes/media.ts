import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { query, one } from '../db';
import { ah, HttpError, notFound } from '../middleware/error';
import { requirePerm } from '../middleware/auth';
import { config } from '../config';
import { storeMedia, removeMediaFiles, ALLOWED } from '../services/media';

const r = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 20 },
  fileFilter: (_req, file, cb) => {
    const ext = (file.originalname.split('.').pop() || '').toLowerCase();
    if (!ALLOWED[ext]) return cb(new HttpError(400, `Tipo de archivo no permitido: .${ext}`));
    cb(null, true);
  },
});

/** Uso de un recurso: pantallas y cursos que lo referencian */
async function usage(names: string[]) {
  if (!names.length) return new Map<string, { courses: number; screens: number }>();
  const rows = await query(
    `SELECT n.name, count(DISTINCT m.course_id)::int AS courses, count(DISTINCT s.id)::int AS screens
     FROM unnest($1::text[]) AS n(name)
     LEFT JOIN screen_components sc ON sc.props::text LIKE '%asset:' || n.name || '%'
     LEFT JOIN screens s ON s.id = sc.screen_id LEFT JOIN lessons l ON l.id = s.lesson_id LEFT JOIN modules m ON m.id = l.module_id
     GROUP BY n.name`,
    [names]
  );
  const extra = await query(
    `SELECT n.name, count(DISTINCT c.id)::int AS courses FROM unnest($1::text[]) AS n(name)
     JOIN courses c ON c.cover_image = 'asset:' || n.name GROUP BY n.name`,
    [names]
  );
  const map = new Map(rows.map((x) => [x.name, { courses: x.courses, screens: x.screens }]));
  extra.forEach((x) => { const u = map.get(x.name)!; u.courses = Math.max(u.courses, x.courses); });
  return map;
}

r.get('/', ah(async (req, res) => {
  const { q, kind } = req.query as Record<string, string>;
  const vals: any[] = [];
  const where: string[] = [];
  if (q) { vals.push(`%${q}%`); where.push(`m.name ILIKE $${vals.length}`); }
  if (kind) { vals.push(kind); where.push(`m.kind = $${vals.length}`); }
  const rows = await query(`SELECT m.*, u.name AS created_by_name FROM media m LEFT JOIN users u ON u.id = m.created_by ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY m.created_at DESC LIMIT 1000`, vals);
  const u = await usage(rows.map((x) => x.stored_name));
  res.json(rows.map((x) => ({ ...x, url: `/uploads/${x.stored_name}`, thumbUrl: x.thumb_name ? `/uploads/${x.thumb_name}` : null, asset: `asset:${x.stored_name}`, usage: u.get(x.stored_name) || { courses: 0, screens: 0 } })));
}));

r.post('/', requirePerm('media.upload'), upload.array('files', 20), ah(async (req, res) => {
  const files = (req.files as Express.Multer.File[]) || [];
  if (!files.length) throw new HttpError(400, 'No se recibieron archivos');
  const out: any[] = [];
  for (const f of files) {
    const name = Buffer.from(f.originalname, 'latin1').toString('utf8');
    const row = await storeMedia(name, f.buffer, req.user!.id);
    out.push({ ...row, url: `/uploads/${row.stored_name}`, thumbUrl: row.thumb_name ? `/uploads/${row.thumb_name}` : null, asset: `asset:${row.stored_name}` });
  }
  res.status(201).json(out);
}));

r.patch('/:id', requirePerm('media.upload'), ah(async (req, res) => {
  const b = z.object({ name: z.string().min(1).max(200) }).parse(req.body);
  const row = await one(`UPDATE media SET name = $2 WHERE id = $1 RETURNING *`, [req.params.id, b.name]);
  if (!row) throw notFound('Recurso');
  res.json(row);
}));

r.delete('/:id', requirePerm('media.upload'), ah(async (req, res) => {
  const row = await one(`SELECT * FROM media WHERE id = $1`, [req.params.id]);
  if (!row) throw notFound('Recurso');
  const u = (await usage([row.stored_name])).get(row.stored_name);
  if (u && u.screens > 0 && req.query.force !== '1') throw new HttpError(409, `El recurso se usa en ${u.screens} pantalla(s) de ${u.courses} curso(s)`, u);
  await query(`DELETE FROM media WHERE id = $1`, [req.params.id]);
  await removeMediaFiles(row);
  res.json({ ok: true });
}));

export default r;
