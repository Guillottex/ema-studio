import { Router } from 'express';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { uid, validateQuestion, type Question } from '@engine';
import { query, one, tx } from '../db';
import { ah, HttpError, notFound } from '../middleware/error';
import { requirePerm } from '../middleware/auth';
import { cleanHtml } from '../services/sanitize';

const r = Router();
const manage = requirePerm('questions.manage');

export function rowToQuestion(row: any, options: any[]): Question & { categoryId: number | null; category?: string; createdAt?: string } {
  const extra = row.extra || {};
  return {
    id: row.id,
    type: row.type,
    prompt: row.prompt,
    media: row.media || null,
    options: options.filter((o) => o.question_id === row.id).sort((a, b) => a.position - b.position).map((o) => ({ id: o.option_key, text: o.text, correct: o.is_correct, match: o.match_text || undefined, feedback: o.feedback || undefined })),
    fillText: extra.fillText,
    acceptedAnswers: extra.acceptedAnswers,
    caseSensitive: !!extra.caseSensitive,
    partialCredit: !!extra.partialCredit,
    points: Number(row.points),
    feedbackCorrect: row.feedback_correct,
    feedbackIncorrect: row.feedback_incorrect,
    explanation: row.explanation,
    attempts: row.attempts,
    shuffle: row.shuffle,
    timeLimit: row.time_limit,
    categoryId: row.category_id,
    category: row.category_name,
    createdAt: row.created_at,
  };
}

const questionSchema = z.object({
  type: z.enum(['single', 'truefalse', 'multiple', 'order', 'match', 'fill', 'short']),
  prompt: z.string().min(1).max(5000),
  media: z.object({ kind: z.enum(['image', 'audio', 'video']), src: z.string() }).nullable().optional(),
  options: z.array(z.object({ id: z.string().optional(), text: z.string().max(1000), correct: z.boolean().optional(), match: z.string().max(1000).optional(), feedback: z.string().max(1000).optional() })).default([]),
  fillText: z.string().max(5000).optional(),
  acceptedAnswers: z.array(z.string().max(300)).optional(),
  caseSensitive: z.boolean().optional(),
  partialCredit: z.boolean().optional(),
  points: z.number().min(0).max(1000).default(1),
  feedbackCorrect: z.string().max(1000).default(''),
  feedbackIncorrect: z.string().max(1000).default(''),
  explanation: z.string().max(3000).default(''),
  attempts: z.number().int().min(0).max(20).default(1),
  shuffle: z.boolean().default(true),
  timeLimit: z.number().int().min(0).max(3600).default(0),
  categoryId: z.number().int().nullable().optional(),
});

async function saveQuestion(cl: PoolClient, id: string | null, b: z.infer<typeof questionSchema>, userId: string): Promise<string> {
  const issues = validateQuestion({ ...(b as any), id: 'x', options: b.options.map((o) => ({ ...o, id: o.id || 'x' })) });
  if (issues.length) throw new HttpError(400, issues.join('. '));
  const extra = { fillText: b.fillText, acceptedAnswers: b.acceptedAnswers, caseSensitive: b.caseSensitive, partialCredit: b.partialCredit };
  const vals = [cleanHtml(b.prompt), b.type, b.categoryId ?? null, b.points, b.feedbackCorrect, b.feedbackIncorrect, b.explanation, b.attempts, b.shuffle, b.timeLimit, b.media || null, extra];
  let qid = id;
  if (id) {
    const row = await one(`UPDATE questions SET prompt=$2, type=$3, category_id=$4, points=$5, feedback_correct=$6, feedback_incorrect=$7, explanation=$8, attempts=$9, shuffle=$10, time_limit=$11, media=$12, extra=$13, updated_at=now() WHERE id=$1 RETURNING id`, [id, ...vals], cl);
    if (!row) throw notFound('Pregunta');
    await cl.query(`DELETE FROM question_options WHERE question_id = $1`, [id]);
  } else {
    qid = (await one(`INSERT INTO questions (prompt, type, category_id, points, feedback_correct, feedback_incorrect, explanation, attempts, shuffle, time_limit, media, extra, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`, [...vals, userId], cl))!.id;
  }
  for (const [i, o] of b.options.entries()) {
    await cl.query(`INSERT INTO question_options (question_id, option_key, text, is_correct, match_text, feedback, position) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [qid, o.id || uid(6), o.text, !!o.correct, o.match ?? null, o.feedback ?? null, i]);
  }
  return qid!;
}

export async function loadQuestions(ids?: string[], filters: { q?: string; type?: string; category?: string } = {}) {
  const vals: any[] = [];
  const where: string[] = [];
  if (ids) { vals.push(ids); where.push(`q.id = ANY($${vals.length})`); }
  if (filters.q) { vals.push(`%${filters.q}%`); where.push(`q.prompt ILIKE $${vals.length}`); }
  if (filters.type) { vals.push(filters.type); where.push(`q.type = $${vals.length}`); }
  if (filters.category) { vals.push(Number(filters.category)); where.push(`q.category_id = $${vals.length}`); }
  const rows = await query(`SELECT q.*, c.name AS category_name FROM questions q LEFT JOIN categories c ON c.id = q.category_id ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY q.created_at DESC`, vals);
  const opts = rows.length ? await query(`SELECT * FROM question_options WHERE question_id = ANY($1)`, [rows.map((x) => x.id)]) : [];
  return rows.map((row) => rowToQuestion(row, opts));
}

r.get('/questions', ah(async (req, res) => {
  res.json(await loadQuestions(undefined, req.query as any));
}));

r.get('/questions/:id', ah(async (req, res) => {
  const [q] = await loadQuestions([req.params.id]);
  if (!q) throw notFound('Pregunta');
  res.json(q);
}));

r.post('/questions', manage, ah(async (req, res) => {
  const b = questionSchema.parse(req.body);
  const id = await tx((cl) => saveQuestion(cl, null, b, req.user!.id));
  res.status(201).json((await loadQuestions([id]))[0]);
}));

r.put('/questions/:id', manage, ah(async (req, res) => {
  const b = questionSchema.parse(req.body);
  await tx((cl) => saveQuestion(cl, req.params.id, b, req.user!.id));
  res.json((await loadQuestions([req.params.id]))[0]);
}));

r.post('/questions/:id/duplicate', manage, ah(async (req, res) => {
  const [q] = await loadQuestions([req.params.id]);
  if (!q) throw notFound('Pregunta');
  const id = await tx((cl) => saveQuestion(cl, null, questionSchema.parse({ ...q, prompt: q.prompt + ' (copia)', options: q.options.map((o) => ({ ...o, id: uid(6) })) }), req.user!.id));
  res.status(201).json((await loadQuestions([id]))[0]);
}));

r.delete('/questions/:id', manage, ah(async (req, res) => {
  await query(`DELETE FROM questions WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
}));

