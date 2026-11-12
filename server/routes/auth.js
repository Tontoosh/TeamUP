import { Router } from 'express';
import * as bcrypt from '../password.js';
import { z } from 'zod';
import { createSession, cookieValue, cookieOptions, hashToken, requireUser } from '../auth.js';
import { check, currentUser, id, now, parse, text } from '../utils.js';
import { sendAccountLink } from '../mail.js';
import { googleRoutes } from './google.js';
import { demoRole, demoUser } from '../demo-auth.js';

const credentials = z.object({
  email: z
    .email()
    .max(255)
    .transform(value => value.toLowerCase()),
  password: text(8, 128),
});
export function authRoutes(db, { bypass = false } = {}) {
  const router = Router();
  router.use(googleRoutes(db));
  router.get('/me', (req, res) =>
    res.json({
      user: req.user ? currentUser(req.user) : null,
      googleEnabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      localMail: !process.env.SMTP_HOST,
      demoMode: bypass,
      demoRole: bypass ? demoRole(req) : null,
    })
  );
  router.post('/demo-role', async (req, res) => {
    check(bypass, 'Туршилтын горим идэвхгүй байна.', 404);
    const { role } = parse(z.object({ role: z.enum(['student', 'owner', 'admin']) }), req.body);
    const user = await demoUser(db, role);
    res.cookie('teamup_demo_role', role, cookieOptions());
    res.json({ user: currentUser(user) });
  });
  router.post('/register', async (req, res) => {
    const data = parse(
      credentials.extend({ name: text(2, 160), school: text(2, 160), major: text(2, 160) }),
      req.body
    );
    check(
      !(await db.get('SELECT id FROM users WHERE email = ?', [data.email])),
      'Энэ имэйл бүртгэлтэй байна.',
      409
    );
    const user = {
      ...data,
      id: id(),
      password: await bcrypt.hash(data.password),
      skills: '[]',
      interests: '[]',
      experience: '',
      portfolio: '',
      hours: 0,
      bio: '',
      role: 'student',
      status: 'active',
      verified: 0,
      created_at: now(),
    };
    await db.insert('users', user);
    await sendAccountLink(db, user, 'verify');
    res
      .status(201)
      .json({ message: 'Бүртгэл үүслээ. Имэйлээр ирсэн холбоосоор баталгаажуулна уу.' });
  });
  router.post('/login', async (req, res) => {
    const data = parse(credentials, req.body);
    const user = await db.get('SELECT * FROM users WHERE email = ?', [data.email]);
    const valid = await bcrypt.compare(
      data.password,
      user?.password || '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid'
    );
    const outcome = !user || !valid ? 'invalid_credentials'
      : !user.verified ? 'unverified' : user.status !== 'active' ? 'suspended' : 'success';
    const attempt = { id: id(), user_id: user?.id || null, outcome, created_at: now() };
    if (outcome !== 'success') {
      await db.insert('login_attempts', attempt);
      check(user && valid, 'Имэйл эсвэл нууц үг буруу байна.', 401);
      check(user.verified, 'Имэйл хаягаа баталгаажуулна уу.', 403);
      check(user.status === 'active', 'Бүртгэлийн эрх түдгэлзсэн байна.', 403);
    }
    const sessionUser = await db.transaction(async () => {
      await db.insert('login_attempts', attempt);
      return createSession(db, user, res);
    });
    res.json({ user: sessionUser });
  });
  router.get('/login-history', requireUser, async (req, res) => {
    const rows = await db.all(
      'SELECT id, outcome, created_at FROM login_attempts WHERE user_id = ? ORDER BY created_at DESC, id DESC',
      [req.user.id]
    );
    res.json(rows.slice(0, 50));
  });
  router.post('/logout', async (req, res) => {
    if (cookieValue(req))
      await db.run('DELETE FROM sessions WHERE id = ?', [hashToken(cookieValue(req))]);
    res.clearCookie('teamup_session', { ...cookieOptions(), maxAge: undefined }).json({ ok: true });
  });
  router.post('/forgot', async (req, res) => {
    const { email } = parse(
      z.object({ email: z.email().transform(value => value.toLowerCase()) }),
      req.body
    );
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (user) await sendAccountLink(db, user, 'reset');
    res.json({ message: 'Бүртгэлтэй хаяг бол сэргээх холбоос илгээгдлээ.' });
  });
  for (const purpose of ['verify', 'reset']) {
    router.post(`/${purpose}`, async (req, res) => {
      const schema = z.object({
        token: text(32, 128),
        ...(purpose === 'reset' ? { password: text(8, 128) } : {}),
      });
      const data = parse(schema, req.body);
      const password = purpose === 'reset' ? await bcrypt.hash(data.password) : null;
      await db.transaction(async () => {
        const token = await db.get(
          'SELECT * FROM tokens WHERE id = ? AND purpose = ? AND expires_at > ?',
          [hashToken(data.token), purpose, now()]
        );
        check(token, 'Холбоосын хугацаа дууссан эсвэл ашиглагдсан байна.');
        await db.update(
          'users',
          token.user_id,
          purpose === 'verify' ? { verified: 1 } : { password }
        );
        await db.run('DELETE FROM tokens WHERE user_id = ? AND purpose = ?', [
          token.user_id,
          purpose,
        ]);
        if (purpose === 'reset')
          await db.run('DELETE FROM sessions WHERE user_id = ?', [token.user_id]);
      });
      res.json({
        message:
          purpose === 'verify' ? 'Имэйл баталгаажлаа. Нэвтэрч болно.' : 'Нууц үг шинэчлэгдлээ.',
      });
    });
  }
  return router;
}
