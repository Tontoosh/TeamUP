import assert from 'node:assert/strict';
const base = 'http://127.0.0.1:3001';
const call = (path, options = {}) => fetch(`${base}${path}`, { ...options, signal: AbortSignal.timeout(10000) });
const health = await call('/api/health');
assert.equal(health.status, 200);
assert.equal((await health.json()).database, 'sqlite');
assert.equal((await call('/')).status, 200);
assert.equal((await call('/api/projects')).status, 200);
assert.equal((await call('/api/auth/login-history')).status, 401);
if (process.env.SEED_DEMO === 'true') {
  await Promise.all(['student@teamup.mn', 'owner@teamup.mn', 'admin@teamup.mn'].map(async email => {
    let cookie;
    try {
      const login = await call('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Teamup123!' }) });
      assert.equal(login.status, 200, `Login failed: ${email}`);
      cookie = login.headers.getSetCookie().find(value => value.startsWith('teamup_session='))?.split(';')[0];
      assert.ok(cookie, 'Missing session cookie');
      const me = await call('/api/auth/me', { headers: { Cookie: cookie } });
      assert.equal((await me.json()).user.email, email);
      assert.equal((await call('/api/auth/login-history', { headers: { Cookie: cookie } })).status, 200);
    } finally {
      if (cookie) assert.equal((await call('/api/auth/logout', { method: 'POST', headers: { Cookie: cookie } })).status, 200);
    }
  }));
  console.log('PASS: frontend, API, SQLite, authentication and 3 separate sessions.');
} else console.log('PASS: frontend, API, SQLite and authentication guard. Demo account tests skipped.');
