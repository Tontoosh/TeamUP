import { randomUUID } from 'node:crypto';
import { z } from 'zod';

export const id = () => randomUUID();
export const now = () => new Date().toISOString();
export const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
export const check = (condition, message, status = 400) => {
  if (!condition) fail(status, message);
};
export const text = (min = 1, max = 3000) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max);
export const link = z.union([z.literal(''), z.url().refine(url => /^https?:\/\//i.test(url))]);
export const strings = z.array(text(1, 80)).max(30);
export const parse = (schema, body) => {
  const result = schema.safeParse(body);
  check(
    result.success,
    result.error?.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ') ||
      'Мэдээлэл буруу байна.'
  );
  return result.data;
};
export const decode = row =>
  row &&
  Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      ['skills', 'interests', 'roles'].includes(key) ? JSON.parse(value) : value,
    ])
  );
export const publicUser = row => {
  if (!row) return null;
  const { password, email, verified, ...user } = decode(row);
  return user;
};
export const currentUser = row => ({
  ...publicUser(row),
  email: row.email,
  verified: row.verified,
});
export async function notify(db, userId, title, link) {
  await db.insert('notifications', {
    id: id(),
    user_id: userId,
    title,
    link,
    is_read: 0,
    created_at: now(),
  });
}
export async function notifyTeam(db, projectId, except, title, link) {
  for (const member of await db.all('SELECT user_id FROM memberships WHERE project_id = ?', [
    projectId,
  ])) {
    if (member.user_id !== except) await notify(db, member.user_id, title, link);
  }
}
export async function projectAccess(db, projectId, user, owner = false) {
  const project = await db.get('SELECT * FROM projects WHERE id = ?', [projectId]);
  check(project && project.visibility === 'visible', 'Төсөл олдсонгүй.', 404);
  const membership = await db.get(
    'SELECT * FROM memberships WHERE project_id = ? AND user_id = ?',
    [projectId, user.id]
  );
  check(owner ? project.owner_id === user.id : membership, 'Энэ төсөлд хандах эрхгүй.', 403);
  return decode(project);
}
export async function isBlocked(db, a, b) {
  return !!(await db.get(
    'SELECT id FROM blocks WHERE (user_id = ? AND target_id = ?) OR (user_id = ? AND target_id = ?)',
    [a, b, b, a]
  ));
}
