import { test } from 'node:test';
import assert from 'node:assert/strict';
import { db, owner, student, guest, createProject } from './fixture.js';
import { hashToken } from '../server/auth.js';
import { pagination, searchProjects } from '../server/project-search.js';
import { searchPeople } from '../server/people-search.js';
import { id, now } from '../server/utils.js';

test('SQL project search preserves Mongolian case, literal wildcards, filters and safe pagination', async () => {
  const project = await createProject({ name: 'ӨСӨЛТ 100%_[туршилт]', category: 'Literal search', duration: 4 });
  for (const term of ['өсөлт', '100%', '_[']) {
    const response = await guest.request('GET', `/projects?q=${encodeURIComponent(term)}`);
    assert.equal(response.status, 200);
    assert.deepEqual(response.data.items.map(item => item.id), [project.id]);
  }
  assert.equal((await guest.request('GET', '/projects?skill=ReAcT&type=Стартап&duration=4&category=Literal%20search')).data.total, 1);
  assert.equal((await guest.request('GET', '/projects?mine=false')).status, 200);
  assert.equal((await guest.request('GET', '/projects?mine=true')).status, 401);
  assert.equal((await guest.request('GET', '/projects?duration=Infinity')).data.total, 0);
  for (const value of ['Infinity', '-1', 'NaN', '1.5', '0']) {
    const response = await guest.request('GET', `/projects?page=${value}&size=${value}`);
    assert.equal(response.status, 200);
    assert.equal(response.data.page, 1);
    assert.ok(response.data.items.length > 0 && response.data.items.length <= 6);
  }
  assert.deepEqual(pagination({ page: '2', size: '100' }), { page: 2, size: 24, offset: 24 });
});

test('Project pagination is performed in SQL and has stable ordering and scoped decoration', async () => {
  for (let i = 0; i < 9; i++) await createProject({ category: 'Paged search', name: `Paged project ${i}` });
  const first = await guest.request('GET', '/projects?category=Paged%20search&size=4');
  const second = await guest.request('GET', '/projects?category=Paged%20search&size=4&page=2');
  assert.equal(first.data.total, 9);
  assert.equal(first.data.pages, 3);
  assert.equal(second.data.items.length, 4);
  assert.equal(new Set([...first.data.items, ...second.data.items].map(item => item.id)).size, 8);
  const calls = [];
  const original = db.all;
  db.all = async (sql, params) => { calls.push(sql); return original(sql, params); };
  try {
    const response = await owner.request('GET', '/projects?category=Paged%20search&size=1&mine=true');
    assert.equal(response.data.items.length, 1);
    assert.ok(calls.some(sql => /LIMIT \? OFFSET \?/.test(sql)));
    for (const table of ['users', 'memberships', 'role_settings', 'role_requirements', 'project_completions']) {
      assert.ok(!calls.some(sql => sql === `SELECT * FROM ${table}`), table);
    }
  } finally { db.all = original; }
  const ranked = await searchProjects(db, { category: 'Paged search', sort: 'spaces' });
  assert.equal(ranked.rows.length, 6);
});

test('Chat team list includes more than 24 teams and excludes other users and hidden projects', async () => {
  const own = [];
  for (let i = 0; i < 26; i++) own.push(await createProject({ name: `Chat team ${i}` }));
  await db.update('projects', own[0].id, { visibility: 'hidden' });
  const response = await owner.request('GET', '/chat/teams');
  assert.equal(response.status, 200);
  const ids = new Set(response.data.items.map(item => item.id));
  assert.ok(own.slice(1).every(project => ids.has(project.id)));
  assert.ok(!ids.has(own[0].id));
  assert.ok(!(await student.request('GET', '/chat/teams')).data.items.some(project => own.some(item => item.id === project.id)));
  assert.equal((await guest.request('GET', '/chat/teams')).status, 401);
});

test('Expired verification can be resent and used once without revealing account existence', async () => {
  const user = await db.get('SELECT * FROM users WHERE email = ?', ['student@teamup.mn']);
  await db.update('users', user.id, { verified: 0 });
  const expired = 'e'.repeat(64);
  await db.insert('tokens', { id: hashToken(expired), user_id: user.id, purpose: 'verify', expires_at: '2000-01-01' });
  assert.equal((await guest.request('POST', '/auth/verify', { token: expired })).status, 400);
  let mail = '';
  const log = console.log;
  console.log = value => { mail = String(value); };
  let response;
  try { response = await guest.request('POST', '/auth/resend', { email: user.email.toUpperCase() }); }
  finally { console.log = log; }
  assert.equal(response.status, 200);
  const token = new URL(mail.slice(mail.indexOf('http'))).searchParams.get('token');
  assert.ok(await db.get('SELECT id FROM tokens WHERE id = ?', [hashToken(token)]));
  assert.equal((await guest.request('POST', '/auth/verify', { token })).status, 200);
  assert.equal((await guest.request('POST', '/auth/verify', { token })).status, 400);
  const before = (await db.all('SELECT * FROM tokens')).length;
  for (const email of [user.email, 'unknown@example.com']) {
    assert.deepEqual((await guest.request('POST', '/auth/resend', { email })).data, response.data);
  }
  assert.equal((await db.all('SELECT * FROM tokens')).length, before);
  assert.equal((await guest.request('POST', '/auth/resend', { email: 'invalid' })).status, 400);
});

test('People search filters in SQL, pages candidates and applies blocks in both directions', async () => {
  const template = await db.get('SELECT * FROM users WHERE email = ?', ['student@teamup.mn']);
  const caller = await db.get('SELECT * FROM users WHERE email = ?', ['owner@teamup.mn']);
  const candidates = [];
  await db.transaction(async () => {
    for (let i = 0; i < 14; i++) {
      const user = { ...template, id: id(), email: `candidate${i}@example.com`, name: `ӨСӨЛТ 100%_${i}`,
        major: 'Тусгай хайлт', skills: '["React"]', interests: '["EdTech"]', experience: 'Туршилт', hours: 12 };
      delete user.availability;
      await db.insert('users', user);
      candidates.push(user);
    }
  });
  const query = { q: 'өсөлт 100%_', major: 'тусгай хайлт', skill: 'react', interest: 'edtech', hours: 10 };
  const first = await searchPeople(db, query, caller.id);
  assert.equal(first.total, 14);
  assert.equal(first.rows.length, 12);
  assert.equal((await searchPeople(db, { ...query, page: 2 }, caller.id)).rows.length, 2);
  for (const [from, to] of [[caller.id, candidates[0].id], [candidates[1].id, caller.id]]) {
    await db.insert('blocks', { id: id(), user_id: from, target_id: to });
  }
  const filtered = await searchPeople(db, query, caller.id);
  assert.equal(filtered.total, 12);
  assert.ok(filtered.rows.every(row => !candidates.slice(0, 2).some(user => user.id === row.id)));
  assert.equal((await searchPeople(db, { ...query, hours: 'Infinity' }, caller.id)).total, 0);
  const response = await owner.request('GET', '/users/people?major=' + encodeURIComponent('тусгай хайлт'));
  assert.equal(response.data.total, 12);
  assert.ok(response.data.items.every(user => user.password === undefined && user.email === undefined));
});
