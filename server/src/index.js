import { config } from './config.js';
import { createApp } from './app.js';
import { runMigrations } from './db/migrate.js';
import { closePool, pool } from './db/pool.js';

const WAIT_ATTEMPTS = Number(process.env.DB_WAIT_ATTEMPTS) || 12;
const WAIT_DELAY_MS = Number(process.env.DB_WAIT_DELAY_MS) || 5000;

/**
 * Hosted databases (and docker-compose) are often not reachable for the first
 * seconds after creation – DNS for the internal hostname can lag behind.
 * Retry instead of crashing so the platform's health check gets a chance.
 */
async function waitForDatabase() {
  for (let attempt = 1; attempt <= WAIT_ATTEMPTS; attempt += 1) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      if (attempt === WAIT_ATTEMPTS) throw err;
      console.warn(
        `Database not reachable yet (${err.code || err.message}); retrying in ${WAIT_DELAY_MS / 1000}s (${attempt}/${WAIT_ATTEMPTS})`,
      );
      await new Promise((resolve) => setTimeout(resolve, WAIT_DELAY_MS));
    }
  }
}

async function main() {
  await waitForDatabase();
  if (config.autoMigrate) await runMigrations();

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`${config.appName} API listening on http://localhost:${config.port} (${config.nodeEnv})`);
    if (config.serveClient) console.log('Serving the built web app from client/dist');
  });

  const shutdown = (signal) => {
    console.log(`\n${signal} received, shutting down...`);
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
