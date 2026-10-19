import { Router } from 'express';
import fs from 'node:fs';
import multer from 'multer';
import { z } from 'zod';
import { uid, defaultCourseSettings, getLayout, slugify, type CourseDoc, type Theme } from '@engine';
import { one, query, tx } from '../db';
import { ah, HttpError, notFound } from '../middleware/error';
import { requirePerm, can } from '../middleware/auth';
import { assembleCourse, courseTree, createCourseFromDoc, getCourseRow, getSettings, insertModule, replaceContent, touchCourse } from '../services/courseTree';
import { exportProject, importProject, assertCourseDoc } from '../services/projectIO';
import { fullValidation, writeScormZip } from '../services/scormExport';
import { logger } from '../logger';

const r = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 300 * 1024 * 1024 } });

const metaSchema = z.object({
  title: z.string().min(1, 'El nombre es obligatorio').max(200),
  description: z.string().max(5000).optional(),
  author: z.string().max(200).optional(),
  categoryId: z.number().int().nullable().optional(),
  coverImage: z.string().max(300).nullable().optional(),
  duration: z.string().max(80).optional(),
  level: z.string().max(60).optional(),
  language: z.string().max(10).optional(),
  version: z.string().max(20).optional(),
  objectives: z.array(z.string().max(500)).optional(),
  requirements: z.array(z.string().max(500)).optional(),
  status: z.enum(['draft', 'published']).optional(),
  themeId: z.string().uuid().nullable().optional(),
});

async function themeData(themeId?: string | null): Promise<Theme | null> {
  if (!themeId) return null;
  const t = await one(`SELECT data FROM themes WHERE id = $1`, [themeId]);
  return t ? (t.data as Theme) : null;
}

function blankModule() {
  const layout = getLayout('title-text')!.build();
  return {
    id: uid(10),
    title: 'Módulo 1',
    description: '',
    lessons: [{ id: uid(10), title: 'Lección 1', description: '', screens: [{ id: uid(10), title: 'Pantalla 1', layout: 'title-text', height: layout.height || 675, background: {}, settings: {}, components: layout.components }] }],
  };
}

/* ------------------------------- listado ------------------------------- */

r.get('/', ah(async (req, res) => {
  const { q, status, category } = req.query as Record<string, string>;
  const where: string[] = [];
  const vals: any[] = [];
  if (q) { vals.push(`%${q}%`); where.push(`(c.title ILIKE $${vals.length} OR c.description ILIKE $${vals.length} OR c.author ILIKE $${vals.length})`); }
  if (status === 'draft' || status === 'published') { vals.push(status); where.push(`c.status = $${vals.length}`); }
  if (category) { vals.push(Number(category)); where.push(`c.category_id = $${vals.length}`); }
  const rows = await query(
    `SELECT c.id, c.title, c.description, c.author, c.status, c.version, c.cover_image, c.level, c.duration, c.language, c.updated_at, c.created_at,
            cat.name AS category, cat.color AS category_color, u.name AS updated_by_name,
            (SELECT count(*)::int FROM modules m WHERE m.course_id = c.id) AS modules,
            (SELECT count(*)::int FROM screens s JOIN lessons l ON l.id = s.lesson_id JOIN modules m ON m.id = l.module_id WHERE m.course_id = c.id) AS screens,
            (SELECT max(created_at) FROM scorm_exports e WHERE e.course_id = c.id) AS last_export
     FROM courses c LEFT JOIN categories cat ON cat.id = c.category_id LEFT JOIN users u ON u.id = c.updated_by
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY c.updated_at DESC`,
    vals
  );
  res.json(rows);
}));

/* -------------------------------- crear -------------------------------- */

