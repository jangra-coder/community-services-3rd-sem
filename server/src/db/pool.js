import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: config.isTest ? 4 : 10,
  // Hosted PostgreSQL (Neon, Supabase, Render, Railway...) requires TLS.
  ssl: /sslmode=require/.test(config.databaseUrl) ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL client error', err);
});

/** Run a single parameterised query. */
export function query(text, params) {
  return pool.query(text, params);
}

/**
 * Run `fn(client)` inside a transaction. The transaction is committed when
 * `fn` resolves and rolled back when it throws.
 */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export function closePool() {
  return pool.end();
}
