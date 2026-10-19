import path from 'node:path';

const env = process.env;
const num = (v: string | undefined, d: number) => (v && !isNaN(Number(v)) ? Number(v) : d);

export const config = {
  env: env.NODE_ENV || 'development',
  port: num(env.PORT, 4000),
  databaseUrl: env.DATABASE_URL || 'postgres://ema:ema@localhost:5432/ema_studio',
  jwtSecret: env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpires: env.JWT_EXPIRES || '12h',
  corsOrigin: (env.CORS_ORIGIN || 'http://localhost:8080,http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean),
  dataDir: path.resolve(env.DATA_DIR || './data'),
  engineDist: path.resolve(env.ENGINE_DIST || '../scorm-engine/dist'),
  migrationsDir: path.resolve(env.MIGRATIONS_DIR || '../database/migrations'),
  seedMediaDir: path.resolve(env.SEED_MEDIA_DIR || '../database/seed-media'),
  maxUploadMb: num(env.MAX_UPLOAD_MB, 200),
  maxImageMb: num(env.MAX_IMAGE_MB, 20),
  imageMaxWidth: num(env.IMAGE_MAX_WIDTH, 2400),
  admin: {
    email: env.ADMIN_EMAIL || 'admin@ema.local',
    password: env.ADMIN_PASSWORD || 'Admin123!',
    name: env.ADMIN_NAME || 'Administrador',
  },
  seedDemo: (env.SEED_DEMO || 'true') !== 'false',
  ai: {
    provider: (env.AI_PROVIDER || 'none') as 'none' | 'anthropic' | 'openai',
    apiKey: env.AI_API_KEY || '',
    model: env.AI_MODEL || '',
    baseUrl: env.AI_BASE_URL || '',
  },
  logLevel: env.LOG_LEVEL || 'info',
};

export const uploadsDir = () => path.join(config.dataDir, 'uploads');
export const exportsDir = () => path.join(config.dataDir, 'exports');
