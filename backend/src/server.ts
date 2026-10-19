import { createApp } from './app';
import { config } from './config';
import { logger } from './logger';
import { waitForDb, pool } from './db';
import { migrate } from './migrate';
import { seed } from './seed/seed';
import { ensureDirs } from './services/media';

async function main() {
  ensureDirs();
  await waitForDb();
  await migrate();
  await seed();
  const app = createApp();
  const server = app.listen(config.port, () => logger.info(`API de EMA Servicios · Estudio e-learning escuchando en :${config.port}`));
  const stop = () => {
    logger.info('Cerrando servidor…');
    server.close(() => pool.end().then(() => process.exit(0)));
    setTimeout(() => process.exit(0), 8000).unref();
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

main().catch((e) => {
  logger.fatal(e, 'No se pudo iniciar el servidor');
  process.exit(1);
});
