import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connectDatabase } from '../server/db/index.js';
import { createApp } from '../server/app.js';
import { client } from './helpers.js';
import { hashToken } from '../server/auth.js';

// File-backed SQLite verifies actual persistence across application restarts.
test('Registration, verification, login history, isolation, persistence and logout integrate', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'teamup-auth-integration-'));
  const previous = { ...process.env };
  let db;
  try {
    process.env.DB_DRIVER = 'sqlite';
    process.env.SQLITE_PATH = join(directory, 'auth.db');
    delete process.env.SMTP_HOST;
    db = await connectDatabase();
    let app = createApp(db);
    let browser = client(app);
    const credentials = { email: 'integration@example.com', password: 'Integration123!' };
    assert.equal((await browser.request('GET', '/auth/login-history')).status, 401);
    assert.equal((await browser.request('POST', '/auth/register', {
      ...credentials, name: 'Туршилтын оюутан', school: 'МУИС', major: 'Программ хангамж',
    })).status, 201);
    assert.equal((await browser.request('POST', '/auth/register', {
      ...credentials, name: 'Туршилтын оюутан', school: 'МУИС', major: 'Программ хангамж',
    })).status, 409);
    const user = await db.get('SELECT * FROM users WHERE email = ?', [credentials.email]);
    assert.notEqual(user.password, credentials.password);
    assert.equal((await browser.request('POST', '/auth/login', credentials)).status, 403);
    const token = 'integration-verify-token-1234567890123456789';
    await db.insert('tokens', { id: hashToken(token), user_id: user.id, purpose: 'verify',
      expires_at: new Date(Date.now() + 60000).toISOString() });
    assert.equal((await browser.request('POST', '/auth/verify', { token })).status, 200);
    assert.equal((await browser.request('POST', '/auth/login', { ...credentials, password: 'Incorrect123!' })).status, 401);
    assert.equal((await browser.request('POST', '/auth/login', credentials)).status, 200);
    const cookie = (await browser.request('GET', '/auth/me')).data.user;
    assert.equal(cookie.id, user.id);
    let history = await browser.request('GET', '/auth/login-history');
    assert.equal(history.status, 200);
    assert.deepEqual(history.data.map(row => row.outcome).sort(), ['invalid_credentials', 'success', 'unverified']);
    assert.ok(history.data.every(row => !('password' in row) && !('user_id' in row)));
    // Another user's rows must never appear, even with a user_id query parameter.
    const other = { ...user, id: 'other-test-user', email: 'other@example.com' };
    await db.insert('users', other);
    await db.insert('login_attempts', { id: 'foreign-attempt', user_id: other.id, outcome: 'success', created_at: new Date().toISOString() });
    history = await browser.request('GET', `/auth/login-history?user_id=${other.id}`);
    assert.ok(!history.data.some(row => row.id === 'foreign-attempt'));
    // Public history is capped and ordered by newest time.
    for (let i = 0; i < 52; i++) await db.insert('login_attempts', {
      id: `history-${i}`, user_id: user.id, outcome: 'success', created_at: new Date(2000000000000 + i * 1000).toISOString(),
    });
    history = await browser.request('GET', '/auth/login-history');
    assert.equal(history.data.length, 50);
    assert.equal(history.data[0].id, 'history-51');
    await db.close(); db = null;
    db = await connectDatabase();
    assert.equal((await db.get('SELECT COUNT(*) AS total FROM login_attempts')).total, 56);
    browser = client(createApp(db));
    assert.equal((await browser.request('POST', '/auth/login', credentials)).status, 200);
    assert.equal((await browser.request('POST', '/auth/logout')).status, 200);
    assert.equal((await browser.request('GET', '/auth/me')).data.user, null);
    assert.equal((await browser.request('GET', '/auth/login-history')).status, 401);
    assert.equal((await db.get('SELECT COUNT(*) AS total FROM sessions WHERE user_id = ?', [user.id])).total, 1);
    // Only the newly logged out session is deleted; the older session survives restart.
  } finally {
    if (db) await db.close();
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
    await rm(directory, { recursive: true, force: true });
  }
});
