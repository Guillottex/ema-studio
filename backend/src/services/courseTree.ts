import type { PoolClient } from 'pg';
import {
  SCHEMA_VERSION, uid, defaultCourseSettings, DEFAULT_STAGE_HEIGHT,
  type CourseDoc, type ModuleData, type LessonData, type ScreenData, type ComponentData, type CourseSettings,
} from '@engine';
import { pool, query, one, tx, type Db } from '../db';
import { notFound } from '../middleware/error';
import { sanitizeComponent, sanitizeDoc } from './sanitize';

/* --------------------------------- lectura --------------------------------- */

export function rowToComponent(r: any): ComponentData {
  return {
    id: r.id,
    type: r.type,
    name: r.name || undefined,
    props: r.props || {},
    style: r.style || {},
    layout: r.layout,
    animation: r.animation || undefined,
    events: r.events || [],
    visibility: r.visibility || {},
    locked: !!r.locked,
  };
}

export function rowToScreen(r: any, components: ComponentData[] = []): ScreenData {
  return {
    id: r.id,
    title: r.title,
    layout: r.layout || undefined,
    height: r.height || DEFAULT_STAGE_HEIGHT,
    background: r.background || {},
    settings: r.settings || {},
    tabletMode: r.tablet_mode || 'auto',
    mobileMode: r.mobile_mode || 'auto',
    components,
  };
}

export async function getCourseRow(id: string, db: Db = pool) {
  const c = await one(
    `SELECT c.*, cat.name AS category_name FROM courses c LEFT JOIN categories cat ON cat.id = c.category_id WHERE c.id = $1`,
    [id],
    db
  );
  if (!c) throw notFound('Curso');
  return c;
}

export async function getSettings(courseId: string, db: Db = pool): Promise<CourseSettings> {
  const r = await one(`SELECT settings FROM course_settings WHERE course_id = $1`, [courseId], db);
  const def = defaultCourseSettings();
  const s = r?.settings || {};
  return {
    ...def,
    ...s,
    theme: { ...def.theme, ...(s.theme || {}) },
    navigation: { ...def.navigation, ...(s.navigation || {}) },
    completion: { ...def.completion, ...(s.completion || {}) },
    resume: { ...def.resume, ...(s.resume || {}) },
  };
}

/** Arma el documento JSON completo del curso a partir de las tablas normalizadas. */
export async function assembleCourse(courseId: string, db: Db = pool): Promise<CourseDoc> {
  const c = await getCourseRow(courseId, db);
  const settings = await getSettings(courseId, db);
  const modules = await query(`SELECT * FROM modules WHERE course_id = $1 ORDER BY position, id`, [courseId], db);
  const lessons = await query(`SELECT l.* FROM lessons l JOIN modules m ON m.id = l.module_id WHERE m.course_id = $1 ORDER BY l.position, l.id`, [courseId], db);
  const screens = await query(
    `SELECT s.* FROM screens s JOIN lessons l ON l.id = s.lesson_id JOIN modules m ON m.id = l.module_id WHERE m.course_id = $1 ORDER BY s.position, s.id`,
    [courseId],
    db
  );
  const comps = await query(
    `SELECT sc.* FROM screen_components sc JOIN screens s ON s.id = sc.screen_id JOIN lessons l ON l.id = s.lesson_id JOIN modules m ON m.id = l.module_id
     WHERE m.course_id = $1 ORDER BY sc.position`,
    [courseId],
    db
  );
  const compsBy = new Map<string, ComponentData[]>();
  comps.forEach((r) => {
    if (!compsBy.has(r.screen_id)) compsBy.set(r.screen_id, []);
    compsBy.get(r.screen_id)!.push(rowToComponent(r));
  });
  const screensBy = new Map<string, ScreenData[]>();
  screens.forEach((s) => {
    if (!screensBy.has(s.lesson_id)) screensBy.set(s.lesson_id, []);
    screensBy.get(s.lesson_id)!.push(rowToScreen(s, compsBy.get(s.id) || []));
  });
  const lessonsBy = new Map<string, LessonData[]>();
  lessons.forEach((l) => {
    if (!lessonsBy.has(l.module_id)) lessonsBy.set(l.module_id, []);
    lessonsBy.get(l.module_id)!.push({ id: l.id, title: l.title, description: l.description || '', screens: screensBy.get(l.id) || [] });
  });
  return {
    schemaVersion: SCHEMA_VERSION,
    id: c.id,
    title: c.title,
    description: c.description,
    author: c.author,
    category: c.category_name || '',
    coverImage: c.cover_image || undefined,
    duration: c.duration,
    level: c.level,
    language: c.language,
    version: c.version,
    objectives: c.objectives || [],
    requirements: c.requirements || [],
    status: c.status,
    settings,
    modules: modules.map((m) => ({ id: m.id, title: m.title, description: m.description || '', lessons: lessonsBy.get(m.id) || [] })),
  };
}

