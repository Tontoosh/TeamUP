import { randomUUID } from 'node:crypto';
import pino from 'pino';

export const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
export class AppError extends Error {
  constructor(status, message, code = 'REQUEST_ERROR', details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
export class ValidationError extends AppError {
  constructor(message = 'Мэдээллээ шалгаад дахин оролдоно уу.', details) {
    super(400, message, 'VALIDATION_ERROR', details);
  }
}
export function requestIdentity(_req, res, next) {
  res.locals.requestId = randomUUID();
  res.set('X-Request-ID', res.locals.requestId);
  next();
}
export function errorHandler(log = logger) {
  return (error, req, res, next) => {
    if (res.headersSent) return next(error);
    const candidate = Number(error.status);
    const status = Number.isInteger(candidate) && candidate >= 400 && candidate <= 599 ? candidate : 500;
    const known = error instanceof AppError;
    const malformed = error.type === 'entity.parse.failed';
    const tooLarge = error.type === 'entity.too.large';
    const code = status >= 500 ? 'INTERNAL_ERROR' : malformed ? 'INVALID_JSON' : tooLarge ? 'PAYLOAD_TOO_LARGE' : known ? error.code : 'REQUEST_ERROR';
    const message = status >= 500 ? 'Серверийн алдаа гарлаа. Дахин оролдоно уу.'
      : malformed ? 'JSON мэдээллийн бүтэц буруу байна.'
      : tooLarge ? 'Илгээсэн мэдээллийн хэмжээ хэтэрсэн байна.'
      : known ? error.message : 'Хүсэлтийг боловсруулах боломжгүй байна.';
    // Never log request bodies, cookies, SQL text, credentials or raw exception messages.
    if (status >= 500) log.error({ requestId: res.locals.requestId, method: req.method, status, code }, 'Request failed');
    res.status(status).json({ message, code, status, requestId: res.locals.requestId,
      ...(known && status < 500 && error.details ? { details: error.details } : {}),
    });
  };
}
