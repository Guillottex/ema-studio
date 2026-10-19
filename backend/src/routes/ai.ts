import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { one } from '../db';
import { ah, HttpError } from '../middleware/error';
import { requirePerm } from '../middleware/auth';
import { createCourseFromDoc } from '../services/courseTree';
import { aiStatus, getProvider, outlineToDoc, structureOutline, textToOutline, extractText } from '../services/ai';
import { DEFAULT_THEME, type Theme } from '@engine';

const r = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });

async function themeFor(themeId?: string | null): Promise<Theme> {
  if (!themeId) return DEFAULT_THEME;
  const t = await one(`SELECT data FROM themes WHERE id = $1`, [themeId]);
  return (t?.data as Theme) || DEFAULT_THEME;
}

r.get('/status', (_req, res) => {
  res.json({ ...aiStatus(), importFormats: ['txt', 'md', 'docx', 'pdf'] });
});

const briefSchema = z.object({
  prompt: z.string().min(5, 'Describí el curso que querés crear').max(4000),
  audience: z.string().max(300).optional(),
  duration: z.string().max(60).optional(),
  level: z.string().max(60).optional(),
  modules: z.number().int().min(1).max(12).optional(),
  language: z.string().max(20).optional(),
  mode: z.enum(['ai', 'structure']).default('structure'),
  themeId: z.string().uuid().nullable().optional(),
});

/** Genera un curso completo (con IA, o sólo la estructura sin IA) y lo deja listo para editar */
r.post('/generate-course', requirePerm('courses.create'), ah(async (req, res) => {
  const b = briefSchema.parse(req.body);
  const outline = b.mode === 'ai' ? await getProvider().generateCourse(b) : structureOutline(b);
  const doc = outlineToDoc(outline, await themeFor(b.themeId));
  doc.duration = b.duration || '';
  doc.level = b.level || 'Básico';
  doc.author = req.user!.name;
  const courseId = await createCourseFromDoc(doc, { userId: req.user!.id, themeId: b.themeId ?? null });
  res.status(201).json({ courseId, mode: b.mode });
}));

/** Crea un curso a partir de un documento (txt, md, docx, pdf) o texto pegado */
r.post('/import-content', requirePerm('courses.create'), upload.single('file'), ah(async (req, res) => {
  let content = typeof req.body.text === 'string' ? req.body.text : '';
  let title = typeof req.body.title === 'string' && req.body.title.trim() ? req.body.title.trim() : '';
  if (req.file) {
    const name = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    content = await extractText(name, req.file.buffer);
    if (!title) title = name.replace(/\.[^.]+$/, '');
  }
  if (!content.trim()) throw new HttpError(400, 'No hay contenido para importar');
  const useAI = req.body.useAI === 'true' || req.body.useAI === true;
  const outline = useAI
    ? await getProvider().generateCourse({ prompt: `Convertí este contenido en un curso (respetá el contenido original):\n\n${content.slice(0, 25000)}`, language: 'español' })
    : textToOutline(content, title || 'Curso importado');
  if (title) outline.title = title;
  const doc = outlineToDoc(outline, await themeFor(req.body.themeId || null));
  doc.author = req.user!.name;
  const courseId = await createCourseFromDoc(doc, { userId: req.user!.id });
  res.status(201).json({ courseId, modules: outline.modules.length });
}));

r.post('/questions', requirePerm('questions.manage'), ah(async (req, res) => {
  const b = z.object({ text: z.string().min(20).max(30000), count: z.number().int().min(1).max(20).default(5) }).parse(req.body);
  res.json(await getProvider().generateQuestions(b.text, b.count));
}));

r.post('/summarize', requirePerm('courses.edit'), ah(async (req, res) => {
  const b = z.object({ text: z.string().min(20).max(30000) }).parse(req.body);
  res.json({ summary: await getProvider().summarize(b.text) });
}));

export default r;
