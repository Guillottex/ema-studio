import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { logger } from '../logger';

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: any) {
    super(message);
  }
}

export const notFound = (what = 'Recurso') => new HttpError(404, `${what} no encontrado`);

/** Envuelve handlers async para enviar errores al middleware */
export const ah = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler => (req, res, next) => {
  fn(req, res, next).catch(next);
};

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Datos inválidos', details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'El contenido enviado es demasiado grande' });
  if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'El archivo supera el tamaño máximo permitido' });
  if (err?.code === '23505') return res.status(409).json({ error: 'Ya existe un registro con esos datos' });
  if (err?.code === '23503') return res.status(409).json({ error: 'El registro está siendo utilizado por otros datos' });
  logger.error({ err, url: req.originalUrl }, 'Error no controlado');
  res.status(500).json({ error: 'Error interno del servidor' });
}
