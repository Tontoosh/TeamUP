import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connectDatabase } from '../server/db/index.js';
import { tables, createSchema } from '../server/db/schema.js';
import { loadUserMatching, matchingUser, saveRoleRequirements, saveSkillLevels } from '../server/matching/store.js';
import { projectData } from './helpers.js';

test('Existing SQLite databases gain matching tables without rewriting old data; new data survives restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'teamup-matching-'));
  const file = join(directory, 'legacy.db');
  const previous = { ...process.env };
  let db;
  try {
    const matchingTables = new Set(['user_skill_levels', 'role_settings', 'role_requirements',
      'project_completions', 'completion_members', 'peer_reviews']);
    const legacy = new DatabaseSync(file);
    for (const [name, columns] of Object.entries(tables)) {
      if (!matchingTables.has(name)) legacy.exec(`CREATE TABLE ${name} (${columns})`);
    }
    const user = {
      id: 'legacy', email: 'legacy@example.com', password: 'keep-existing-hash', name: 'Хуучин хэрэглэгч',
      school: 'МУИС', major: 'Программ хангамж', skills: '["React"]', interests: '["EdTech"]',
      experience: '', portfolio: '', hours: 8, bio: '', role: 'student', status: 'active', verified: 1, created_at: '2026-01-01',
    };
    const insert = (table, value) => legacy.prepare(`INSERT INTO ${table} (${Object.keys(value).join(',')})
      VALUES (${Object.keys(value).map(() => '?').join(',')})`).run(...Object.values(value));
    insert('users', user);
    insert('users', { ...user, id: 'teammate', email: 'teammate@example.com' });
    const project = { ...projectData(), id: 'old-project', owner_id: user.id,
      skills: '["React"]', roles: '["Хөгжүүлэгч"]', status: 'open', visibility: 'visible', created_at: '2026-01-01' };
    insert('projects', project);
    legacy.close();
    process.env.DB_DRIVER = 'sqlite'; process.env.SQLITE_PATH = file;
    db = await connectDatabase();
    assert.deepEqual({ ...await db.get('SELECT * FROM users WHERE id = ?', [user.id]) }, user);
    assert.equal((await db.all('SELECT * FROM user_skill_levels')).length, 0);
    await createSchema(db);
    await db.transaction(async () => {
      await saveSkillLevels(db, user.id, ['React'], [{ skill: 'React', level: 3 }]);
      await saveRoleRequirements(db, { ...projectData(), id: project.id }, [{
        role: 'Хөгжүүлэгч', hours: 8, hoursRequired: true,
        skills: [{ skill: 'React', minLevel: 3, required: true, weight: 4 }],
      }]);
      await db.insert('project_completions', { id: project.id, completed_at: '2026-11-18' });
      for (const member of ['legacy', 'teammate']) await db.insert('completion_members', {
        id: member, project_id: project.id, user_id: member, role: 'Хөгжүүлэгч',
      });
      await db.insert('peer_reviews', { id: 'review', project_id: project.id, author_id: 'teammate', target_id: 'legacy',
        quality: 5, reliability: 5, communication: 4, comment: 'Хамт ажилласан төслийн бодит үнэлгээ.', created_at: '2026-11-18' });
    });
    await db.close(); db = null;
    db = await connectDatabase();
    const restored = matchingUser(await db.get('SELECT * FROM users WHERE id = ?', [user.id]), await loadUserMatching(db, user.id));
    assert.deepEqual(restored.skillLevels, [{ skill: 'React', level: 3 }]);
    assert.equal(restored.reputation.count, 1);
    assert.equal(restored.reputation.reviewers, 1);
    assert.equal((await db.all('SELECT * FROM role_settings')).length, 1);
    assert.equal((await db.all('SELECT * FROM completion_members')).length, 2);
    assert.equal((await db.get('SELECT password FROM users WHERE id = ?', [user.id])).password, user.password);
  } finally {
    if (db) await db.close();
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
    await rm(directory, { recursive: true, force: true });
  }
});
