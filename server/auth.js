import { randomBytes, createHash } from 'node:crypto';
import { check, currentUser, now } from './utils.js';
import { demoRole, demoUser } from './demo-auth.js';

export const hashToken = value =>
  createHash('sha256')
    .update(value)
    .digest('hex');
export const cookieValue = req => {
  const value = req.headers.cookie
    ?.split(';')
    .find(part => part.trim().startsWith('teamup_session='));
  return value?.trim().slice('teamup_session='.length);
};
export const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.COOKIE_SECURE === 'true',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
});
export async function createSession(db, user, res) {
  const token = randomBytes(32).toString('hex');
  await db.insert('sessions', {
    id: hashToken(token),
    user_id: user.id,
    expires_at: new Date(Date.now() + cookieOptions().maxAge).toISOString(),
  });
  res.cookie('teamup_session', token, cookieOptions());
  return currentUser(user);
}
export function authentication(db, { bypass = false } = {}) {
  return async (req, _res, next) => {
    try {
      if (bypass) {
        req.user = await demoUser(db, demoRole(req));
        return next();
      }
      const token = cookieValue(req);
      if (token) {
        const session = await db.get('SELECT * FROM sessions WHERE id = ? AND expires_at > ?', [
          hashToken(token),
          now(),
        ]);
        if (session) {
          const user = await db.get('SELECT * FROM users WHERE id = ?', [session.user_id]);
          if (user?.status === 'active') req.user = user;
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
export const requireUser = (req, _res, next) => {
  check(req.user, 'Эхлээд нэвтэрнэ үү.', 401);
  next();
};
export const requireAdmin = (req, _res, next) => {
  check(req.user?.role === 'admin', 'Администраторын эрх шаардлагатай.', 403);
  next();
};
