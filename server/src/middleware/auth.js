import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { unauthorized } from '../utils/errors.js';

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, name: user.name, email: user.email, role: user.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn },
  );
}

function readToken(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    return { id: payload.sub, name: payload.name, email: payload.email, role: payload.role };
  } catch {
    return null;
  }
}

/** Attach `req.user` when a valid token is present; never fails. */
export function optionalAuth(req, _res, next) {
  req.user = readToken(req);
  next();
}

/** Reject the request with 401 unless a valid organizer token is present. */
export function requireAuth(req, _res, next) {
  const user = readToken(req);
  if (!user) return next(unauthorized('Please log in to continue', { code: 'UNAUTHENTICATED' }));
  req.user = user;
  next();
}
