/**
 * An error that carries an HTTP status code and an optional machine-readable
 * `code` so the API can answer with a consistent JSON shape.
 */
export class HttpError extends Error {
  constructor(status, message, { code, details } = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, opts) => new HttpError(400, message, opts);
export const unauthorized = (message = 'Authentication required', opts) =>
  new HttpError(401, message, opts);
export const forbidden = (message = 'You do not have access to this resource', opts) =>
  new HttpError(403, message, opts);
export const notFound = (message = 'Not found', opts) => new HttpError(404, message, opts);
export const conflict = (message, opts) => new HttpError(409, message, opts);
