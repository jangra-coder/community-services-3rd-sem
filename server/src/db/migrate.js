import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, closePool } from './pool.js';

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

/**
 * Apply every `migrations/*.sql` file that has not been applied yet, in
 * filename order. Each file runs inside its own transaction and is recorded
 * in `schema_migrations` so it is never applied twice.
 */
export async function runMigrations({ log = console.log } = {}) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       text        PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const files = (await fs.readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  const { rows } = await pool.query('SELECT name FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.name));

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      log(`Applied migration ${file}`);
      count += 1;
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Migration ${file} failed: ${err.message}`);
    } finally {
      client.release();
    }
  }
  if (count === 0) log('Database schema is up to date');
  return count;
}

// Allow `node src/db/migrate.js` to be run directly
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(() => closePool())
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
