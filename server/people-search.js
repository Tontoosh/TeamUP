import { pagination } from './project-search.js';

export async function searchPeople(db, query, userId) {
  const where = ["u.status = 'active'", "u.role = 'student'", 'u.id <> ?',
    'NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.user_id = ? AND b.target_id = u.id) OR (b.target_id = ? AND b.user_id = u.id))'];
  const values = [userId, userId, userId];
  const lower = db.driver === 'sqlite' ? 'teamup_lower' : 'LOWER';
  const contains = (field, value) => {
    values.push(`%${String(value).toLowerCase().replace(/[!%_\[]/g, '!$&')}%`);
    return `${lower}(${field}) LIKE ? ESCAPE '!'`;
  };
  if (query.q) {
    const name = db.driver === 'sqlite' ? "u.name || ' ' || u.school || ' ' || u.major"
      : "CONCAT(u.name, ' ', u.school, ' ', u.major)";
    where.push(contains(name, query.q));
  }
  for (const field of ['major', 'experience']) if (query[field]) where.push(contains(`u.${field}`, query[field]));
  for (const [key, field] of [['skill', 'skills'], ['interest', 'interests']]) {
    if (!query[key]) continue;
    const list = db.driver === 'sqlite' ? `json_each(u.${field})` : `OPENJSON(u.${field})`;
    where.push(`EXISTS (SELECT 1 FROM ${list} s WHERE ${contains('s.value', query[key])})`);
  }
  if (query.hours) {
    const hours = Number(query.hours);
    if (Number.isFinite(hours)) { where.push('u.hours >= ?'); values.push(hours); }
    else where.push('1 = 0');
  }
  const filter = where.join(' AND ');
  const { total } = await db.get(`SELECT COUNT(*) AS total FROM users u WHERE ${filter}`, values);
  const { page, size, offset } = pagination({ ...query, size: 12 }, 12);
  // Project-specific ranking needs all eligible candidates before selecting a page.
  const limit = query.project ? '' : db.driver === 'sqlite' ? 'LIMIT ? OFFSET ?' : 'OFFSET ? ROWS FETCH NEXT ? ROWS ONLY';
  const params = query.project ? values : [...values, ...(db.driver === 'sqlite' ? [size, offset] : [offset, size])];
  const rows = await db.all(`SELECT u.* FROM users u WHERE ${filter} ORDER BY u.created_at DESC, u.id DESC ${limit}`, params);
  return { rows, total, page, pages: Math.ceil(total / size) };
}
