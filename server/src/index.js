import { config } from './config.js';
import { createApp } from './app.js';
import { runMigrations } from './db/migrate.js';
import { closePool } from './db/pool.js';

async function main() {
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
