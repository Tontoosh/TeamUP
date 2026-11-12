import test from 'node:test';
import assert from 'node:assert/strict';
import { installSourceMapping, sourceViews } from '../server/db/source-schema.js';

test('Normalized schema maps all API reads including aliased profile joins to source views', async () => {
  const statements = [];
  const db = {
    driver: 'mssql',
    get: async () => ({ project_table: 1, user_table: 2 }),
    run: async query => { statements.push(query); },
    transaction: async work => work(),
  };
  await installSourceMapping(db);
  assert.equal(db.sourceSchema, 'normalized');
  assert.equal(db.mapRead('SELECT p.* FROM projects p JOIN memberships m ON p.id=m.project_id'),
    'SELECT p.* FROM dbo.teamup_api_projects p JOIN dbo.teamup_api_memberships m ON p.id=m.project_id');
  assert.equal(db.mapRead('SELECT * FROM users WHERE id = ?'), 'SELECT * FROM dbo.teamup_api_users WHERE id = ?');
  assert.equal(db.mapRead('SELECT * FROM dbo.Project'), 'SELECT * FROM dbo.Project');
  assert.equal(statements.filter(s => s.startsWith('CREATE OR ALTER VIEW')).length, 5);
  assert.ok(statements.filter(s => s.startsWith('INSERT')).every(s => /NOT EXISTS/.test(s)));
  assert.ok(statements.every(s => !/DELETE|DROP TABLE|TRUNCATE|UPDATE dbo\.\[User\]/i.test(s)));
  assert.match(sourceViews.projects, /dbo\.Project p/);
  assert.match(sourceViews.projects, /dbo\.RoleSkill/);
  assert.match(sourceViews.users, /a.email=u.email/);
  assert.match(sourceViews.memberships, /m.member_status='active'/);
  assert.match(sourceViews.applications, /JOIN dbo.ProjectRole/);
});

test('SQLite skips SQL Server source mapping', async () => {
  const db = { driver: 'sqlite' };
  await installSourceMapping(db);
  assert.equal(db.mapRead, undefined);
});
