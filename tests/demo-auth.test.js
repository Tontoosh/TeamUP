import { test } from 'node:test';
import assert from 'node:assert/strict';
import { db } from './fixture.js';
import { client } from './helpers.js';
import { createApp } from '../server/app.js';

test('Local preview skips login and exposes the student workspace without a session', async () => {
  const preview = client(createApp(db, { authBypass: true }));
  const me = await preview.request('GET', '/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.data.demoMode, true);
  assert.equal(me.data.demoRole, 'student');
  assert.equal(me.data.user.id, 'demo-student');
  assert.equal((await preview.request('GET', '/projects?mine=true')).status, 200);
  assert.equal((await preview.request('GET', '/chat/demo-study')).status, 200);
  assert.equal((await preview.request('GET', '/admin/overview')).status, 403);
});

test('Preview identities can switch between owner and admin without passwords', async () => {
  const preview = client(createApp(db, { authBypass: true }));
  const selected = await preview.request('POST', '/auth/demo-role', { role: 'owner' });
  assert.equal(selected.status, 200);
  assert.equal(selected.data.user.id, 'demo-owner');
  const cookies = selected.headers['set-cookie'];
  const roleCookie = Array.isArray(cookies) ? cookies[0] : cookies;
  assert.ok(roleCookie.startsWith('teamup_demo_role=owner;'));
  const me = await preview.request('GET', '/auth/me', undefined, {
    cookie: 'teamup_demo_role=owner',
  });
  assert.equal(me.data.user.id, 'demo-owner');
  const admin = await preview.request('GET', '/admin/overview', undefined, {
    cookie: 'teamup_demo_role=admin',
  });
  assert.equal(admin.status, 200);
  assert.equal(
    (await preview.request('POST', '/auth/demo-role', { role: 'arbitrary-user' })).status,
    400
  );
  const fallback = await preview.request('GET', '/auth/me', undefined, {
    cookie: 'teamup_demo_role=constructor',
  });
  assert.equal(fallback.data.user.id, 'demo-student');
});

test('Disabling preview restores login and ignores preview cookies', async () => {
  const regular = client(createApp(db, { authBypass: false }));
  const me = await regular.request('GET', '/auth/me', undefined, {
    cookie: 'teamup_demo_role=admin',
  });
  assert.equal(me.data.user, null);
  assert.equal(me.data.demoMode, false);
  assert.equal((await regular.request('GET', '/projects?mine=true')).status, 401);
  assert.equal((await regular.request('POST', '/auth/demo-role', { role: 'admin' })).status, 404);
});

test('Production and SQL Server never enable the temporary local bypass', async () => {
  const previous = process.env.NODE_ENV;
  let production;
  try {
    process.env.NODE_ENV = 'production';
    production = client(createApp(db, { authBypass: true }));
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
  assert.equal((await production.request('GET', '/auth/me')).data.demoMode, false);
  const sqlServer = client(createApp({ ...db, driver: 'mssql' }, { authBypass: true }));
  assert.equal((await sqlServer.request('GET', '/auth/me')).data.user, null);
});