r.post('/', requirePerm('courses.create'), ah(async (req, res) => {
  const b = metaSchema.extend({ templateId: z.string().uuid().optional() }).parse(req.body);
  if (b.status === 'published' && !can(req.user, 'courses.publish')) throw new HttpError(403, 'Sólo un administrador puede publicar cursos');
  const theme = await themeData(b.themeId);
  let id: string;
  if (b.templateId) {
    const tpl = await one(`SELECT data FROM templates WHERE id = $1 AND kind = 'course'`, [b.templateId]);
    if (!tpl) throw notFound('Plantilla');
    const doc = tpl.data as CourseDoc;
    if (theme) doc.settings = { ...doc.settings, theme };
    id = await createCourseFromDoc(doc, { userId: req.user!.id, title: b.title, categoryId: b.categoryId ?? null, themeId: b.themeId ?? null });
  } else {
    id = await tx(async (cl) => {
      const row = await one(`INSERT INTO courses (title, created_by, updated_by, theme_id) VALUES ($1, $2, $2, $3) RETURNING id`, [b.title, req.user!.id, b.themeId ?? null], cl);
      await cl.query(`INSERT INTO course_settings (course_id, settings) VALUES ($1, $2)`, [row.id, defaultCourseSettings(theme || undefined)]);
      await insertModule(cl, row.id, blankModule(), 0);
      return row.id;
    });
  }
  await updateMeta(id, b, req.user!.id);
  res.status(201).json(await courseDetail(id));
}));

async function updateMeta(id: string, b: Partial<z.infer<typeof metaSchema>>, userId: string) {
  const map: Record<string, string> = {
    title: 'title', description: 'description', author: 'author', categoryId: 'category_id', coverImage: 'cover_image', duration: 'duration',
    level: 'level', language: 'language', version: 'version', objectives: 'objectives', requirements: 'requirements', status: 'status', themeId: 'theme_id',
  };
  const sets: string[] = [];
  const vals: any[] = [id];
  for (const [k, col] of Object.entries(map)) {
    const v = (b as any)[k];
    if (v === undefined) continue;
    vals.push(Array.isArray(v) ? JSON.stringify(v) : v);
    sets.push(`${col} = $${vals.length}`);
  }
  vals.push(userId);
  await query(`UPDATE courses SET ${[...sets, `updated_by = $${vals.length}`, 'updated_at = now()'].join(', ')} WHERE id = $1`, vals);
}

async function courseDetail(id: string) {
  const c = await getCourseRow(id);
  const settings = await getSettings(id);
  const counts = await one(
    `SELECT (SELECT count(*)::int FROM modules WHERE course_id = $1) AS modules,
            (SELECT count(*)::int FROM lessons l JOIN modules m ON m.id = l.module_id WHERE m.course_id = $1) AS lessons,
            (SELECT count(*)::int FROM screens s JOIN lessons l ON l.id = s.lesson_id JOIN modules m ON m.id = l.module_id WHERE m.course_id = $1) AS screens`,
    [id]
  );
  return { ...c, settings, counts };
}

r.get('/:id', ah(async (req, res) => {
  res.json(await courseDetail(req.params.id));
}));

r.patch('/:id', requirePerm('courses.edit'), ah(async (req, res) => {
  const b = metaSchema.partial().parse(req.body);
  await getCourseRow(req.params.id);
  if (b.status === 'published' && !can(req.user, 'courses.publish')) throw new HttpError(403, 'Sólo un administrador puede publicar cursos');
  if (b.themeId !== undefined && b.themeId) {
    const theme = await themeData(b.themeId);
    if (theme) {
      const s = await getSettings(req.params.id);
      await query(`UPDATE course_settings SET settings = $2 WHERE course_id = $1`, [req.params.id, { ...s, theme }]);
    }
  }
  await updateMeta(req.params.id, b, req.user!.id);
  res.json(await courseDetail(req.params.id));
}));

const settingsSchema = z.object({
  theme: z.any().optional(),
  navigation: z.object({ mode: z.enum(['free', 'linear']), showMenu: z.boolean(), showProgress: z.boolean(), showScreenCounter: z.boolean(), showHeader: z.boolean() }).partial().optional(),
  completion: z.object({ criteria: z.enum(['visited', 'quiz', 'both']), visitedPercent: z.number().min(1).max(100) }).partial().optional(),
  resume: z.object({ enabled: z.boolean(), ask: z.boolean() }).partial().optional(),
  logo: z.string().max(300).nullable().optional(),
});

