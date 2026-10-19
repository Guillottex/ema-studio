import { Router } from 'express';
import { z } from 'zod';
import { one, query } from '../db';
import { ah, notFound } from '../middleware/error';
import { requirePerm } from '../middleware/auth';

const r = Router();
const schema = z.object({ name: z.string().min(2).max(80), description: z.string().max(400).optional().default(''), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().default('#2563eb') });

r.get('/', ah(async (_req, res) => {
  res.json(await query(`SELECT c.*, (SELECT count(*)::int FROM courses x WHERE x.category_id = c.id) AS courses,
    (SELECT count(*)::int FROM questions q WHERE q.category_id = c.id) AS questions FROM categories c ORDER BY c.name`));
}));

r.post('/', requirePerm('categories.manage'), ah(async (req, res) => {
  const b = schema.parse(req.body);
  res.status(201).json(await one(`INSERT INTO categories (name, description, color) VALUES ($1,$2,$3) RETURNING *`, [b.name, b.description, b.color]));
}));

r.patch('/:id', requirePerm('categories.manage'), ah(async (req, res) => {
  const b = schema.partial().parse(req.body);
  const row = await one(`UPDATE categories SET name = COALESCE($2, name), description = COALESCE($3, description), color = COALESCE($4, color) WHERE id = $1 RETURNING *`, [req.params.id, b.name ?? null, b.description ?? null, b.color ?? null]);
  if (!row) throw notFound('Categoría');
  res.json(row);
}));

r.delete('/:id', requirePerm('categories.manage'), ah(async (req, res) => {
  await query(`DELETE FROM categories WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
}));

export default r;
