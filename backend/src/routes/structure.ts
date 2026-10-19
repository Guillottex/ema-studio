import { Router } from 'express';
import { z } from 'zod';
import { uid, getLayout, DEFAULT_STAGE_HEIGHT, type ScreenData, type ComponentData } from '@engine';
import { one, query, tx } from '../db';
import { ah, HttpError, notFound } from '../middleware/error';
import { requirePerm } from '../middleware/auth';
import {
  courseIdOfLesson, courseIdOfModule, courseIdOfScreen, getLessonDoc, getModuleDoc, getScreen, insertComponents, insertLesson,
  insertModule, insertScreen, regenerateIds, shiftPositions, touchCourse, getCourseRow,
} from '../services/courseTree';

const r = Router();
const edit = requirePerm('courses.edit');

function screenFromLayout(title: string, layoutId?: string): ScreenData {
  const l = layoutId ? getLayout(layoutId) : undefined;
  const built = l ? l.build() : { components: [] as ComponentData[] };
  return { id: uid(10), title, layout: l?.id, height: built.height || DEFAULT_STAGE_HEIGHT, background: built.background || {}, settings: {}, components: built.components };
}

async function screenFromTemplate(title: string, templateId: string): Promise<ScreenData> {
  const t = await one(`SELECT data FROM templates WHERE id = $1 AND kind = 'screen'`, [templateId]);
  if (!t) throw notFound('Plantilla');
  const d = t.data as Partial<ScreenData>;
  const [s] = regenerateIds([{ id: 'tmp', title, height: d.height || DEFAULT_STAGE_HEIGHT, background: d.background || {}, settings: d.settings || {}, layout: d.layout, tabletMode: d.tabletMode, mobileMode: d.mobileMode, components: d.components || [] }], 'screens');
  return { ...s, title };
}

/* ------------------------------- módulos ------------------------------- */

r.post('/courses/:id/modules', edit, ah(async (req, res) => {
  const b = z.object({ title: z.string().min(1).max(200).default('Nuevo módulo'), afterId: z.string().optional(), empty: z.boolean().optional() }).parse(req.body);
  const courseId = req.params.id;
  await getCourseRow(courseId);
  const id = await tx(async (cl) => {
    let pos = (await one(`SELECT COALESCE(max(position) + 1, 0) AS p FROM modules WHERE course_id = $1`, [courseId], cl))!.p;
    if (b.afterId) {
      const after = await one(`SELECT position FROM modules WHERE id = $1 AND course_id = $2`, [b.afterId, courseId], cl);
      if (after) { pos = after.position + 1; await shiftPositions(cl, 'modules', 'course_id', courseId, pos); }
    }
    const m = { id: uid(10), title: b.title, description: '', lessons: b.empty ? [] : [{ id: uid(10), title: 'Lección 1', description: '', screens: [screenFromLayout('Pantalla 1', 'title-text')] }] };
    await insertModule(cl, courseId, m, pos);
    return m.id;
  });
  await touchCourse(courseId, req.user!.id);
  res.status(201).json({ id });
}));

r.patch('/modules/:id', edit, ah(async (req, res) => {
  const b = z.object({ title: z.string().min(1).max(200).optional(), description: z.string().max(2000).optional() }).parse(req.body);
  const row = await one(`UPDATE modules SET title = COALESCE($2, title), description = COALESCE($3, description) WHERE id = $1 RETURNING *`, [req.params.id, b.title ?? null, b.description ?? null]);
  if (!row) throw notFound('Módulo');
  await touchCourse(row.course_id, req.user!.id);
  res.json(row);
}));

r.delete('/modules/:id', edit, ah(async (req, res) => {
  const courseId = await courseIdOfModule(req.params.id);
  await query(`DELETE FROM modules WHERE id = $1`, [req.params.id]);
  await touchCourse(courseId, req.user!.id);
  res.json({ ok: true });
}));

r.post('/modules/:id/duplicate', edit, ah(async (req, res) => {
  const courseId = await courseIdOfModule(req.params.id);
  const src = await getModuleDoc(req.params.id);
  const [copy] = regenerateIds([src], 'modules');
  copy.title = `${src.title} (copia)`;
  await tx(async (cl) => {
    const pos = (await one(`SELECT position FROM modules WHERE id = $1`, [req.params.id], cl))!.position + 1;
    await shiftPositions(cl, 'modules', 'course_id', courseId, pos);
    await insertModule(cl, courseId, copy, pos);
  });
  await touchCourse(courseId, req.user!.id);
  res.status(201).json({ id: copy.id });
}));

