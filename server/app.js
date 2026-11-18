import express from 'express';
import { AppError, requestIdentity, errorHandler } from './errors.js';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { authentication } from './auth.js';
import { authRoutes } from './routes/auth.js';
import { projectRoutes } from './routes/projects.js';
import { applicationRoutes } from './routes/applications.js';
import { userRoutes } from './routes/users.js';
import { reviewRoutes } from './routes/reviews.js';
import { chatRoutes } from './routes/chat.js';
import { communityRoutes } from './routes/community.js';
import { adminRoutes } from './routes/admin.js';

export function createApp(db, { authBypass = false } = {}) {
  authBypass = authBypass && process.env.NODE_ENV !== 'production' && db.driver === 'sqlite';
  const app = express();
  app.disable('x-powered-by');
  app.use(requestIdentity);
  app.use((_req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'same-origin',
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'",
    });
    next();
  });
  app.use(express.json({ limit: '3mb' }));
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', (req, res, next) => {
    const origin = req.headers.origin;
    const allowed = new Set([
      process.env.APP_URL || 'http://localhost:5173',
      `http://localhost:${process.env.PORT || 3001}`,
      `http://127.0.0.1:${process.env.PORT || 3001}`,
    ]);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && origin && !allowed.has(origin))
      return res.status(403).json({ message: 'Хандалтын эх үүсвэр зөвшөөрөгдөөгүй.' });
    next();
  });
  // Bound login/reset attempts without retaining unlimited client keys.
  const attempts = new Map();
  app.use('/api/auth', (req, res, next) => {
    if (req.method !== 'POST') return next();
    const time = Date.now();
    for (const [key, value] of attempts) if (value.until < time) attempts.delete(key);
    const key = req.ip;
    const value = attempts.get(key) || { count: 0, until: time + 60000 };
    value.count++;
    attempts.set(key, value);
    if (value.count > 30)
      return res.status(429).json({ message: 'Олон оролдлого хийлээ. Түр хүлээнэ үү.' });
    next();
  });
  app.use('/api', async (_req, _res, next) => {
    try { if (db.refreshSource) await db.refreshSource(); next(); } catch (error) { next(error); }
  });
  app.use('/api', authentication(db, { bypass: authBypass }));
  app.get('/api/health', async (_req, res) => {
    await db.get('SELECT 1 AS connected');
    res.json({ ok: true, database: db.driver, sourceSchema: db.sourceSchema || 'app' });
  });
  app.get('/api/reference', async (_req, res) =>
    res.json(await db.all('SELECT * FROM reference_data'))
  );
  app.use('/api/auth', authRoutes(db, { bypass: authBypass }));
  app.use('/api/projects', projectRoutes(db));
  app.use('/api/applications', applicationRoutes(db));
  app.use('/api/users', userRoutes(db));
  app.use('/api/reviews', reviewRoutes(db));
  app.use('/api/chat', chatRoutes(db));
  app.use('/api/community', communityRoutes(db));
  app.use('/api/admin', adminRoutes(db));
  app.use('/api', (_req, _res, next) => next(new AppError(404, 'API зам олдсонгүй.', 'NOT_FOUND')));
  const dist = resolve('dist');
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get('/{*path}', (_req, res) => res.sendFile(resolve(dist, 'index.html')));
  }
  app.use(errorHandler());
  return app;
}

