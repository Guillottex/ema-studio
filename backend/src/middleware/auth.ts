import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { one } from '../db';
import { HttpError } from './error';

export type Permission =
  | 'users.manage' | 'courses.create' | 'courses.edit' | 'courses.delete' | 'courses.publish' | 'courses.export'
  | 'templates.manage' | 'templates.use' | 'media.upload' | 'questions.manage' | 'categories.manage'
  | 'themes.manage' | 'settings.manage' | 'view';

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: ['users.manage', 'courses.create', 'courses.edit', 'courses.delete', 'courses.publish', 'courses.export', 'templates.manage', 'templates.use', 'media.upload', 'questions.manage', 'categories.manage', 'themes.manage', 'settings.manage', 'view'],
  author: ['courses.create', 'courses.edit', 'courses.export', 'templates.use', 'media.upload', 'questions.manage', 'themes.manage', 'view'],
  viewer: ['view'],
};

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: Permission[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId, typ: 'access' }, config.jwtSecret, { expiresIn: config.jwtExpires as any });
}

export async function loadUser(id: string): Promise<AuthUser | null> {
  const u = await one(
    `SELECT u.id, u.email, u.name, u.active, r.name AS role, r.permissions FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
    [id]
  );
  if (!u || !u.active) return null;
  return { id: u.id, email: u.email, name: u.name, role: u.role, permissions: u.permissions };
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : '';
    if (!token) throw new HttpError(401, 'No autenticado');
    let payload: any;
    try {
      payload = jwt.verify(token, config.jwtSecret);
    } catch {
      throw new HttpError(401, 'Sesión vencida o inválida');
    }
    if (payload.typ !== 'access') throw new HttpError(401, 'Token inválido');
    const user = await loadUser(payload.sub);
    if (!user) throw new HttpError(401, 'Usuario inexistente o inactivo');
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
}

export const can = (user: AuthUser | undefined, p: Permission) => !!user && user.permissions.includes(p);

export function requirePerm(...perms: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, 'No autenticado'));
    if (!perms.every((p) => req.user!.permissions.includes(p))) return next(new HttpError(403, 'No tenés permisos para esta acción'));
    next();
  };
}
