import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { connectDatabase } from '../server/db/index.js';
import { searchProjects } from '../server/project-search.js';
import { searchPeople } from '../server/people-search.js';
import { decorateProjects } from '../server/routes/projects.js';
import { loadUserMatching, matchingUser } from '../server/matching/store.js';

// Disposable synthetic data only. Never load .env or touch the application DB.
process.env.DB_DRIVER = 'sqlite';
process.env.SQLITE_PATH = ':memory:';
const db = await connectDatabase();
try {
  const started = performance.now();
  await db.transaction(async () => {
    for (let i = 0; i < 100000; i++) await db.insert('users', {
      id: `user-${i}`, email: `synthetic-${i}@example.invalid`, password: '', name: `Оюутан ${i}`,
      school: 'МУИС', major: 'Программ хангамж', skills: '["React"]', interests: '["EdTech"]',
      experience: '', portfolio: '', hours: 12, bio: '', role: 'student', status: 'active',
      verified: 0, created_at: '2026-01-01T00:00:00.000Z',
    });
    for (let i = 0; i < 50000; i++) {
      await db.insert('projects', {
        id: `project-${i}`, owner_id: `user-${i}`, name: `Төсөл ${i}`, description: 'Хамтран бүтээх төсөл',
        category: 'EdTech', project_type: 'Стартап', goal: 'Туршилт', duration: 12, capacity: 5,
        skills: '["React"]', roles: '["Хөгжүүлэгч"]', hours: 8, status: 'open', visibility: 'visible',
        created_at: '2026-01-01T00:00:00.000Z',
      });
      await db.insert('memberships', { id: `member-${i}`, user_id: `user-${i}`, project_id: `project-${i}`,
        role: 'Эзэмшигч', created_at: '2026-01-01T00:00:00.000Z' });
    }
  });
  const sample = async (name, run) => {
    const durations = [];
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      await run();
      durations.push(Math.round((performance.now() - start) * 10) / 10);
    }
    console.log(JSON.stringify({ name, samplesMs: durations, maxMs: Math.max(...durations) }));
  };
  console.log(JSON.stringify({ node: process.version, database: 'SQLite in-memory', users: 100000,
    projects: 50000, memberships: 50000, setupMs: Math.round(performance.now() - started) }));
  await sample('Project list with decoration', async () => {
    const result = await searchProjects(db, { size: 24 });
    assert.equal(result.total, 50000);
    assert.equal((await decorateProjects(db, result.rows)).length, 24);
  });
  await sample('Filtered Mongolian project search', async () => {
    const result = await searchProjects(db, { q: 'ТӨСӨЛ 49999', skill: 'react' });
    assert.equal(result.total, 1);
    assert.equal(result.rows[0].id, 'project-49999');
  });
  await sample('People search with matching metadata', async () => {
    const result = await searchPeople(db, { skill: 'react', hours: 8 }, 'user-0');
    assert.equal(result.total, 99999);
    const matching = await loadUserMatching(db, result.rows.map(user => user.id));
    assert.equal(result.rows.map(user => matchingUser(user, matching)).length, 12);
  });
} finally { await db.close(); }