/* -------------------------------- evaluaciones -------------------------------- */

const quizSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).default(''),
  settings: z.object({
    passingScore: z.number().min(0).max(100).default(70),
    attempts: z.number().int().min(0).max(50).default(2),
    timeLimit: z.number().int().min(0).max(600).default(0),
    drawCount: z.number().int().min(0).default(0),
    randomize: z.boolean().default(false),
    showAnswers: z.boolean().default(true),
    showResult: z.boolean().default(true),
    passMessage: z.string().max(1000).default('¡Felicitaciones! Aprobaste la evaluación.'),
    failMessage: z.string().max(1000).default('No alcanzaste el puntaje mínimo.'),
  }).default({}),
  questionIds: z.array(z.string().uuid()).default([]),
});

r.get('/quizzes', ah(async (_req, res) => {
  res.json(await query(`SELECT z.*, (SELECT count(*)::int FROM quiz_questions qq WHERE qq.quiz_id = z.id) AS questions, u.name AS created_by_name FROM quizzes z LEFT JOIN users u ON u.id = z.created_by ORDER BY z.created_at DESC`));
}));

r.get('/quizzes/:id', ah(async (req, res) => {
  const z1 = await one(`SELECT * FROM quizzes WHERE id = $1`, [req.params.id]);
  if (!z1) throw notFound('Evaluación');
  const ids = (await query(`SELECT question_id FROM quiz_questions WHERE quiz_id = $1 ORDER BY position`, [req.params.id])).map((x) => x.question_id);
  const qs = await loadQuestions(ids);
  res.json({ ...z1, questions: ids.map((id) => qs.find((q) => q.id === id)).filter(Boolean) });
}));

async function saveQuiz(cl: PoolClient, id: string | null, b: z.infer<typeof quizSchema>, userId: string) {
  let qid = id;
  if (id) {
    const row = await one(`UPDATE quizzes SET title=$2, description=$3, settings=$4, updated_at=now() WHERE id=$1 RETURNING id`, [id, b.title, b.description, b.settings], cl);
    if (!row) throw notFound('Evaluación');
    await cl.query(`DELETE FROM quiz_questions WHERE quiz_id = $1`, [id]);
  } else {
    qid = (await one(`INSERT INTO quizzes (title, description, settings, created_by) VALUES ($1,$2,$3,$4) RETURNING id`, [b.title, b.description, b.settings, userId], cl))!.id;
  }
  for (const [i, q] of [...new Set(b.questionIds)].entries()) await cl.query(`INSERT INTO quiz_questions (quiz_id, question_id, position) VALUES ($1,$2,$3)`, [qid, q, i]);
  return qid!;
}

r.post('/quizzes', manage, ah(async (req, res) => {
  const b = quizSchema.parse(req.body);
  res.status(201).json({ id: await tx((cl) => saveQuiz(cl, null, b, req.user!.id)) });
}));

r.put('/quizzes/:id', manage, ah(async (req, res) => {
  const b = quizSchema.parse(req.body);
  res.json({ id: await tx((cl) => saveQuiz(cl, req.params.id, b, req.user!.id)) });
}));

r.post('/quizzes/:id/duplicate', manage, ah(async (req, res) => {
  const z1 = await one(`SELECT * FROM quizzes WHERE id = $1`, [req.params.id]);
  if (!z1) throw notFound('Evaluación');
  const ids = (await query(`SELECT question_id FROM quiz_questions WHERE quiz_id = $1 ORDER BY position`, [req.params.id])).map((x) => x.question_id);
  const b = quizSchema.parse({ title: `${z1.title} (copia)`, description: z1.description, settings: z1.settings, questionIds: ids });
  res.status(201).json({ id: await tx((cl) => saveQuiz(cl, null, b, req.user!.id)) });
}));

r.delete('/quizzes/:id', manage, ah(async (req, res) => {
  await query(`DELETE FROM quizzes WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
}));

export default r;
