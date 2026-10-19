import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import { PRESET_THEMES, LAYOUTS, layoutThumbSvg, newQuiz, type CourseDoc } from '@engine';
import { pool, one, query, tx } from '../db';
import { config } from '../config';
import { logger } from '../logger';
import { ROLE_PERMISSIONS } from '../middleware/auth';
import { storeMedia } from '../services/media';
import { createCourseFromDoc } from '../services/courseTree';
import { buildDemoCourse, bankQuestions } from './demoCourse';
import { courseTemplates, screenTemplates } from './templates';

async function flag(key: string): Promise<boolean> {
  return !!(await one(`SELECT 1 FROM app_settings WHERE key = $1`, [key]));
}
async function setFlag(key: string) {
  await query(`INSERT INTO app_settings (key, value) VALUES ($1, 'true') ON CONFLICT (key) DO NOTHING`, [key]);
}

export async function seedRoles() {
  const labels: Record<string, string> = { admin: 'Administrador', author: 'Autor', viewer: 'Visualizador' };
  for (const [name, perms] of Object.entries(ROLE_PERMISSIONS)) {
    await query(`INSERT INTO roles (name, label, permissions) VALUES ($1,$2,$3) ON CONFLICT (name) DO UPDATE SET label = EXCLUDED.label, permissions = EXCLUDED.permissions`, [name, labels[name], JSON.stringify(perms)]);
  }
}

export async function createAdmin(email: string, password: string, name: string) {
  const role = await one(`SELECT id FROM roles WHERE name = 'admin'`);
  const hash = await bcrypt.hash(password, 10);
  return one(
    `INSERT INTO users (email, name, password_hash, role_id) VALUES (lower($1),$2,$3,$4)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role_id = EXCLUDED.role_id, active = TRUE RETURNING id, email`,
    [email, name, hash, role!.id]
  );
}