r.put('/:id/settings', requirePerm('courses.edit'), ah(async (req, res) => {
  const b = settingsSchema.parse(req.body);
  const cur = await getSettings(req.params.id);
  const next = {
    ...cur,
    ...(b.theme ? { theme: { ...cur.theme, ...b.theme, colors: { ...cur.theme.colors, ...(b.theme.colors || {}) }, fonts: { ...cur.theme.fonts, ...(b.theme.fonts || {}) } } } : {}),
    navigation: { ...cur.navigation, ...(b.navigation || {}) },
    completion: { ...cur.completion, ...(b.completion || {}) },
    resume: { ...cur.resume, ...(b.resume || {}) },
    ...(b.logo !== undefined ? { logo: b.logo || undefined } : {}),
  };
  await query(`INSERT INTO course_settings (course_id, settings) VALUES ($1,$2) ON CONFLICT (course_id) DO UPDATE SET settings = EXCLUDED.settings`, [req.params.id, next]);
  await touchCourse(req.params.id, req.user!.id);
  res.json(next);
}));

r.delete('/:id', requirePerm('courses.edit'), ah(async (req, res) => {
  const c = await getCourseRow(req.params.id);
  if (!can(req.user, 'courses.delete') && c.created_by !== req.user!.id) throw new HttpError(403, 'Sólo el autor del curso o un administrador pueden eliminarlo');
  const exports = await query(`SELECT stored_path FROM scorm_exports WHERE course_id = $1`, [req.params.id]);
  await query(`DELETE FROM courses WHERE id = $1`, [req.params.id]);
  exports.forEach((e) => { try { fs.unlinkSync(e.stored_path); } catch { /* ya no existe */ } });
  res.json({ ok: true });
}));

r.post('/:id/duplicate', requirePerm('courses.create'), ah(async (req, res) => {
  const doc = await assembleCourse(req.params.id);
  const row = await getCourseRow(req.params.id);
  const id = await createCourseFromDoc(doc, { userId: req.user!.id, title: `${doc.title} (copia)`, categoryId: row.category_id, themeId: row.theme_id });
  res.status(201).json(await courseDetail(id));
}));

/* ------------------------------ estructura ------------------------------ */

r.get('/:id/tree', ah(async (req, res) => {
  await getCourseRow(req.params.id);
  res.json(await courseTree(req.params.id));
}));

r.get('/:id/doc', ah(async (req, res) => {
  res.json(await assembleCourse(req.params.id));
}));

const structureSchema = z.object({
  modules: z.array(z.object({ id: z.string(), lessons: z.array(z.object({ id: z.string(), screens: z.array(z.string()) })) })),
});

/** Reordenar / mover módulos, lecciones y pantallas (drag & drop del árbol) */
r.put('/:id/structure', requirePerm('courses.edit'), ah(async (req, res) => {
  const b = structureSchema.parse(req.body);
  const courseId = req.params.id;
  await tx(async (cl) => {
    const owned = new Set((await query(`SELECT id FROM modules WHERE course_id = $1`, [courseId], cl)).map((x) => x.id));
    const ownedLessons = new Set((await query(`SELECT l.id FROM lessons l JOIN modules m ON m.id = l.module_id WHERE m.course_id = $1`, [courseId], cl)).map((x) => x.id));
    const ownedScreens = new Set((await query(`SELECT s.id FROM screens s JOIN lessons l ON l.id = s.lesson_id JOIN modules m ON m.id = l.module_id WHERE m.course_id = $1`, [courseId], cl)).map((x) => x.id));
    for (const [mi, m] of b.modules.entries()) {
      if (!owned.has(m.id)) throw new HttpError(400, 'Módulo ajeno al curso');
      await cl.query(`UPDATE modules SET position = $2 WHERE id = $1`, [m.id, mi]);
      for (const [li, l] of m.lessons.entries()) {
        if (!ownedLessons.has(l.id)) throw new HttpError(400, 'Lección ajena al curso');
        await cl.query(`UPDATE lessons SET position = $2, module_id = $3 WHERE id = $1`, [l.id, li, m.id]);
        for (const [si, s] of l.screens.entries()) {
          if (!ownedScreens.has(s)) throw new HttpError(400, 'Pantalla ajena al curso');
          await cl.query(`UPDATE screens SET position = $2, lesson_id = $3 WHERE id = $1`, [s, si, l.id]);
        }
      }
    }
  });
  await touchCourse(courseId, req.user!.id);
  res.json(await courseTree(courseId));
}));

