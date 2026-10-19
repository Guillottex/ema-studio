import fs from 'node:fs';
import path from 'node:path';
import { pool } from './db';
import { config } from './config';
import { logger } from './logger';

/** Ejecuta las migraciones SQL pendientes (orden alfabético) dentro de transacciones. */
export async function migrate() {
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  const done = new Set((await pool.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
  const files = fs.readdirSync(config.migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = fs.readFileSync(path.join(config.migrationsDir, f), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [f]);
      await client.query('COMMIT');
      logger.info(`Migración aplicada: ${f}`);
    } catch (e) {
      await client.query('ROLLBACK');
      throw new Error(`Error en migración ${f}: ${(e as Error).message}`);
    } finally {
      client.release();
    }
  }
}