/** Árbol liviano (sin componentes) para el panel lateral del editor */
export async function courseTree(courseId: string) {
  const modules = await query(`SELECT id, title, description, position FROM modules WHERE course_id = $1 ORDER BY position, id`, [courseId]);
  const lessons = await query(`SELECT l.id, l.module_id, l.title, l.description, l.position FROM lessons l JOIN modules m ON m.id = l.module_id WHERE m.course_id = $1 ORDER BY l.position, l.id`, [courseId]);
  const screens = await query(
    `SELECT s.id, s.lesson_id, s.title, s.layout, s.position, s.updated_at, (SELECT count(*)::int FROM screen_components sc WHERE sc.screen_id = s.id) AS component_count
     FROM screens s JOIN lessons l ON l.id = s.lesson_id JOIN modules m ON m.id = l.module_id WHERE m.course_id = $1 ORDER BY s.position, s.id`,
    [courseId]
  );
  return modules.map((m) => ({
    ...m,
    lessons: lessons.filter((l) => l.module_id === m.id).map((l) => ({ ...l, screens: screens.filter((s) => s.lesson_id === l.id) })),
  }));
}

/* --------------------------------- escritura -------------------------------- */

export async function insertComponents(client: Db, screenId: string, comps: ComponentData[]) {
  let pos = 0;
  for (const raw of comps) {
    const c = sanitizeComponent(raw);
    await client.query(
      `INSERT INTO screen_components (screen_id, id, type, name, position, props, style, layout, animation, events, visibility, locked)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [screenId, c.id, c.type, c.name || null, pos++, c.props || {}, c.style || {}, c.layout, c.animation || null, JSON.stringify(c.events || []), c.visibility || {}, !!c.locked]
    );
  }
}

export async function insertScreen(client: Db, lessonId: string, s: ScreenData, position: number) {
  await client.query(
    `INSERT INTO screens (id, lesson_id, title, layout, height, background, settings, tablet_mode, mobile_mode, position)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [s.id, lessonId, s.title || 'Pantalla', s.layout || null, s.height || DEFAULT_STAGE_HEIGHT, s.background || {}, s.settings || {}, s.tabletMode || 'auto', s.mobileMode || 'auto', position]
  );
  await insertComponents(client, s.id, s.components || []);
}

export async function insertLesson(client: Db, moduleId: string, l: LessonData, position: number) {
  await client.query(`INSERT INTO lessons (id, module_id, title, description, position) VALUES ($1,$2,$3,$4,$5)`, [l.id, moduleId, l.title || 'Lección', l.description || '', position]);
  let i = 0;
  for (const s of l.screens || []) await insertScreen(client, l.id, s, i++);
}

export async function insertModule(client: Db, courseId: string, m: ModuleData, position: number) {
  await client.query(`INSERT INTO modules (id, course_id, title, description, position) VALUES ($1,$2,$3,$4,$5)`, [m.id, courseId, m.title || 'Módulo', m.description || '', position]);
  let i = 0;
  for (const l of m.lessons || []) await insertLesson(client, m.id, l, i++);
}

/** Reemplaza todo el contenido (módulos/lecciones/pantallas/componentes) de un curso. */
export async function replaceContent(client: PoolClient, courseId: string, modules: ModuleData[]) {
  await client.query(`DELETE FROM modules WHERE course_id = $1`, [courseId]);
  let i = 0;
  for (const m of modules) await insertModule(client, courseId, m, i++);
}

/* -------------------------- regeneración de IDs ----------------------------- */

/** Reemplaza recursivamente valores string que sean IDs viejos por los nuevos. */
function remap(value: any, map: Map<string, string>): any {
  if (typeof value === 'string') return map.get(value) ?? value;
  if (Array.isArray(value)) return value.map((v) => remap(v, map));
  if (value && typeof value === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(value)) out[k] = k === 'id' ? map.get(v as string) ?? v : remap(v, map);
    return out;
  }
  return value;
}

/** Asigna IDs nuevos a módulos, lecciones, pantallas y componentes, manteniendo las referencias internas. */
export function regenerateIds<T extends ModuleData[] | LessonData[] | ScreenData[] | ComponentData[]>(items: T, kind: 'modules' | 'lessons' | 'screens' | 'components'): T {
  const map = new Map<string, string>();
  const visitComp = (c: ComponentData) => map.set(c.id, uid(8));
  const visitScreen = (s: ScreenData) => { map.set(s.id, uid(10)); s.components.forEach(visitComp); };
  const visitLesson = (l: LessonData) => { map.set(l.id, uid(10)); l.screens.forEach(visitScreen); };
  const visitModule = (m: ModuleData) => { map.set(m.id, uid(10)); m.lessons.forEach(visitLesson); };
  (items as any[]).forEach((it) => {
    if (kind === 'modules') visitModule(it);
    else if (kind === 'lessons') visitLesson(it);
    else if (kind === 'screens') visitScreen(it);
    else visitComp(it);
  });
  return remap(items, map);
}

/* ----------------------------- creación desde doc ---------------------------- */

