import pg from 'pg';
import { config } from './config';
import { logger } from './logger';

// NUMERIC → number
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 15 });
pool.on('error', (err) => logger.error({ err }, 'Error en pool de PostgreSQL'));

export type Db = pg.Pool | pg.PoolClient;

export async function query<T = any>(text: string, params: any[] = [], db: Db = pool): Promise<T[]> {
  const res = await db.query(text, params);
  return res.rows as T[];
}

export async function one<T = any>(text: string, params: any[] = [], db: Db = pool): Promise<T | null> {
  const rows = await query<T>(text, params, db);
  return rows[0] ?? null;
}

export async function tx<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await fn(client);
    await client.query('COMMIT');
    return r;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function waitForDb(retries = 30) {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (e: any) {
      logger.warn(`Esperando a PostgreSQL (${i + 1}/${retries}): ${e.message}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error('No se pudo conectar a PostgreSQL');
}
