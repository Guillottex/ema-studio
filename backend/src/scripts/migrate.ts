import { migrate } from '../migrate';
import { pool, waitForDb } from '../db';
import { logger } from '../logger';

(async () => {
  await waitForDb();
  await migrate();
  logger.info('Migraciones al día');
  await pool.end();
})().catch((e) => { logger.error(e); process.exit(1); });