/* ------------------------------- lecciones ------------------------------ */

r.post('/modules/:id/lessons', edit, ah(async (req, res) => {
  const b = z.object({ title: z.string().min(1).max(200).default('Nueva lección'), afterId: z.string().optional() }).parse(req.body);
  const courseId = await courseIdOfModule(req.params.id);
  const id = await tx(async (cl) => {
    let pos = (await one(`SELECT COALESCE(max(position) + 1, 0) AS p FROM lessons WHERE module_id = $1`, [req.params.id], cl))!.p;
    if (b.afterId) {
      const after = await one(`SELECT position FROM lessons WHERE id = $1`, [b.afterId], cl);
      if (after) { pos = after.position + 1; await shiftPositions(cl, 'lessons', 'module_id', req.params.id, pos); }
    }
    const l = { id: uid(10), title: b.title, description: '', screens: [screenFromLayout('Pantalla 1', 'title-text')] };
    await insertLesson(cl, req.params.id, l, pos);
    return l.id;
  });
  await touchCourse(courseId, req.user!.id);
  res.status(201).json({ id });
}));

r.patch('/lessons/:id', edit, ah(async (req, res) => {
  const b = z.object({ title: z.string().min(1).max(200).optional(), description: z.string().max(2000).optional() }).parse(req.body);
  const row = await one(`UPDATE lessons SET title = COALESCE($2, title), description = COALESCE($3, description) WHERE id = $1 RETURNING *`, [req.params.id, b.title ?? null, b.description ?? null]);
  if (!row) throw notFound('Lección');
  await touchCourse(await courseIdOfLesson(req.params.id), req.user!.id);
  res.json(row);
}));

r.delete('/lessons/:id', edit, ah(async (req, res) => {
  const courseId = await courseIdOfLesson(req.params.id);
  await query(`DELETE FROM lessons WHERE id = $1`, [req.params.id]);
  await touchCourse(courseId, req.user!.id);
  res.json({ ok: true });
}));

r.post('/lessons/:id/duplicate', edit, ah(async (req, res) => {
  const courseId = await courseIdOfLesson(req.params.id);
  const src = await getLessonDoc(req.params.id);
  const [copy] = regenerateIds([src], 'lessons');
  copy.title = `${src.title} (copia)`;
  await tx(async (cl) => {
    const cur = (await one(`SELECT module_id, position FROM lessons WHERE id = $1`, [req.params.id], cl))!;
    await shiftPositions(cl, 'lessons', 'module_id', cur.module_id, cur.position + 1);
    await insertLesson(cl, cur.module_id, copy, cur.position + 1);
  });
  await touchCourse(courseId, req.user!.id);
  res.status(201).json({ id: copy.id });
}));

/* ------------------------------- pantallas ------------------------------ */

r.post('/lessons/:id/screens', edit, ah(async (req, res) => {
  const b = z.object({ title: z.string().min(1).max(200).default('Nueva pantalla'), layout: z.string().optional(), templateId: z.string().uuid().optional(), afterId: z.string().optional() }).parse(req.body);
  const courseId = await courseIdOfLesson(req.params.id);
  const screen = b.templateId ? await screenFromTemplate(b.title, b.templateId) : screenFromLayout(b.title, b.layout);
  await tx(async (cl) => {
    let pos = (await one(`SELECT COALESCE(max(position) + 1, 0) AS p FROM screens WHERE lesson_id = $1`, [req.params.id], cl))!.p;
    if (b.afterId) {
      const after = await one(`SELECT position FROM screens WHERE id = $1`, [b.afterId], cl);
      if (after) { pos = after.position + 1; await shiftPositions(cl, 'screens', 'lesson_id', req.params.id, pos); }
    }
    await insertScreen(cl, req.params.id, screen, pos);
  });
  await touchCourse(courseId, req.user!.id);
  res.status(201).json(await getScreen(screen.id));
}));

r.get('/screens/:id', ah(async (req, res) => {
  const s = await getScreen(req.params.id);
  const meta = await one(`SELECT s.updated_at, s.lesson_id, l.module_id, m.course_id FROM screens s JOIN lessons l ON l.id = s.lesson_id JOIN modules m ON m.id = l.module_id WHERE s.id = $1`, [req.params.id]);
  res.json({ ...s, updatedAt: meta!.updated_at, lessonId: meta!.lesson_id, moduleId: meta!.module_id, courseId: meta!.course_id });
}));

