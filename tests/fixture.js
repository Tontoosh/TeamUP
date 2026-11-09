import { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connectDatabase } from '../server/db/index.js';
import { seedDatabase } from '../server/db/seed.js';
import { createApp } from '../server/app.js';
import { client, projectData } from './helpers.js';

let directory;
export let db, app, owner, student, guest, admin;
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'teamup-test-'));
  process.env.DB_DRIVER = 'sqlite';
  process.env.SEED_DEMO = 'true';
  delete process.env.SMTP_HOST;
  process.env.SQLITE_PATH = ':memory:';
  process.env.UPLOAD_PATH = join(directory, 'uploads');
  db = await connectDatabase();
  await seedDatabase(db);
  app = createApp(db);
  owner = client(app);
  student = client(app);
  guest = client(app);
  admin = client(app);
  await owner.login('owner@teamup.mn');
  await student.login();
  await admin.login('admin@teamup.mn');
});
after(async () => {
  await db.close();
  await rm(directory, { recursive: true, force: true });
});
export async function createProject(changes) {
  const response = await owner.request('POST', '/projects', projectData(changes));
  assert.equal(response.status, 201, JSON.stringify(response.data));
  return response.data;
}
export async function apply(project, role = 'Хөгжүүлэгч') {
  const response = await student.request('POST', '/applications', {
    project_id: project.id,
    role,
    introduction: 'React ашиглан веб хөгжүүлж байсан туршлагатай.',
  });
  assert.equal(response.status, 201, JSON.stringify(response.data));
  return response.data;
}