/* ------------------------- proyecto editable JSON ------------------------ */

r.get('/:id/export-json', ah(async (req, res) => {
  const includeMedia = req.query.media !== '0';
  const doc = await exportProject(req.params.id, includeMedia);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${slugify(doc.title)}-proyecto.json"`);
  res.send(JSON.stringify(doc, null, 1));
}));

r.post('/import', requirePerm('courses.create'), upload.single('file'), ah(async (req, res) => {
  let data: any;
  if (req.file) {
    try {
      data = JSON.parse(req.file.buffer.toString('utf8'));
    } catch {
      throw new HttpError(400, 'El archivo no es un JSON válido');
    }
  } else data = req.body?.project;
  assertCourseDoc(data);
  const result = await importProject(data, req.user!.id, typeof req.body?.title === 'string' && req.body.title ? req.body.title : undefined);
  res.status(201).json({ ...result, course: await courseDetail(result.courseId) });
}));

/* --------------------------- validación y SCORM -------------------------- */

r.post('/:id/validate', ah(async (req, res) => {
  const doc = await assembleCourse(req.params.id);
  const { plan, ...report } = fullValidation(doc);
  res.json({ ...report, files: Object.keys(plan.text).length + Object.keys(plan.assets).length + Object.keys(plan.engine).length });
}));

r.post('/:id/export-scorm', requirePerm('courses.export'), ah(async (req, res) => {
  const doc = await assembleCourse(req.params.id);
  const { plan, ...report } = fullValidation(doc);
  if (!report.valid) return res.status(422).json({ error: 'El curso tiene errores que impiden exportarlo', report });
  const row = await one(
    `INSERT INTO scorm_exports (course_id, version, file_name, stored_path, report, created_by) VALUES ($1,$2,$3,'',$4,$5) RETURNING id`,
    [req.params.id, doc.version || '1.0', plan.fileName, { errors: report.errors, warnings: report.warnings, issues: report.issues.slice(0, 200) }, req.user!.id]
  );
  try {
    const out = await writeScormZip(plan, row!.id);
    await query(`UPDATE scorm_exports SET stored_path = $2, size = $3 WHERE id = $1`, [row!.id, out.filePath, out.size]);
    logger.info({ course: req.params.id, size: out.size, files: out.files }, 'SCORM exportado');
    res.status(201).json({ id: row!.id, fileName: plan.fileName, size: out.size, files: out.files, report, downloadUrl: `/api/exports/${row!.id}/download` });
  } catch (e) {
    await query(`DELETE FROM scorm_exports WHERE id = $1`, [row!.id]);
    throw e;
  }
}));

r.get('/:id/exports', ah(async (req, res) => {
  res.json(await query(`SELECT e.id, e.version, e.file_name, e.size, e.created_at, e.report->'warnings' AS warnings, u.name AS created_by_name
    FROM scorm_exports e LEFT JOIN users u ON u.id = e.created_by WHERE e.course_id = $1 ORDER BY e.created_at DESC`, [req.params.id]));
}));

/* -------------------------------- versiones ------------------------------- */

function bumpVersion(v: string, kind: 'minor' | 'major'): string {
  const m = /^(\d+)(?:\.(\d+))?/.exec(v || '1.0');
  const major = m ? Number(m[1]) : 1;
  const minor = m && m[2] ? Number(m[2]) : 0;
  return kind === 'major' ? `${major + 1}.0` : `${major}.${minor + 1}`;
}

r.get('/:id/versions', ah(async (req, res) => {
  res.json(await query(`SELECT v.id, v.version, v.notes, v.created_at, u.name AS created_by_name,
    jsonb_array_length(v.snapshot->'modules') AS modules FROM course_versions v LEFT JOIN users u ON u.id = v.created_by
    WHERE v.course_id = $1 ORDER BY v.created_at DESC`, [req.params.id]));
}));

