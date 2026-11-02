import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './config.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.js';
import { eventsRouter } from './routes/events.js';
import { registrationsRouter, ticketsRouter } from './routes/registrations.js';
import { checkinRouter } from './routes/checkin.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', config.trustProxy);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          mediaSrc: ["'self'", 'blob:'],
          connectSrc: ["'self'"],
          workerSrc: ["'self'", 'blob:'],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );
  app.use(cors({ origin: [config.clientUrl, /^http:\/\/localhost:\d+$/], credentials: false }));
  app.use(express.json({ limit: '100kb' }));
  if (!config.isTest) app.use(morgan(config.isProduction ? 'combined' : 'dev'));

  // ---- API ---------------------------------------------------------------
  const api = express.Router();
  api.use(apiLimiter);
  api.get('/health', (_req, res) => res.json({ status: 'ok', app: config.appName, time: new Date().toISOString() }));
  api.use('/auth', authRouter);
  api.use('/events', eventsRouter);
  api.use('/events', registrationsRouter);
  api.use('/events', checkinRouter);
  api.use('/tickets', ticketsRouter);
  api.use(notFoundHandler);
  app.use('/api', api);

  // ---- Static client (production single-server deployment) ---------------
  if (config.serveClient && fs.existsSync(config.clientDist)) {
    app.use(express.static(config.clientDist, { maxAge: '1h', index: false }));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(config.clientDist, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
