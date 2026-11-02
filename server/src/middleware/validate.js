import { badRequest } from '../utils/errors.js';

/**
 * Validate `req[source]` against a zod schema. The parsed (and cleaned) value
 * replaces the original so route handlers only ever see valid data.
 */
export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source] ?? {});
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      return next(badRequest('Please check the highlighted fields', { code: 'VALIDATION', details }));
    }
    if (source === 'query') {
      // req.query is a read-only getter in Express 5
      req.validatedQuery = result.data;
    } else {
      req[source] = result.data;
    }
    next();
  };
}
