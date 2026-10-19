import { Router } from 'express';
import { z } from 'zod';
import { query, one } from '../db';
import { ah, HttpError, notFound } from '../middleware/error';
import { requirePerm } from '../middleware/auth';
import { DEFAULT_THEME } from '@engine';

const r = Router();

r.get('/', ah(async (_req, res) => {
  res.json(await query(`SELECT t.*, u.name AS created_by_name, (SELECT count(*)::int FROM courses c WHERE c.theme_id = t.id) AS courses FROM themes t LEFT JOIN users u ON u.id = t.created_by ORDER BY t.is_preset DESC, t.name`));
}));

const themeSchema = z.object({ name: z.string().min(1).max(80), data: z.record(z.any()) });

function normalize(data: any, name: string) {
  const d = DEFAULT_THEME;
  return {
    ...d, ...data, name,
    colors: { ...d.colors, ...(data.colors || {}) }, fonts: { ...d.fonts, ...(data.fonts || {}) }, buttons: { ...d.buttons, ...(data.buttons || {}) },
    headings: { ...d.headings, ...(data.headings || {}) }, background: { ...d.background, ...(data.background || {}) }, cards: { ...d.cards, ...(data.cards || {}) },
    menu: { ...d.menu, ...(data.menu || {}) }, header: { ...d.header, ...(data.header || {}) }, progress: { ...d.progress, ...(data.progress || {}) },
  };
}

r.post('/', requirePerm('themes.manage'), ah(async (req, res) => {
  const b = themeSchema.parse(req.body);
  res.status(201).json(await one(`INSERT INTO themes (name, data, created_by) VALUES ($1,$2,$3) RETURNING *`, [b.name, normalize(b.data, b.name), req.user!.id]));
}));

r.put('/:id', requirePerm('themes.manage'), ah(async (req, res) => {
  const b = themeSchema.parse(req.body);
  const cur = await one(`SELECT is_preset FROM themes WHERE id = $1`, [req.params.id]);
  if (!cur) throw notFound('Tema');
  if (cur.is_preset) throw new HttpError(400, 'Los temas predefinidos no se pueden modificar. Duplicalo para personalizarlo.');
  res.json(await one(`UPDATE themes SET name = $2, data = $3, updated_at = now() WHERE id = $1 RETURNING *`, [req.params.id, b.name, normalize(b.data, b.name)]));
}));

r.delete('/:id', requirePerm('themes.manage'), ah(async (req, res) => {
  const cur = await one(`SELECT is_preset FROM themes WHERE id = $1`, [req.params.id]);
  if (cur?.is_preset) throw new HttpError(400, 'Los temas predefinidos no se pueden eliminar');
  await query(`DELETE FROM themes WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
}));

export default r;
