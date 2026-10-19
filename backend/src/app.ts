import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import { config, uploadsDir } from './config';
import { logger } from './logger';
import { authenticate, requirePerm } from './middleware/auth';
import { errorHandler } from './middleware/error';
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import categoriesRoutes from './routes/categories';
import coursesRoutes, { versionsRouter } from './routes/courses';
import structureRoutes from './routes/structure';
import mediaRoutes from './routes/media';
import themesRoutes from './routes/themes';
import templatesRoutes from './routes/templates';
import questionsRoutes from './routes/questions';
import miscRoutes from './routes/misc';
import aiRoutes from './routes/ai';
import { previewRouter, previewTokenRouter } from './routes/preview';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false, crossOriginResourcePolicy: { policy: 'same-site' }, frameguard: false }));
  app.use(cors({ origin: (origin, cb) => cb(null, !origin || config.corsOrigin.includes('*') || config.corsOrigin.includes(origin)), credentials: true }));
  app.use(compression());
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url?.startsWith('/uploads') || req.url?.startsWith('/api/preview') || req.url === '/api/health' } }));
  app.use(express.json({ limit: '300mb' }));

  // Recursos subidos (nombres no adivinables). Se sirven sin ejecución de scripts.
  app.use('/uploads', (_req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; media-src 'self'; sandbox");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  }, express.static(uploadsDir(), { maxAge: '7d', fallthrough: false }));

  app.get('/api/health', (_req, res) => res.json({ ok: true, version: '1.0.0' }));

  const specPath = path.resolve(process.env.OPENAPI_FILE || path.join(__dirname, '../../docs/openapi.yaml'));
  if (fs.existsSync(specPath)) {
    const spec = YAML.parse(fs.readFileSync(specPath, 'utf8'));
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(spec, { customSiteTitle: 'EMA Studio API' }));
  }

  app.use('/api/auth', authRoutes);
  app.use('/api/preview', previewRouter);
  app.use('/api', previewTokenRouter);

  const api = express.Router();
  api.use(authenticate, requirePerm('view'));
  api.use('/users', usersRoutes);
  api.use('/categories', categoriesRoutes);
  api.use('/courses', coursesRoutes);
  api.use('/', versionsRouter);
  api.use('/', structureRoutes);
  api.use('/media', mediaRoutes);
  api.use('/themes', themesRoutes);
  api.use('/', templatesRoutes);
  api.use('/', questionsRoutes);
  api.use('/', miscRoutes);
  api.use('/ai', aiRoutes);
  app.use('/api', api);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
  app.use(errorHandler);
  return app;
}
