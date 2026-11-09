import { test } from 'node:test';
import assert from 'node:assert/strict';
import { db, owner, student, guest, admin, createProject, apply } from './fixture.js';
import { id, now } from '../server/utils.js';

test('Search caches invalidate after edits, moderation and block changes', async () => {
  const project = await createProject({ name: 'Кэшийн шинэчлэлтийн төсөл' });
  const url = `/projects?q=${encodeURIComponent('Кэшийн шинэчлэлтийн')}`;
  assert.equal((await guest.request('GET', url)).data.total, 1);
  assert.equal((await guest.request('GET', url)).data.total, 1);
  await db.update('projects', project.id, { visibility: 'hidden' });
  assert.equal((await guest.request('GET', url)).data.total, 0);
  const peopleUrl = '/users/people?q=' + encodeURIComponent('Тэмүүлэн');
  assert.equal((await student.request('GET', peopleUrl)).data.total, 1);
  await student.request('POST', '/community/blocks', { target_id: 'demo-owner' });
  assert.equal((await student.request('GET', peopleUrl)).data.total, 0);
  await student.request('DELETE', '/community/blocks/demo-owner');
});

test('Owners can change member roles; foreign and finalized requests remain immutable', async () => {
  const project = await createProject();
  const request = await apply(project);
  assert.equal(
    (await student.request('POST', `/applications/${request.id}/decision`, { action: 'accepted' }))
      .status,
    403
  );
  await owner.request('POST', `/applications/${request.id}/decision`, { action: 'accepted' });
  assert.equal(
    (
      await owner.request('PATCH', `/projects/${project.id}/members/demo-student`, {
        role: 'Ахлах хөгжүүлэгч',
      })
    ).status,
    200
  );
  const membership = await db.get(
    'SELECT * FROM memberships WHERE project_id = ? AND user_id = ?',
    [project.id, 'demo-student']
  );
  assert.equal(membership.role, 'Ахлах хөгжүүлэгч');
  assert.equal(
    (
      await student.request('POST', `/applications/${request.id}/reply`, {
        answer: 'Хожим өгсөн хариулт',
      })
    ).status,
    409
  );
  assert.equal(
    (
      await owner.request('POST', `/applications/${request.id}/decision`, {
        action: 'rejected',
        reason: 'Хожим татгалзах',
      })
    ).status,
    409
  );
});

test('Admin report inspection exposes the reported message only to administrators', async () => {
  const message = await db.get('SELECT * FROM messages WHERE project_id = ?', ['demo-events']);
  const report = await owner.request('POST', '/community/reports', {
    target_type: 'message',
    target_id: message.id,
    reason: 'Мессежийн шалгалт',
    description: 'Админы мессежийн агуулга харах туршилтын тайлбар.',
  });
  assert.equal(report.status, 201);
  assert.equal((await student.request('GET', `/admin/reports/${report.data.id}`)).status, 403);
  const context = await admin.request('GET', `/admin/reports/${report.data.id}`);
  assert.equal(context.status, 200);
  assert.equal(context.data.content.body, message.body);
});

test('CSV import accepts 5,000 rows, rejects 5,001 rows and duplicate codes atomically', async t => {
  const rows = Array.from(
    { length: 5000 },
    (_, index) => `batch-${index},Ур чадвар ${index},skill`
  );
  const csv = 'code,name,type\n' + rows.join('\n');
  const started = performance.now();
  const response = await admin.request('POST', '/admin/import', { csv });
  assert.equal(response.status, 200);
  assert.equal(response.data.count, 5000);
  t.diagnostic(
    `5,000-row SQLite import: ${(performance.now() - started).toFixed(1)} ms (in-process)`
  );
  assert.equal(
    (await admin.request('POST', '/admin/import', { csv: `${csv}\nextra,Илүү,skill` })).status,
    400
  );
  const duplicate = 'code,name,type\nunique-duplicate,Эхний,skill\nUNIQUE-DUPLICATE,Дараах,skill';
  assert.equal((await admin.request('POST', '/admin/import', { csv: duplicate })).status, 400);
  assert.equal(
    await db.get('SELECT id FROM reference_data WHERE code = ?', ['unique-duplicate']),
    undefined
  );
});

test('CSV export enforces the 10,000 row boundary and neutralizes spreadsheet formulas', async t => {
  const created = [];
  await db.transaction(async () => {
    for (let index = 0; index < 10001; index++) {
      const reportId = id();
      created.push(reportId);
      await db.insert('reports', {
        id: reportId,
        user_id: 'demo-student',
        target_type: 'project',
        target_id: 'demo-events',
        reason: '=FORMULA()',
        description: 'Экспортын мөрийн хязгаарын тест.',
        status: 'export-test',
        decision: '',
        created_at: now(),
      });
    }
  });
  assert.equal(
    (await admin.request('GET', '/admin/export?kind=reports&status=export-test')).status,
    400
  );
  await db.run('DELETE FROM reports WHERE id = ?', [created.pop()]);
  const started = performance.now();
  const response = await admin.request('GET', '/admin/export?kind=reports&status=export-test');
  assert.equal(response.status, 200);
  assert.equal(response.raw.split('\r\n').length, 10001);
  assert.ok(response.raw.includes("'=FORMULA()"));
  t.diagnostic(
    `10,000-row SQLite export: ${(performance.now() - started).toFixed(1)} ms (in-process)`
  );
  await db.run("DELETE FROM reports WHERE status = 'export-test'");
});
