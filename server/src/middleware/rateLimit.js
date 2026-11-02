import { rateLimit } from 'express-rate-limit';
import { config } from '../config.js';

function limiter(windowMinutes, limit, message) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => config.isTest,
    message: { error: message, code: 'RATE_LIMITED' },
  });
}

/** Generic protection for the whole API. */
export const apiLimiter = limiter(15, 600, 'Too many requests, please slow down');

/** Login / signup attempts. */
export const authLimiter = limiter(15, 30, 'Too many login attempts, please try again later');

/** Public registration & ticket re-send. */
export const registrationLimiter = limiter(
  15,
  20,
  'Too many registration attempts from this device, please try again later',
);
