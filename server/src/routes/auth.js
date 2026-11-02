import crypto from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { config } from '../config.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { conflict, forbidden, notFound, unauthorized } from '../utils/errors.js';

export const authRouter = Router();

const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(254);
const password = z.string().min(8, 'Password must be at least 8 characters').max(128);

const signupSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(80),
  email,
  password,
  signupCode: z.string().trim().max(100).optional(),
});

const loginSchema = z.object({ email, password: z.string().min(1, 'Enter your password').max(128) });

function presentUser(row) {
  return { id: row.id, name: row.name, email: row.email, role: row.role, createdAt: row.created_at };
}

// Compared against when the email is unknown, so login takes the same time
// whether or not an account exists (prevents timing-based user enumeration).
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

function safeEqual(a, b) {
  const x = Buffer.from(String(a ?? ''));
  const y = Buffer.from(String(b ?? ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

authRouter.post('/signup', authLimiter, validate(signupSchema), async (req, res) => {
  const { name, email, password, signupCode } = req.body;

  if (config.organizerSignupCode && !safeEqual(signupCode, config.organizerSignupCode)) {
    throw forbidden('Invalid organizer sign-up code', { code: 'BAD_SIGNUP_CODE' });
  }

  const existing = await query('SELECT 1 FROM users WHERE lower(email) = $1', [email]);
  if (existing.rowCount > 0) {
    throw conflict('An account with this email already exists', { code: 'EMAIL_TAKEN' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const { rows } = await query(
    `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)
     RETURNING id, name, email, role, created_at`,
    [name, email, passwordHash],
  );
  const user = presentUser(rows[0]);
  res.status(201).json({ token: signToken(user), user });
});

authRouter.post('/login', authLimiter, validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  const { rows } = await query(
    'SELECT id, name, email, role, password_hash, created_at FROM users WHERE lower(email) = $1',
    [email],
  );
  const row = rows[0];
  // Always run the (slow) hash comparison so unknown emails are not faster to reject.
  const matches = await bcrypt.compare(password, row ? row.password_hash : DUMMY_HASH);
  if (!row || !matches) throw unauthorized('Incorrect email or password', { code: 'BAD_CREDENTIALS' });

  const user = presentUser(row);
  res.json({ token: signToken(user), user });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const { rows } = await query('SELECT id, name, email, role, created_at FROM users WHERE id = $1', [
    req.user.id,
  ]);
  if (!rows[0]) throw notFound('Account no longer exists', { code: 'USER_NOT_FOUND' });
  res.json({ user: presentUser(rows[0]) });
});
