import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { one, query } from '../db';
import { ah, HttpError } from '../middleware/error';
import { authenticate, signToken } from '../middleware/auth';

const r = Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { error: 'Demasiados intentos. Probá nuevamente en unos minutos.' } });

r.post('/login', loginLimiter, ah(async (req, res) => {
  const body = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
  const u = await one(
    `SELECT u.*, r.name AS role, r.permissions FROM users u JOIN roles r ON r.id = u.role_id WHERE lower(u.email) = lower($1)`,
    [body.email]
  );
  if (!u || !u.active || !(await bcrypt.compare(body.password, u.password_hash))) throw new HttpError(401, 'Email o contraseña incorrectos');
  await query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [u.id]);
  res.json({
    token: signToken(u.id),
    user: { id: u.id, email: u.email, name: u.name, role: u.role, permissions: u.permissions, preferences: u.preferences },
  });
}));

r.get('/me', authenticate, ah(async (req, res) => {
  const u = await one(`SELECT preferences FROM users WHERE id = $1`, [req.user!.id]);
  res.json({ ...req.user, preferences: u?.preferences || {} });
}));

r.put('/preferences', authenticate, ah(async (req, res) => {
  const prefs = z.object({ theme: z.enum(['light', 'dark', 'system']).optional(), editorGrid: z.boolean().optional(), editorSnap: z.boolean().optional() }).passthrough().parse(req.body);
  const u = await one(`UPDATE users SET preferences = preferences || $2::jsonb, updated_at = now() WHERE id = $1 RETURNING preferences`, [req.user!.id, JSON.stringify(prefs)]);
  res.json(u!.preferences);
}));

r.post('/password', authenticate, ah(async (req, res) => {
  const body = z.object({ current: z.string().min(1), next: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres') }).parse(req.body);
  const u = await one(`SELECT password_hash FROM users WHERE id = $1`, [req.user!.id]);
  if (!u || !(await bcrypt.compare(body.current, u.password_hash))) throw new HttpError(400, 'La contraseña actual no es correcta');
  await query(`UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1`, [req.user!.id, await bcrypt.hash(body.next, 10)]);
  res.json({ ok: true });
}));

export default r;
