import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

// TLS is controlled entirely by the connection string, e.g.
//   ?sslmode=verify-full                      hosted DB with a publicly trusted certificate (Neon, ...)
//   ?sslmode=verify-full&sslrootcert=/path    provider with its own CA (Supabase, ...)
//   ?sslmode=no-verify                        explicit opt-out of certificate checks (not recommended)
// `pg` verifies certificates by default; never pass rejectUnauthorized:false here.
export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: config.isTest ? 4 : 10,
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