export interface CreateFromDocOptions {
  userId: string;
  title?: string;
  status?: 'draft' | 'published';
  categoryId?: number | null;
  themeId?: string | null;
  version?: string;
}

async function categoryIdByName(client: Db, name?: string): Promise<number | null> {
  if (!name) return null;
  const r = await one(`SELECT id FROM categories WHERE lower(name) = lower($1)`, [name], client);
  return r?.id ?? null;
}

/** Crea un curso nuevo a partir de un CourseDoc (importación, duplicado, plantilla, versión). */
export async function createCourseFromDoc(doc: CourseDoc, opts: CreateFromDocOptions, client?: PoolClient): Promise<string> {
  const run = async (cl: PoolClient) => {
    const clean = sanitizeDoc(JSON.parse(JSON.stringify(doc)) as CourseDoc);
    const modules = regenerateIds(clean.modules || [], 'modules');
    const catId = opts.categoryId !== undefined ? opts.categoryId : await categoryIdByName(cl, clean.category);
    const row = await one(
      `INSERT INTO courses (title, description, author, category_id, cover_image, duration, level, language, version, objectives, requirements, status, theme_id, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14) RETURNING id`,
      [
        (opts.title || clean.title || 'Curso sin título').slice(0, 200),
        clean.description || '',
        clean.author || '',
        catId,
        clean.coverImage || null,
        clean.duration || '',
        clean.level || 'Básico',
        clean.language || 'es',
        opts.version || clean.version || '1.0',
        JSON.stringify(clean.objectives || []),
        JSON.stringify(clean.requirements || []),
        opts.status || 'draft',
        opts.themeId ?? null,
        opts.userId,
      ],
      cl
    );
    const settings = { ...defaultCourseSettings(), ...(clean.settings || {}) };
    await cl.query(`INSERT INTO course_settings (course_id, settings) VALUES ($1, $2)`, [row.id, settings]);
    let i = 0;
    for (const m of modules) await insertModule(cl, row.id, m, i++);
    return row.id as string;
  };
  return client ? run(client) : tx(run);
}

export async function touchCourse(courseId: string, userId: string | undefined, db: Db = pool) {
  await db.query(`UPDATE courses SET updated_at = now(), updated_by = COALESCE($2, updated_by) WHERE id = $1`, [courseId, userId || null]);
}

export async function courseIdOfScreen(screenId: string, db: Db = pool): Promise<string> {
  const r = await one(`SELECT m.course_id FROM screens s JOIN lessons l ON l.id = s.lesson_id JOIN modules m ON m.id = l.module_id WHERE s.id = $1`, [screenId], db);
  if (!r) throw notFound('Pantalla');
  return r.course_id;
}

export async function courseIdOfLesson(lessonId: string, db: Db = pool): Promise<string> {
  const r = await one(`SELECT m.course_id FROM lessons l JOIN modules m ON m.id = l.module_id WHERE l.id = $1`, [lessonId], db);
  if (!r) throw notFound('Lección');
  return r.course_id;
}

export async function courseIdOfModule(moduleId: string, db: Db = pool): Promise<string> {
  const r = await one(`SELECT course_id FROM modules WHERE id = $1`, [moduleId], db);
  if (!r) throw notFound('Módulo');
  return r.course_id;
}

export async function getScreen(screenId: string, db: Db = pool): Promise<ScreenData> {
  const s = await one(`SELECT * FROM screens WHERE id = $1`, [screenId], db);
  if (!s) throw notFound('Pantalla');
  const comps = await query(`SELECT * FROM screen_components WHERE screen_id = $1 ORDER BY position`, [screenId], db);
  return rowToScreen(s, comps.map(rowToComponent));
}

export async function getLessonDoc(lessonId: string, db: Db = pool): Promise<LessonData> {
  const l = await one(`SELECT * FROM lessons WHERE id = $1`, [lessonId], db);
  if (!l) throw notFound('Lección');
  const screens = await query(`SELECT id FROM screens WHERE lesson_id = $1 ORDER BY position`, [lessonId], db);
  const out: ScreenData[] = [];
  for (const s of screens) out.push(await getScreen(s.id, db));
  return { id: l.id, title: l.title, description: l.description, screens: out };
}

export async function getModuleDoc(moduleId: string, db: Db = pool): Promise<ModuleData> {
  const m = await one(`SELECT * FROM modules WHERE id = $1`, [moduleId], db);
  if (!m) throw notFound('Módulo');
  const lessons = await query(`SELECT id FROM lessons WHERE module_id = $1 ORDER BY position`, [moduleId], db);
  const out: LessonData[] = [];
  for (const l of lessons) out.push(await getLessonDoc(l.id, db));
  return { id: m.id, title: m.title, description: m.description, lessons: out };
}

/** Desplaza posiciones para insertar después de un elemento */
export async function shiftPositions(client: Db, table: 'modules' | 'lessons' | 'screens', parentCol: string, parentId: string, fromPos: number) {
  await client.query(`UPDATE ${table} SET position = position + 1 WHERE ${parentCol} = $1 AND position >= $2`, [parentId, fromPos]);
}
