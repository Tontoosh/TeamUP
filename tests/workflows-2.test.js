import { test } from 'node:test';
import assert from 'node:assert/strict';
import { db, app, owner, student, guest, admin, createProject, apply } from './fixture.js';
import { client, projectData } from './helpers.js';
import { hashToken } from '../server/auth.js';
import { now, id } from '../server/utils.js';

test('Chat text, links and files persist; attachments require membership', async () => {
  const form = new FormData();
  form.set('body', 'Төслийн материал https://example.com');
  form.set('file', new File(['Багийн тэмдэглэл'], 'notes.txt', { type: 'text/plain' }));
  assert.equal((await student.request('POST', '/chat/demo-study', form)).status, 201);
  const chat = await student.request('GET', '/chat/demo-study');
  const message = chat.data.messages.at(-1);
  assert.equal(message.attachments[0].name, 'notes.txt');
  assert.equal(
    (await admin.request('GET', `/chat/files/${message.attachments[0].id}`)).status,
    403
  );
  const bad = new FormData();
  bad.set('file', new File(['executable'], 'unsafe.exe'));
  assert.equal((await student.request('POST', '/chat/demo-study', bad)).status, 400);
});
test('Rejection requires a reason and reapplication creates a new history record', async () => {
  const project = await createProject();
  const request = await apply(project);
  assert.equal(
    (await owner.request('POST', `/applications/${request.id}/decision`, { action: 'rejected' }))
      .status,
    400
  );
  assert.equal(
    (
      await owner.request('POST', `/applications/${request.id}/decision`, {
        action: 'rejected',
        reason: 'Энэ үүрэгт өөр туршлага шаардлагатай.',
      })
    ).status,
    200
  );
  const next = await apply(project);
  assert.notEqual(next.id, request.id);
});
test('Blocks prevent new requests without removing existing memberships or public projects', async () => {
  const project = await createProject();
  assert.equal(
    (await student.request('POST', '/community/blocks', { target_id: 'demo-owner' })).status,
    200
  );
  assert.equal((await guest.request('GET', `/projects/${project.id}`)).status, 200);
  assert.equal(
    (
      await student.request('POST', '/applications', {
        project_id: project.id,
        role: 'Хөгжүүлэгч',
        introduction: 'Блоктой хэрэглэгчийн хүсэлтийн тайлбар.',
      })
    ).status,
    403
  );
  assert.ok(
    await db.get('SELECT id FROM memberships WHERE user_id = ? AND project_id = ?', [
      'demo-student',
      'demo-eco',
    ])
  );
  assert.equal((await student.request('DELETE', '/community/blocks/demo-owner')).status, 200);
});
test('Notification read operations are scoped to their recipient', async () => {
  const response = await student.request('GET', '/community/notifications');
  assert.ok(response.data.unread > 0);
  const own = response.data.items[0];
  await owner.request('PATCH', '/community/notifications/read', { id: own.id });
  assert.equal(
    (await db.get('SELECT is_read FROM notifications WHERE id = ?', [own.id])).is_read,
    0
  );
  await student.request('PATCH', '/community/notifications/read', { id: own.id });
  assert.equal(
    (await db.get('SELECT is_read FROM notifications WHERE id = ?', [own.id])).is_read,
    1
  );
});
test('CSV import validates the whole file, rejects duplicates and rolls back invalid files', async () => {
  assert.equal(
    (await student.request('POST', '/admin/import', { csv: 'code,name,type\nnew,Шинэ,skill' }))
      .status,
    403
  );
  const invalid = 'code,name,type\nvalid,Хүчинтэй,skill\ninvalid,Буруу,wrong';
  assert.equal((await admin.request('POST', '/admin/import', { csv: invalid })).status, 400);
  assert.equal(await db.get('SELECT id FROM reference_data WHERE code = ?', ['valid']), undefined);
  const csv = 'code,name,type\nnew-skill,"Судалгаа, шинжилгээ",skill';
  assert.equal((await admin.request('POST', '/admin/import/preview', { csv })).data.count, 1);
  assert.equal((await admin.request('POST', '/admin/import', { csv })).status, 200);
  assert.equal((await admin.request('POST', '/admin/import', { csv })).status, 400);
  assert.equal(
    (await db.get('SELECT name FROM reference_data WHERE code = ?', ['new-skill'])).name,
    'Судалгаа, шинжилгээ'
  );
});
test('Reports enforce privacy; moderation hides content and writes an audit trail', async () => {
  const project = await createProject();
  const reported = await student.request('POST', '/community/reports', {
    target_type: 'project',
    target_id: project.id,
    reason: 'Худал мэдээлэл',
    description: 'Төслийн тайлбар дахь мэдээлэл бодит байдалтай нийцэхгүй.',
  });
  assert.equal(reported.status, 201);
  assert.equal(
    (
      await student.request('POST', `/admin/reports/${reported.data.id}/resolve`, {
        action: 'hide',
        reason: 'Шалгав',
      })
    ).status,
    403
  );
  assert.equal(
    (
      await admin.request('POST', `/admin/reports/${reported.data.id}/resolve`, {
        action: 'hide',
        reason: 'Шалгалтаар худал мэдээлэл болох нь тогтоогдов.',
      })
    ).status,
    200
  );
  assert.equal((await guest.request('GET', `/projects/${project.id}`)).status, 404);
  assert.ok(await db.get('SELECT id FROM audit WHERE target_id = ?', [project.id]));
  const privateMessage = await db.get('SELECT id FROM messages WHERE project_id = ?', [
    'demo-events',
  ]);
  assert.equal(
    (
      await student.request('POST', '/community/reports', {
        target_type: 'message',
        target_id: privateMessage.id,
        reason: 'Зөрчил',
        description: 'Өөр багийн мессежийг мэдээлэх туршилт.',
      })
    ).status,
    403
  );
});
test('Password reset tokens expire, are single-use and invalidate existing sessions', async () => {
  const local = client(app);
  await local.login('nomin@teamup.mn');
  const token = 'single-use-reset-token-12345678901234567890';
  await db.insert('tokens', {
    id: hashToken(token),
    user_id: 'demo-nomin',
    purpose: 'reset',
    expires_at: new Date(Date.now() + 60000).toISOString(),
  });
  assert.equal(
    (await guest.request('POST', '/auth/reset', { token, password: 'Changed123!' })).status,
    200
  );
  assert.equal(
    (await guest.request('POST', '/auth/reset', { token, password: 'Changed123!' })).status,
    400
  );
  assert.equal((await local.request('GET', '/auth/me')).data.user, null);
  const expired = 'expired-reset-token-12345678901234567890';
  await db.insert('tokens', {
    id: hashToken(expired),
    user_id: 'demo-nomin',
    purpose: 'reset',
    expires_at: '2000-01-01T00:00:00.000Z',
  });
  assert.equal(
    (await guest.request('POST', '/auth/reset', { token: expired, password: 'Changed123!' }))
      .status,
    400
  );
});
test('Portfolio ownership, recommendations, CSV export and logout behave correctly', async () => {
  const entry = await student.request('POST', '/users/me/portfolio', {
    title: 'Миний бүтээл',
    url: 'https://example.com',
    contribution: 'Frontend хөгжүүлсэн.',
  });
  assert.equal(entry.status, 201);
  assert.equal(
    (
      await owner.request('PATCH', `/users/me/portfolio/${entry.data.id}`, {
        title: 'Бусдын бүтээл',
        url: 'https://example.com',
        contribution: 'Буруу өөрчлөлт.',
      })
    ).status,
    404
  );
  assert.equal((await student.request('GET', '/users/recommendations')).status, 200);
  await db.insert('portfolios', {
    id: id(),
    user_id: 'demo-student',
    title: 'CSV туршилт',
    url: 'https://example.com',
    contribution: 'Туршилт',
    created_at: now(),
  });
  const exported = await admin.request('GET', '/admin/export?kind=users');
  assert.equal(exported.status, 200);
  assert.ok(!exported.raw.includes('scrypt:'));
  assert.ok(!exported.raw.includes('password'));
  const local = client(app);
  await local.login();
  await local.request('POST', '/auth/logout');
  assert.equal((await local.request('GET', '/auth/me')).data.user, null);
});
