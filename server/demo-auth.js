import { check } from './utils.js';

export const demoAccounts = {
  student: 'demo-student',
  owner: 'demo-owner',
  admin: 'demo-admin',
};

export function demoRole(req) {
  const cookie = req.headers.cookie
    ?.split(';')
    .find(part => part.trim().startsWith('teamup_demo_role='));
  const role = cookie?.trim().slice('teamup_demo_role='.length);
  return Object.hasOwn(demoAccounts, role || '') ? role : 'student';
}

export async function demoUser(db, role) {
  const user = await db.get('SELECT * FROM users WHERE id = ?', [demoAccounts[role]]);
  check(
    user?.status === 'active',
    'Туршилтын хэрэглэгч алга. Жишээ өгөгдөлтэй SQLite ашиглана уу.',
    503
  );
  return user;
}
