import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { one, query } from '../db';
import { ah, HttpError, notFound } from '../middleware/error';
import { requirePerm } from '../middleware/auth';

const r = Router();

r.get('/roles', ah(async (_req, res) => {
  res.json(await query(`SELECT id, name, label, permissions FROM roles ORDER BY id`));
}));

r.get('/', requirePerm('users.manage'), ah(async (_req, res) => {
  res.json(await query(`SELECT u.id, u.email, u.name, u.active, u.last_login_at, u.created_at, r.name AS role, r.label AS role_label,
    (SELECT count(*)::int FROM courses c WHERE c.created_by = u.id) AS courses
    FROM users u JOIN roles r ON r.id = u.role_id ORDER BY u.created_at`));
}));

const userSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(120),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  role: z.enum(['admin', 'author', 'viewer']),
  active: z.boolean().optional(),
});

r.post('/', requirePerm('users.manage'), ah(async (req, res) => {
  const b = userSchema.parse(req.body);
  const role = await one(`SELECT id FROM roles WHERE name = $1`, [b.role]);
  const u = await one(
    `INSERT INTO users (email, name, password_hash, role_id, active) VALUES (lower($1),$2,$3,$4,$5) RETURNING id, email, name, active`,
    [b.email, b.name, await bcrypt.hash(b.password, 10), role!.id, b.active ?? true]
  );
  res.status(201).json(u);
}));

r.patch('/:id', requirePerm('users.manage'), ah(async (req, res) => {
  const b = userSchema.partial().parse(req.body);
  const cur = await one(`SELECT u.id, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`, [req.params.id]);
  if (!cur) throw notFound('Usuario');
  if (req.params.id === req.user!.id && ((b.role && b.role !== 'admin') || b.active === false)) throw new HttpError(400, 'No podés quitarte el rol de administrador ni desactivarte');
  const sets: string[] = [];
  const vals: any[] = [req.params.id];
  const add = (col: string, v: any) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
  if (b.email) add('email', b.email.toLowerCase());
  if (b.name) add('name', b.name);
  if (b.active !== undefined) add('active', b.active);
  if (b.password) add('password_hash', await bcrypt.hash(b.password, 10));
  if (b.role) add('role_id', (await one(`SELECT id FROM roles WHERE name = $1`, [b.role]))!.id);
  if (sets.length) await query(`UPDATE users SET ${sets.join(', ')}, updated_at = now() WHERE id = $1`, vals);
  res.json(await one(`SELECT u.id, u.email, u.name, u.active, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`, [req.params.id]));
}));

r.delete('/:id', requirePerm('users.manage'), ah(async (req, res) => {
  if (req.params.id === req.user!.id) throw new HttpError(400, 'No podés eliminar tu propio usuario');
  const admins = await one(`SELECT count(*)::int AS n FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'admin' AND u.active AND u.id <> $1`, [req.params.id]);
  if (!admins || admins.n < 1) throw new HttpError(400, 'Debe quedar al menos un administrador');
  await query(`DELETE FROM users WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
}));

export default r;
