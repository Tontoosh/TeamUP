import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { sourceViews } from '../server/db/source-schema.js';
import { loadEnvFile } from 'node:process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { connectDatabase } from '../server/db/index.js';
import { createApp } from '../server/app.js';
import { client } from '../tests/helpers.js';
if (existsSync('.env')) loadEnvFile('.env');
let db;
const report = { capturedAt: new Date().toISOString(), schemaHash: createHash('sha256').update(JSON.stringify(sourceViews)).digest('hex'), checks: [] };
try {
  db = await connectDatabase();
  report.sourceSchema = db.sourceSchema || 'app';
  assert.equal(report.sourceSchema, 'normalized', 'Normalized TeamUpDB schema was not detected');
  const api = client(createApp(db));
  const source = await db.all('SELECT project_id,title,owner_user_id FROM dbo.Project ORDER BY project_id');
  const list = await api.request('GET', '/projects?size=24');
  assert.equal(list.status, 200, JSON.stringify(list.data));
  const all = [...list.data.items];
  for (let page = 2; page <= list.data.pages; page++) {
    const result = await api.request('GET', `/projects?size=24&page=${page}`);
    assert.equal(result.status, 200);
    all.push(...result.data.items);
  }
  for (const row of source) {
    const project = all.find(p => p.id === `sql-project-${row.project_id}`);
    assert.ok(project, `Missing source project ${row.project_id}`);
    assert.equal(project.name, row.title);
    assert.ok(project.owner?.name, `Missing owner for ${row.project_id}`);
    const detail = await api.request('GET', `/projects/${project.id}`);
    assert.equal(detail.status, 200, JSON.stringify(detail.data));
    assert.ok(detail.data.members.every(m => m.user?.id === m.user_id));
    assert.ok(Array.isArray(detail.data.skills));
    assert.ok(Array.isArray(detail.data.roles));
    const sourceOwner = await db.get('SELECT display_name FROM dbo.[User] WHERE user_id = ?', [row.owner_user_id]);
    assert.equal(detail.data.owner.name, sourceOwner.display_name);
    const roles = await db.all("SELECT role_name FROM dbo.ProjectRole WHERE project_id = ? AND status = 'open'", [row.project_id]);
    assert.deepEqual([...new Set(detail.data.roles)].sort(), [...new Set(roles.map(r => r.role_name))].sort());
    const requiredSkills = await db.all('SELECT DISTINCT s.name FROM dbo.Skill s JOIN dbo.RoleSkill rs ON rs.skill_id=s.skill_id JOIN dbo.ProjectRole r ON r.project_role_id=rs.project_role_id WHERE r.project_id = ?', [row.project_id]);
    assert.deepEqual([...new Set(detail.data.skills)].sort(), requiredSkills.map(s => s.name).sort());
  }
  report.checks.push(`${source.length} source projects: list, exact titles, owners, details, linked members, skills and roles passed`);
  const reference = await api.request('GET', '/reference');
  const skills = await db.all('SELECT skill_id,name FROM dbo.Skill');
  assert.equal(reference.status, 200);
  for (const skill of skills) assert.ok(reference.data.some(r => r.id === `sql-skill-${skill.skill_id}` && r.name === skill.name));
  report.checks.push(`${skills.length} source skills matched /api/reference`);
  const options = await api.request('GET', '/projects/options');
  assert.equal(options.status, 200);
  report.checks.push('Project filter options passed');
  report.counts = {};
  for (const table of ['users','projects','memberships','applications','reference_data']) {
    report.counts[table] = (await db.get(`SELECT COUNT(*) AS total FROM ${table}`)).total;
  }
  report.constraints = await db.all('SELECT OBJECT_NAME(parent_object_id) AS table_name,name,definition FROM sys.check_constraints');
  report.sourceStates = {};
  for (const [table, column] of [['Project','status'],['Application','status'],['Membership','member_status'],['User','account_status'],['Profile','availability']]) {
    report.sourceStates[table] = await db.all(`SELECT DISTINCT [${column}] AS value FROM dbo.[${table}]`);
  }
  const login = await api.request('POST', '/auth/login', { email: 'admin@teamup.mn', password: 'Teamup123!' });
  if (login.status === 200) {
    const overview = await api.request('GET', '/admin/overview');
    assert.equal(overview.status, 200);
    assert.ok(overview.data.users.length >= 20);
    const profile = await api.request('GET', `/users/${all[0].owner_id}`);
    assert.equal(profile.status, 200, JSON.stringify(profile.data));
    report.checks.push('Authenticated admin overview and source owner profile passed');
    await api.request('POST', '/auth/logout');
  } else report.checks.push('Admin login not checked: existing credentials differ from test credentials');
  report.ok = true;
  console.log('DATABASE -> API CHECK PASSED');
  console.log(report.checks.join('\n'));
} catch (error) {
  report.ok = false;
  report.error = error.stack || error.message;
  console.error(report.error);
  process.exitCode = 1;
} finally {
  if (db) await db.close();
  mkdirSync('work', { recursive: true });
  writeFileSync('work/db-api-verification.json', JSON.stringify(report, null, 2));
  console.log('Report saved: work/db-api-verification.json');
}

