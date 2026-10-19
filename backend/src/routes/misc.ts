import { Router } from 'express';
import { z } from 'zod';
import { query, one } from '../db';
import { ah } from '../middleware/error';
import { requirePerm } from '../middleware/auth';
import { config } from '../config';

const r = Router();

/** Estadísticas del dashboard */
r.get('/dashboard', ah(async (_req, res) => {
  const stats = await one(`SELECT
    (SELECT count(*)::int FROM courses) AS courses,
    (SELECT count(*)::int FROM courses WHERE status = 'published') AS published,
    (SELECT count(*)::int FROM courses WHERE status = 'draft') AS drafts,
    (SELECT count(*)::int FROM modules) AS modules,
    (SELECT count(*)::int FROM lessons) AS lessons,
    (SELECT count(*)::int FROM screens) AS screens,
    (SELECT count(*)::int FROM questions) AS questions,
    (SELECT count(*)::int FROM media) AS media,
    (SELECT COALESCE(sum(size),0)::bigint FROM media) AS media_bytes,
    (SELECT count(*)::int FROM scorm_exports) AS exports,
    (SELECT count(*)::int FROM templates) AS templates,
    (SELECT count(*)::int FROM users WHERE active) AS users`);
  const recent = await query(`SELECT c.id, c.title, c.status, c.version, c.cover_image, c.updated_at, u.name AS updated_by_name,
      (SELECT count(*)::int FROM modules m WHERE m.course_id = c.id) AS modules
    FROM courses c LEFT JOIN users u ON u.id = c.updated_by ORDER BY c.updated_at DESC LIMIT 6`);
  const exportsRecent = await query(`SELECT e.id, e.file_name, e.size, e.created_at, c.title FROM scorm_exports e JOIN courses c ON c.id = e.course_id ORDER BY e.created_at DESC LIMIT 5`);
  const byCategory = await query(`SELECT COALESCE(cat.name, 'Sin categoría') AS name, COALESCE(cat.color, '#94a3b8') AS color, count(*)::int AS n FROM courses c LEFT JOIN categories cat ON cat.id = c.category_id GROUP BY 1,2 ORDER BY n DESC`);
  res.json({ stats, recent, exports: exportsRecent, byCategory });
}));

/** Buscador global */
r.get('/search', ah(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ courses: [], modules: [], lessons: [], screens: [], templates: [], media: [], questions: [] });
  const like = `%${q}%`;
  const [courses, modules, lessons, screens, templates, media, questions] = await Promise.all([
    query(`SELECT id, title, status FROM courses WHERE title ILIKE $1 OR description ILIKE $1 ORDER BY updated_at DESC LIMIT 8`, [like]),
    query(`SELECT m.id, m.title, c.id AS course_id, c.title AS course FROM modules m JOIN courses c ON c.id = m.course_id WHERE m.title ILIKE $1 LIMIT 8`, [like]),
    query(`SELECT l.id, l.title, c.id AS course_id, c.title AS course, (SELECT s.id FROM screens s WHERE s.lesson_id = l.id ORDER BY s.position LIMIT 1) AS screen_id
           FROM lessons l JOIN modules m ON m.id = l.module_id JOIN courses c ON c.id = m.course_id WHERE l.title ILIKE $1 LIMIT 8`, [like]),
    query(`SELECT DISTINCT ON (s.id) s.id, s.title, c.id AS course_id, c.title AS course, l.title AS lesson
           FROM screens s JOIN lessons l ON l.id = s.lesson_id JOIN modules m ON m.id = l.module_id JOIN courses c ON c.id = m.course_id
           LEFT JOIN screen_components sc ON sc.screen_id = s.id
           WHERE s.title ILIKE $1 OR sc.props::text ILIKE $1 LIMIT 10`, [like]),
    query(`SELECT id, name, kind FROM templates WHERE name ILIKE $1 OR description ILIKE $1 LIMIT 8`, [like]),
    query(`SELECT id, name, kind, stored_name, thumb_name FROM media WHERE name ILIKE $1 LIMIT 8`, [like]),
    query(`SELECT id, prompt, type FROM questions WHERE prompt ILIKE $1 LIMIT 8`, [like]),
  ]);
  res.json({ courses, modules, lessons, screens, templates, media, questions });
}));

/** Configuración general de la aplicación */
r.get('/settings', ah(async (_req, res) => {
  const rows = await query(`SELECT key, value FROM app_settings`);
  const s: Record<string, any> = Object.fromEntries(rows.map((x) => [x.key, x.value]));
  res.json({
    organization: s.organization || { name: 'EMA Servicios', defaultAuthor: '', defaultLanguage: 'es' },
    limits: { maxUploadMb: config.maxUploadMb, maxImageMb: config.maxImageMb, imageMaxWidth: config.imageMaxWidth },
    ai: { provider: config.ai.provider, configured: config.ai.provider !== 'none' && !!config.ai.apiKey, model: config.ai.model || null },
    cors: config.corsOrigin,
  });
}));

r.put('/settings', requirePerm('settings.manage'), ah(async (req, res) => {
  const b = z.object({ organization: z.object({ name: z.string().max(120), defaultAuthor: z.string().max(120).optional(), defaultLanguage: z.string().max(10).optional() }) }).parse(req.body);
  await query(`INSERT INTO app_settings (key, value) VALUES ('organization', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [b.organization]);
  res.json({ ok: true });
}));

export default r;