const boxSchema = z.object({ x: z.number(), y: z.number(), w: z.number().min(1), h: z.number().min(1), hidden: z.boolean().optional() });
const componentSchema = z.object({
  id: z.string().min(1).max(40),
  type: z.string().min(1).max(60),
  name: z.string().max(120).optional(),
  props: z.record(z.any()).default({}),
  style: z.record(z.any()).default({}),
  layout: z.object({ desktop: boxSchema, tablet: boxSchema.optional(), mobile: boxSchema.optional() }),
  animation: z.any().optional(),
  events: z.array(z.object({ trigger: z.enum(['click', 'hover', 'complete']), actions: z.array(z.object({ type: z.string() }).passthrough()) })).default([]),
  visibility: z.object({ hidden: z.boolean().optional(), condition: z.object({ type: z.string(), target: z.string().optional(), value: z.string().optional() }).optional() }).default({}),
  locked: z.boolean().optional(),
});
const screenSchema = z.object({
  title: z.string().min(1).max(200),
  layout: z.string().max(60).nullable().optional(),
  height: z.number().int().min(300).max(10000),
  background: z.record(z.any()).default({}),
  settings: z.record(z.any()).default({}),
  tabletMode: z.enum(['auto', 'custom']).default('auto'),
  mobileMode: z.enum(['auto', 'custom']).default('auto'),
  components: z.array(componentSchema).max(400),
});

/** Guardado completo de una pantalla (auto-guardado del editor) */
r.put('/screens/:id', edit, ah(async (req, res) => {
  const b = screenSchema.parse(req.body);
  const ids = new Set<string>();
  b.components.forEach((c) => { if (ids.has(c.id)) throw new HttpError(400, `Componente duplicado: ${c.id}`); ids.add(c.id); });
  const courseId = await courseIdOfScreen(req.params.id);
  const updated = await tx(async (cl) => {
    const row = await one(
      `UPDATE screens SET title = $2, layout = $3, height = $4, background = $5, settings = $6, tablet_mode = $7, mobile_mode = $8, updated_at = now() WHERE id = $1 RETURNING updated_at`,
      [req.params.id, b.title, b.layout ?? null, b.height, b.background, b.settings, b.tabletMode, b.mobileMode],
      cl
    );
    await cl.query(`DELETE FROM screen_components WHERE screen_id = $1`, [req.params.id]);
    await insertComponents(cl, req.params.id, b.components as ComponentData[]);
    return row!.updated_at;
  });
  await touchCourse(courseId, req.user!.id);
  res.json({ ok: true, updatedAt: updated });
}));

r.patch('/screens/:id', edit, ah(async (req, res) => {
  const b = z.object({ title: z.string().min(1).max(200) }).parse(req.body);
  const row = await one(`UPDATE screens SET title = $2, updated_at = now() WHERE id = $1 RETURNING id, title`, [req.params.id, b.title]);
  if (!row) throw notFound('Pantalla');
  await touchCourse(await courseIdOfScreen(req.params.id), req.user!.id);
  res.json(row);
}));

r.delete('/screens/:id', edit, ah(async (req, res) => {
  const courseId = await courseIdOfScreen(req.params.id);
  await query(`DELETE FROM screens WHERE id = $1`, [req.params.id]);
  await touchCourse(courseId, req.user!.id);
  res.json({ ok: true });
}));

r.post('/screens/:id/duplicate', edit, ah(async (req, res) => {
  const courseId = await courseIdOfScreen(req.params.id);
  const src = await getScreen(req.params.id);
  const [copy] = regenerateIds([src], 'screens');
  copy.title = `${src.title} (copia)`;
  await tx(async (cl) => {
    const cur = (await one(`SELECT lesson_id, position FROM screens WHERE id = $1`, [req.params.id], cl))!;
    await shiftPositions(cl, 'screens', 'lesson_id', cur.lesson_id, cur.position + 1);
    await insertScreen(cl, cur.lesson_id, copy, cur.position + 1);
  });
  await touchCourse(courseId, req.user!.id);
  res.status(201).json(await getScreen(copy.id));
}));

export default r;
