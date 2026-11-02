import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const serverRoot = path.resolve(__dirname, '..');

// Load server/.env if present. Variables already set in the environment win,
// so tests and deployment platforms can override anything in the file.
const envFile = path.join(serverRoot, '.env');
if (fs.existsSync(envFile) && process.env.NODE_ENV !== 'test') {
  try {
    process.loadEnvFile(envFile);
  } catch (err) {
    console.warn(`Could not load ${envFile}: ${err.message}`);
  }
}

const env = process.env;
const nodeEnv = env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const isTest = nodeEnv === 'test';

function bool(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function required(name, value) {
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

const jwtSecret = env.JWT_SECRET || 'dev-only-insecure-secret';
if (isProduction && (!env.JWT_SECRET || env.JWT_SECRET === 'change-me-in-production')) {
  throw new Error('JWT_SECRET must be set to a strong random value in production');
}

const clientDist = path.resolve(serverRoot, '..', 'client', 'dist');

export const config = {
  nodeEnv,
  isProduction,
  isTest,
  port: Number(env.PORT) || 4000,
  databaseUrl: required('DATABASE_URL', env.DATABASE_URL),
  jwtSecret,
  jwtExpiresIn: env.JWT_EXPIRES_IN || '7d',
  clientUrl: (env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, ''),
  appName: env.APP_NAME || 'EventPass',
  organizerSignupCode: env.ORGANIZER_SIGNUP_CODE || '',
  autoMigrate: bool(env.AUTO_MIGRATE, true),
  trustProxy: Number(env.TRUST_PROXY) || 0,
  serveClient: bool(env.SERVE_CLIENT, isProduction && fs.existsSync(clientDist)),
  clientDist,
  smtp: {
    host: env.SMTP_HOST || '',
    port: Number(env.SMTP_PORT) || 587,
    secure: bool(env.SMTP_SECURE, false),
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    from: env.MAIL_FROM || `${env.APP_NAME || 'EventPass'} <no-reply@eventpass.local>`,
  },
};

export default config;
