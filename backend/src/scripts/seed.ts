import { migrate } from '../migrate';
import { seed } from '../seed/seed';
import { pool, waitForDb } from '../db';
import { ensureDirs } from '../services/media';
import { logger } from '../logger';

(async () => {
  ensureDirs();
  await waitForDb();
  await migrate();
  await seed();
  logger.info('Datos iniciales cargados');
  await pool.end();
})().catch((e) => { logger.error(e); process.exit(1); });
