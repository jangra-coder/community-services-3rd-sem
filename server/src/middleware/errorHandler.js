import { config } from '../config.js';
import { HttpError } from '../utils/errors.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: `No route for ${req.method} ${req.path}`, code: 'NOT_FOUND' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) {
    const body = { error: err.message, code: err.code };
    if (err.details) body.details = err.details;
    return res.status(err.status).json(body);
  }

  // Malformed JSON body
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body', code: 'BAD_JSON' });
  }

  // PostgreSQL: invalid uuid / text representation
  if (err.code === '22P02') {
    return res.status(400).json({ error: 'Invalid identifier', code: 'BAD_ID' });
  }

  // PostgreSQL: unique violation
  if (err.code === '23505') {
    return res.status(409).json({ error: 'This record already exists', code: 'DUPLICATE' });
  }

  if (!config.isTest) console.error(err);
  res.status(500).json({
    error: config.isProduction ? 'Something went wrong' : err.message,
    code: 'INTERNAL',
  });
}