async function seedDemoMedia(userId: string): Promise<Record<string, string>> {
  const dir = config.seedMediaDir;
  const out: Record<string, string> = {};
  if (!fs.existsSync(dir)) {
    logger.warn(`No se encontró la carpeta de medios de demo (${dir})`);
    return out;
  }
  for (const f of fs.readdirSync(dir)) {
    const row = await storeMedia(f, fs.readFileSync(path.join(dir, f)), userId);
    out[f] = `asset:${row.stored_name}`;
  }
  // versiones raster (JPG/PNG) generadas a partir de los SVG, para mostrar la optimización de imágenes
  const raster: [string, string, 'jpeg' | 'png'][] = [['excel-portada.svg', 'excel-portada.jpg', 'jpeg'], ['excel-grafico.svg', 'excel-grafico.png', 'png']];
  for (const [src, name, fmt] of raster) {
    const p = path.join(dir, src);
    if (!fs.existsSync(p)) continue;
    const img = sharp(fs.readFileSync(p), { density: 144 }).resize({ width: 1600 });
    const buf = fmt === 'jpeg' ? await img.jpeg({ quality: 84, mozjpeg: true }).toBuffer() : await img.png({ compressionLevel: 9 }).toBuffer();
    const row = await storeMedia(name, buf, userId);
    out[name] = `asset:${row.stored_name}`;
  }
  // Logo oficial de EMA Servicios (www.emaservicios.com.ar). Si no hay conexión se usa el logo alternativo de la demo.
  const brandUrl = process.env.BRAND_LOGO_URL ?? 'https://www.emaservicios.com.ar/images/logo-color.png';
  if (brandUrl) {
    try {
      const r = await fetch(brandUrl, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const row = await storeMedia('logo-ema-servicios.png', Buffer.from(await r.arrayBuffer()), userId);
      out['logo-ema-servicios.png'] = `asset:${row.stored_name}`;
      logger.info('Logo de EMA Servicios incorporado a la biblioteca');
    } catch (e: any) {
      logger.warn(`No se pudo descargar el logo de marca (${e.message}); se usa el logo alternativo`);
    }
  }
  return out;
}

export async function seed() {
  await seedRoles();

  // Usuario administrador inicial
  const users = await one(`SELECT count(*)::int AS n FROM users`);
  let adminId: string;
  if (!users || users.n === 0) {
    const u = await createAdmin(config.admin.email, config.admin.password, config.admin.name);
    adminId = u!.id;
    logger.info(`Usuario administrador creado: ${config.admin.email}`);
  } else {
    adminId = (await one(`SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'admin' ORDER BY u.created_at LIMIT 1`))?.id;
  }

  // Temas predefinidos
  for (const t of PRESET_THEMES) {
    await query(`INSERT INTO themes (slug, name, data, is_preset) VALUES ($1,$2,$3,TRUE) ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, data = EXCLUDED.data`, [t.id, t.name, t]);
  }

  // Layouts del sistema
  for (const [i, l] of LAYOUTS.entries()) {
    await query(
      `INSERT INTO layouts (id, name, description, thumbnail, data, is_system, sort) VALUES ($1,$2,$3,$4,$5,TRUE,$6)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, thumbnail = EXCLUDED.thumbnail, data = EXCLUDED.data, sort = EXCLUDED.sort`,
      [l.id, l.name, l.description, layoutThumbSvg(l), l.build(), i]
    );
  }

  // Categorías
  if (!(await flag('seed.categories'))) {
    for (const [name, color] of [['Ofimática', '#107c41'], ['Seguridad e Higiene', '#ea580c'], ['Recursos Humanos', '#6d28d9'], ['Atención al cliente', '#0891b2'], ['Procesos', '#475569']]) {
      await query(`INSERT INTO categories (name, color) VALUES ($1,$2) ON CONFLICT (name) DO NOTHING`, [name, color]);
    }
    await setFlag('seed.categories');
  }

  // Plantillas del sistema
  if (!(await flag('seed.templates'))) {
    for (const t of courseTemplates()) {
      await query(`INSERT INTO templates (kind, name, description, category, thumbnail, data, is_system) VALUES ('course',$1,$2,$3,$4,$5,TRUE)`, [t.name, t.description, t.category, t.thumbnail, t.data]);
    }
    for (const t of screenTemplates()) {
      await query(`INSERT INTO templates (kind, name, description, category, data, is_system) VALUES ('screen',$1,$2,'Sistema',$3,TRUE)`, [t.name, t.description, t.data]);
    }
    await setFlag('seed.templates');
    logger.info('Plantillas del sistema creadas');
  }

  // Curso de demostración + banco de preguntas
  if (config.seedDemo && adminId && !(await flag('seed.demo'))) {
    const assets = await seedDemoMedia(adminId);
    const doc: CourseDoc = buildDemoCourse(assets);
    const theme = await one(`SELECT id FROM themes WHERE slug = 'ema-servicios'`);
    const courseId = await createCourseFromDoc(doc, { userId: adminId, status: 'published', themeId: theme?.id ?? null });
    await query(`UPDATE courses SET version = '1.0' WHERE id = $1`, [courseId]);

    const cat = await one(`SELECT id FROM categories WHERE name = 'Ofimática'`);
    const ids: string[] = [];
    await tx(async (cl) => {
      for (const [i, q] of bankQuestions().entries()) {
        const row = await one(
          `INSERT INTO questions (type, prompt, category_id, points, feedback_correct, feedback_incorrect, explanation, attempts, shuffle, time_limit, media, extra, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
          [q.type, q.prompt, cat?.id ?? null, q.points, q.feedbackCorrect || '', q.feedbackIncorrect || '', q.explanation || '', q.attempts, q.shuffle ?? true, 0, null, { fillText: q.fillText, acceptedAnswers: q.acceptedAnswers, partialCredit: q.partialCredit }, adminId],
          cl
        );
        ids.push(row.id);
        for (const [j, o] of q.options.entries()) {
          await cl.query(`INSERT INTO question_options (question_id, option_key, text, is_correct, match_text, position) VALUES ($1,$2,$3,$4,$5,$6)`, [row.id, o.id, o.text, !!o.correct, o.match ?? null, j]);
        }
        void i;
      }
      const z = newQuiz();
      const quiz = await one(`INSERT INTO quizzes (title, description, settings, created_by) VALUES ($1,$2,$3,$4) RETURNING id`, ['Repaso de Excel (banco)', 'Evaluación reutilizable armada con preguntas del banco.', { passingScore: z.passingScore, attempts: 2, timeLimit: 0, drawCount: 0, randomize: true, showAnswers: true, showResult: true, passMessage: z.passMessage, failMessage: z.failMessage }, adminId], cl);
      for (const [i, id] of ids.entries()) await cl.query(`INSERT INTO quiz_questions (quiz_id, question_id, position) VALUES ($1,$2,$3)`, [quiz.id, id, i]);
    });
    await setFlag('seed.demo');
    logger.info('Curso de demostración "Excel Básico" creado');
  }
}