r.post('/:id/versions', requirePerm('courses.edit'), ah(async (req, res) => {
  const b = z.object({ bump: z.enum(['minor', 'major', 'custom', 'current']).default('minor'), version: z.string().max(20).optional(), notes: z.string().max(1000).optional() }).parse(req.body);
  const c = await getCourseRow(req.params.id);
  const label = b.bump === 'custom' ? b.version || c.version : b.bump === 'current' ? c.version : bumpVersion(c.version, b.bump);
  if (b.bump === 'custom' && !b.version) throw new HttpError(400, 'Indicá el número de versión');
  await query(`UPDATE courses SET version = $2, updated_at = now() WHERE id = $1`, [req.params.id, label]);
  const doc = await assembleCourse(req.params.id);
  const v = await one(`INSERT INTO course_versions (course_id, version, notes, snapshot, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING id, version, created_at`, [req.params.id, label, b.notes || '', doc, req.user!.id]);
  res.status(201).json(v);
}));

export default r;

/* --------------------------- rutas sueltas (/api) -------------------------- */

export const versionsRouter = Router();

versionsRouter.get('/versions/:vid', ah(async (req, res) => {
  const v = await one(`SELECT * FROM course_versions WHERE id = $1`, [req.params.vid]);
  if (!v) throw notFound('Versión');
  res.json(v);
}));

versionsRouter.post('/versions/:vid/restore', requirePerm('courses.edit'), ah(async (req, res) => {
  const v = await one(`SELECT * FROM course_versions WHERE id = $1`, [req.params.vid]);
  if (!v) throw notFound('Versión');
  const current = await assembleCourse(v.course_id);
  const snap = v.snapshot as CourseDoc;
  await tx(async (cl) => {
    await cl.query(`INSERT INTO course_versions (course_id, version, notes, snapshot, created_by) VALUES ($1,$2,$3,$4,$5)`, [v.course_id, current.version || '1.0', `Respaldo automático antes de restaurar v${v.version}`, current, req.user!.id]);
    await replaceContent(cl, v.course_id, snap.modules);
    await cl.query(`UPDATE course_settings SET settings = $2 WHERE course_id = $1`, [v.course_id, snap.settings]);
    await cl.query(
      `UPDATE courses SET title=$2, description=$3, author=$4, cover_image=$5, duration=$6, level=$7, language=$8, version=$9, objectives=$10, requirements=$11, updated_at=now(), updated_by=$12 WHERE id=$1`,
      [v.course_id, snap.title, snap.description || '', snap.author || '', snap.coverImage || null, snap.duration || '', snap.level || '', snap.language || 'es', v.version, JSON.stringify(snap.objectives || []), JSON.stringify(snap.requirements || []), req.user!.id]
    );
  });
  res.json({ ok: true, courseId: v.course_id, version: v.version });
}));

versionsRouter.post('/versions/:vid/duplicate', requirePerm('courses.create'), ah(async (req, res) => {
  const v = await one(`SELECT * FROM course_versions WHERE id = $1`, [req.params.vid]);
  if (!v) throw notFound('Versión');
  const id = await createCourseFromDoc(v.snapshot, { userId: req.user!.id, title: `${v.snapshot.title} (v${v.version})`, version: v.version });
  res.status(201).json({ id });
}));

versionsRouter.delete('/versions/:vid', requirePerm('courses.edit'), ah(async (req, res) => {
  await query(`DELETE FROM course_versions WHERE id = $1`, [req.params.vid]);
  res.json({ ok: true });
}));

versionsRouter.get('/exports/:eid/download', ah(async (req, res) => {
  const e = await one(`SELECT * FROM scorm_exports WHERE id = $1`, [req.params.eid]);
  if (!e || !e.stored_path || !fs.existsSync(e.stored_path)) throw notFound('Exportación');
  res.download(e.stored_path, e.file_name);
}));

versionsRouter.delete('/exports/:eid', requirePerm('courses.export'), ah(async (req, res) => {
  const e = await one(`DELETE FROM scorm_exports WHERE id = $1 RETURNING stored_path`, [req.params.eid]);
  if (e?.stored_path) { try { fs.unlinkSync(e.stored_path); } catch { /* ignore */ } }
  res.json({ ok: true });
}));
