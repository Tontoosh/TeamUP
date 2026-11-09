import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { createSession, cookieOptions } from '../auth.js';
import { check, id, now } from '../utils.js';

export function googleRoutes(db) {
  const router = Router();
  const callback = () =>
    `${process.env.APP_URL || 'http://localhost:5173'}/api/auth/google/callback`;
  router.get('/google', (req, res) => {
    check(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
      'Google нэвтрэлт тохируулагдаагүй.',
      503
    );
    const state = randomBytes(24).toString('hex');
    res.cookie('google_state', state, { ...cookieOptions(), maxAge: 600000 });
    const query = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: callback(),
      response_type: 'code',
      scope: 'openid email profile',
      state,
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${query}`);
  });
  router.get('/google/callback', async (req, res) => {
    const cookie = req.headers.cookie
      ?.split(';')
      .find(part => part.trim().startsWith('google_state='))
      ?.trim()
      .slice(13);
    check(
      cookie && req.query.state === cookie && typeof req.query.code === 'string',
      'Google баталгаажуулалт амжилтгүй.'
    );
    res.clearCookie('google_state', { ...cookieOptions(), maxAge: undefined });
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: new URLSearchParams({
        code: req.query.code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: callback(),
        grant_type: 'authorization_code',
      }),
    });
    check(response.ok, 'Google нэвтрэлт амжилтгүй.', 401);
    const tokens = await response.json();
    const infoResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    check(infoResponse.ok, 'Google хэрэглэгч баталгаажаагүй.', 401);
    const info = await infoResponse.json();
    check(info.email_verified && info.email, 'Google имэйл баталгаажаагүй.', 401);
    const email = info.email.toLowerCase();
    let user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    // Existing email accounts must verify ownership with their current sign-in method first.
    check(!user || user.verified, 'Эхлээд бүртгэлтэй имэйлээ баталгаажуулна уу.', 403);
    if (!user) {
      user = {
        id: id(),
        email,
        password: '',
        name: info.name || email.split('@')[0],
        school: 'Бөглөөгүй',
        major: 'Бөглөөгүй',
        skills: '[]',
        interests: '[]',
        experience: '',
        portfolio: '',
        hours: 0,
        bio: '',
        role: 'student',
        status: 'active',
        verified: 1,
        created_at: now(),
      };
      await db.insert('users', user);
    }
    check(user.status === 'active', 'Бүртгэлийн эрх түдгэлзсэн.', 403);
    await createSession(db, user, res);
    res.redirect('/profile');
  });
  return router;
}
