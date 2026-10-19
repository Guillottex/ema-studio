import { Router } from 'express';
import { z } from 'zod';
import { query, one } from '../db';
import { ah, HttpError, notFound } from '../middleware/error';
import { requirePerm, can } from '../middleware/auth';
import { assembleCourse, getScreen } from '../services/courseTree';
import { sanitizeComponent } from '../services/sanitize';
import { LAYOUTS, layoutThumbSvg } from '@engine';

const r = Router();

r.get('/layouts', ah(async (_req, res) => {
  const rows = await query(`SELECT id, name, description, thumbnail, sort FROM layouts ORDER BY sort`);
  res.json(rows.length ? rows : LAYOUTS.map((l, i) => ({ id: l.id, name: l.name, description: l.description, thumbnail: layoutThumbSvg(l), sort: i })));
}));

r.get('/templates', ah(async (req, res) => {
  const kind = req.query.kind === 'course' ? 'course' : req.query.kind === 'screen' ? 'screen' : null;
  const rows = await query(
    `SELECT t.id, t.kind, t.name, t.description, t.category, t.thumbnail, t.is_system, t.created_at, u.name AS created_by_name, t.created_by,
      CASE WHEN t.kind = 'course' THEN jsonb_build_object('modules', jsonb_array_length(t.data->'modules'), 'theme', t.data->'settings'->'theme'->'name', 'primary', t.data->'settings'->'theme'->'colors'->>'primary')
           ELSE jsonb_build_object('components', jsonb_array_length(t.data->'components')) END AS summary
     FROM templates t LEFT JOIN users u ON u.id = t.created_by ${kind ? 'WHERE t.kind = $1' : ''} ORDER BY t.is_system DESC, t.created_at DESC`,
    kind ? [kind] : []
  );
  res.json(rows);
}));

r.get('/templates/:id', ah(async (req, res) => {
  const t = await one(`SELECT * FROM templates WHERE id = $1`, [req.params.id]);
  if (!t) throw notFound('Plantilla');
  res.json(t);
}));

/** Guardar una pantalla como "Mi plantilla" */
r.post('/templates/from-screen', requirePerm('templates.use'), ah(async (req, res) => {
  const b = z.object({ screenId: z.string(), name: z.string().min(1).max(120), description: z.string().max(500).optional(), category: z.string().max(60).optional() }).parse(req.body);
  const s = await getScreen(b.screenId);
  const data = { height: s.height, background: s.background, settings: s.settings, layout: s.layout, tabletMode: s.tabletMode, mobileMode: s.mobileMode, components: s.components.map(sanitizeComponent) };
  res.status(201).json(await one(`INSERT INTO templates (kind, name, description, category, data, created_by) VALUES ('screen',$1,$2,$3,$4,$5) RETURNING id, name`, [b.name, b.description || '', b.category || 'Mis plantillas', data, req.user!.id]));
}));

/** Guardar un curso completo como plantilla */
r.post('/templates/from-course', requirePerm('templates.manage'), ah(async (req, res) => {
  const b = z.object({ courseId: z.string().uuid(), name: z.string().min(1).max(120), description: z.string().max(500).optional(), category: z.string().max(60).optional() }).parse(req.body);
  const doc = await assembleCourse(b.courseId);
  res.status(201).json(await one(`INSERT INTO templates (kind, name, description, category, data, created_by) VALUES ('course',$1,$2,$3,$4,$5) RETURNING id, name`, [b.name, b.description || doc.description || '', b.category || 'Personalizada', doc, req.user!.id]));
}));

r.patch('/templates/:id', requirePerm('templates.use'), ah(async (req, res) => {
  const b = z.object({ name: z.string().min(1).max(120).optional(), description: z.string().max(500).optional(), category: z.string().max(60).optional() }).parse(req.body);
  const t = await one(`SELECT * FROM templates WHERE id = $1`, [req.params.id]);
  if (!t) throw notFound('Plantilla');
  if ((t.is_system || t.kind === 'course' || t.created_by !== req.user!.id) && !can(req.user, 'templates.manage')) throw new HttpError(403, 'No podés modificar esta plantilla');
  res.json(await one(`UPDATE templates SET name = COALESCE($2,name), description = COALESCE($3,description), category = COALESCE($4,category), updated_at = now() WHERE id = $1 RETURNING id, name`, [req.params.id, b.name ?? null, b.description ?? null, b.category ?? null]));
}));

r.post('/templates/:id/duplicate', requirePerm('templates.use'), ah(async (req, res) => {
  const t = await one(`SELECT * FROM templates WHERE id = $1`, [req.params.id]);
  if (!t) throw notFound('Plantilla');
  if (t.kind === 'course' && !can(req.user, 'templates.manage')) throw new HttpError(403, 'Sólo administradores pueden duplicar plantillas de curso');
  res.status(201).json(await one(`INSERT INTO templates (kind, name, description, category, thumbnail, data, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, name`, [t.kind, `${t.name} (copia)`, t.description, t.category, t.thumbnail, t.data, req.user!.id]));
}));

r.delete('/templates/:id', requirePerm('templates.use'), ah(async (req, res) => {
  const t = await one(`SELECT * FROM templates WHERE id = $1`, [req.params.id]);
  if (!t) throw notFound('Plantilla');
  if ((t.is_system || t.kind === 'course' || t.created_by !== req.user!.id) && !can(req.user, 'templates.manage')) throw new HttpError(403, 'No podés eliminar esta plantilla');
  await query(`DELETE FROM templates WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
}));

export default r;
