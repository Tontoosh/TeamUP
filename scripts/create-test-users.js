import { loadEnvFile } from 'node:process';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { connectDatabase } from '../server/db/index.js';
import { hash } from '../server/password.js';
import { id, now } from '../server/utils.js';

export async function createTestUsers(db) {
  const password = await hash('Teamup123!');
  const accounts = [
    ['student@teamup.mn', 'Test Student', 'student'],
    ['owner@teamup.mn', 'Test Owner', 'student'],
    ['admin@teamup.mn', 'Test Admin', 'admin'],
  ];
  const results = [];
  await db.transaction(async () => {
    for (const [email, name, role] of accounts) {
      const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]);
      if (existing) {
        results.push(`${email}: already exists; password and permissions unchanged.`);
        continue;
      }
      await db.insert('users', {
        id: id(), email, password, name, school: 'TeamUp', major: 'Testing',
        skills: '[]', interests: '[]', experience: '', portfolio: '', hours: 0,
        bio: '', role, status: 'active', verified: 1, created_at: now(),
      });
      results.push(`${email}: created. Password: Teamup123!`);
    }
  });
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (existsSync('.env')) loadEnvFile('.env');
  let db;
  try {
    db = await connectDatabase();
    console.log((await createTestUsers(db)).join('\n'));
    console.log('Login at http://localhost:3001/login using the email address.');
  } catch (error) {
    console.error('Could not create test users:', error.message);
    process.exitCode = 1;
  } finally {
    if (db) await db.close();
  }
}
