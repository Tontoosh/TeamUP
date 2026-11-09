import { test } from 'node:test';
import assert from 'node:assert/strict';
import { db, app, owner, student, guest, admin, createProject, apply } from './fixture.js';
import { client, projectData } from './helpers.js';
import { hashToken } from '../server/auth.js';
import { now, id } from '../server/utils.js';

test('Guests can browse/filter projects but cannot create projects or read team chat', async () => {
  const search = await guest.request('GET', '/projects?q=арга&skill=React');
  assert.equal(search.status, 200);
  assert.equal(search.data.total, 1);
  assert.equal(search.data.items[0].name, 'Оюутны арга хэмжээний платформ');
  assert.equal(search.data.items[0].owner.password, undefined);
  assert.equal(search.data.items[0].owner.email, undefined);
  assert.equal((await guest.request('POST', '/projects', projectData())).status, 401);
  assert.equal((await guest.request('GET', '/chat/demo-events')).status, 401);
  assert.equal((await student.request('GET', '/chat/demo-events')).status, 403);
});
test('Authentication rejects bad credentials and cross-origin mutations', async () => {
  assert.equal(
    (
      await guest.request('POST', '/auth/login', {
        email: 'student@teamup.mn',
        password: 'invalid-password',
      })
    ).status,
    401
  );
  assert.equal(
    (
      await guest.request(
        'POST',
        '/auth/login',
        { email: 'student@teamup.mn', password: 'Teamup123!' },
        { origin: 'https://evil.example' }
      )
    ).status,
    403
  );
});
test('Registration cannot assign administrator privileges and requires email verification', async () => {
  const response = await guest.request('POST', '/auth/register', {
    name: 'Шинэ оюутан',
    school: 'МУИС',
    major: 'Программ хангамж',
    email: 'new@example.com',
    password: 'Newpass123!',
    role: 'admin',
  });
  assert.equal(response.status, 201);
  const user = await db.get('SELECT * FROM users WHERE email = ?', ['new@example.com']);
  assert.equal(user.role, 'student');
  assert.equal(user.verified, 0);
  assert.ok(user.password.startsWith('scrypt:'));
  assert.equal(
    (await guest.request('POST', '/auth/login', { email: user.email, password: 'Newpass123!' }))
      .status,
    403
  );
  const token = 'test-verification-token-1234567890123456789';
  await db.insert('tokens', {
    id: hashToken(token),
    user_id: user.id,
    purpose: 'verify',
    expires_at: new Date(Date.now() + 60000).toISOString(),
  });
  assert.equal((await guest.request('POST', '/auth/verify', { token })).status, 200);
  assert.equal((await guest.request('POST', '/auth/verify', { token })).status, 400);
});
test('Profiles validate URLs and required fields while optional data can be cleared', async () => {
  const profile = {
    name: 'А. Анударь',
    school: 'МУИС',
    major: 'Мэдээллийн систем',
    skills: ['React', 'Figma'],
    interests: ['EdTech'],
    experience: '',
    portfolio: '',
    hours: 12,
    bio: '',
  };
  assert.equal((await student.request('PATCH', '/users/me', { ...profile, name: '' })).status, 400);
  assert.equal(
    (await student.request('PATCH', '/users/me', { ...profile, portfolio: 'javascript:alert(1)' }))
      .status,
    400
  );
  assert.equal((await student.request('PATCH', '/users/me', profile)).status, 200);
});
test('Only the project owner may edit projects, decide requests and change roles', async () => {
  const project = await createProject();
  assert.equal(
    (await student.request('PATCH', `/projects/${project.id}`, projectData())).status,
    403
  );
  assert.equal(
    (await student.request('POST', `/projects/${project.id}/status`, { status: 'closed' })).status,
    403
  );
  assert.equal(
    (
      await student.request('PATCH', `/projects/${project.id}/members/demo-owner`, {
        role: 'Admin',
      })
    ).status,
    403
  );
});
test('Own-team and duplicate applications are rejected, including information-waiting requests', async () => {
  const project = await createProject();
  const own = await owner.request('POST', '/applications', {
    project_id: project.id,
    role: 'Хөгжүүлэгч',
    introduction: 'Өөрийн төсөлд туршилтын хүсэлт.',
  });
  assert.equal(own.status, 400);
  const request = await apply(project);
  const payload = {
    project_id: project.id,
    role: request.role,
    introduction: 'Давхар хүсэлтийн туршилтын тайлбар.',
  };
  assert.equal((await student.request('POST', '/applications', payload)).status, 409);
  assert.equal(
    (
      await owner.request('POST', `/applications/${request.id}/decision`, {
        action: 'info',
        reason: 'Туршлагын холбоосоо өгнө үү.',
      })
    ).status,
    200
  );
  assert.equal((await student.request('POST', '/applications', payload)).status, 409);
  assert.equal(
    (await owner.request('POST', `/applications/${request.id}/decision`, { action: 'accepted' }))
      .status,
    400
  );
  assert.equal(
    (
      await student.request('POST', `/applications/${request.id}/reply`, {
        answer: 'https://example.com/my-work',
      })
    ).status,
    200
  );
  assert.equal(
    (await owner.request('POST', `/applications/${request.id}/decision`, { action: 'accepted' }))
      .status,
    200
  );
  assert.equal(
    (await owner.request('POST', `/applications/${request.id}/decision`, { action: 'accepted' }))
      .status,
    409
  );
  assert.equal(
    (
      await db.all('SELECT * FROM memberships WHERE project_id = ? AND user_id = ?', [
        project.id,
        'demo-student',
      ])
    ).length,
    1
  );
  const detail = await student.request('GET', `/projects/${project.id}`);
  assert.equal(detail.data.member_count, 2);
  assert.ok(!detail.data.roles.includes(request.role));
  assert.equal((await student.request('GET', `/chat/${project.id}`)).status, 200);
});
test('Concurrent approvals cannot exceed team capacity', async () => {
  const project = await createProject({ capacity: 2 });
  const request = await apply(project);
  const other = client(app);
  await other.login('nomin@teamup.mn');
  const second = await other.request('POST', '/applications', {
    project_id: project.id,
    role: 'Дизайнер',
    introduction: 'Figma ашиглан загвар гаргах хүсэлтэй.',
  });
  assert.equal(second.status, 201);
  const decisions = await Promise.all(
    [request, second.data].map(item =>
      owner.request('POST', `/applications/${item.id}/decision`, { action: 'accepted' })
    )
  );
  assert.deepEqual(decisions.map(item => item.status).sort(), [200, 409]);
  assert.equal(
    (await db.all('SELECT id FROM memberships WHERE project_id = ?', [project.id])).length,
    2
  );
  assert.equal(
    (await owner.request('PATCH', `/projects/${project.id}`, projectData({ capacity: 1 }))).status,
    400
  );
});
test('Closing invalidates pending requests and archiving enforces read-only chat', async () => {
  const project = await createProject();
  const request = await apply(project);
  assert.equal(
    (await owner.request('POST', `/projects/${project.id}/status`, { status: 'closed' })).status,
    200
  );
  assert.equal(
    (await db.get('SELECT status FROM applications WHERE id = ?', [request.id])).status,
    'invalidated'
  );
  assert.equal(
    (await owner.request('POST', `/projects/${project.id}/status`, { status: 'archived' })).status,
    200
  );
  assert.equal(
    (await owner.request('PATCH', `/projects/${project.id}`, projectData())).status,
    400
  );
  const form = new FormData();
  form.set('body', 'Шинэ мессеж');
  assert.equal((await owner.request('POST', `/chat/${project.id}`, form)).status, 400);
});
