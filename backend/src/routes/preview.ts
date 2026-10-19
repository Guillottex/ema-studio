import { Router } from 'express';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { planScormPackage, type PackagePlan } from '@engine';
import { config } from '../config';
import { ah, HttpError } from '../middleware/error';
import { authenticate } from '../middleware/auth';
import { assembleCourse, getCourseRow } from '../services/courseTree';
import { readPlanFile } from '../services/scormExport';

/**
 * Previsualización: sirve el mismo paquete que se exporta como SCORM, pero generado al vuelo
 * desde la base de datos (sin crear el ZIP). La URL lleva un token firmado de corta duración
 * para que el iframe pueda cargar todos los archivos relativos.
 */
export const previewTokenRouter = Router();
export const previewRouter = Router();

const cache = new Map<string, { plan: PackagePlan; at: number }>();

previewTokenRouter.post('/courses/:id/preview-token', authenticate, ah(async (req, res) => {
  await getCourseRow(req.params.id);
  const token = jwt.sign({ typ: 'preview', cid: req.params.id, sub: req.user!.id }, config.jwtSecret, { expiresIn: '4h' });
  res.json({ token, url: `/api/preview/${token}/index.html` });
}));

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.pdf': 'application/pdf', '.woff2': 'font/woff2',
};

previewRouter.get('/:token/*', ah(async (req, res) => {
  let payload: any;
  try {
    payload = jwt.verify(req.params.token, config.jwtSecret);
  } catch {
    throw new HttpError(401, 'La previsualización venció. Volvé a abrirla desde el editor.');
  }
  if (payload.typ !== 'preview') throw new HttpError(401, 'Token inválido');
  const rel = (req.params as any)[0] || 'index.html';
  if (rel.includes('..')) throw new HttpError(400, 'Ruta inválida');
  let entry = cache.get(req.params.token);
  // el índice y los datos del curso siempre se regeneran para reflejar los últimos cambios
  if (!entry || rel === 'index.html' || rel === 'js/course-data.js' || Date.now() - entry.at > 60_000) {
    entry = { plan: planScormPackage(await assembleCourse(payload.cid)), at: Date.now() };
    cache.set(req.params.token, entry);
    if (cache.size > 200) cache.delete(cache.keys().next().value!);
  }
  const f = readPlanFile(entry.plan, rel);
  if (!f) throw new HttpError(404, 'Archivo no encontrado en el paquete');
  res.setHeader('Content-Type', MIME[path.extname(rel).toLowerCase()] || 'application/octet-stream');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (f.file) {
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.sendFile(f.file);
  }
  res.setHeader('Cache-Control', 'no-store');
  res.send(f.body);
}));
