import { testEnv } from './env.js';

/** Reset the test database schema once before the whole suite. */
export default async function globalSetup() {
  Object.assign(process.env, testEnv);
  const { pool, closePool } = await import('../src/db/pool.js');
  const { runMigrations } = await import('../src/db/migrate.js');

  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await runMigrations({ log: () => {} });
  await closePool();
}
