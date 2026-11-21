import { check } from './utils.js';

export function pagination(query, defaultSize = 6) {
  const integer = (value, fallback) => {
    const number = Number(value);
    return Number.isSafeInteger(number) && number > 0 ? number : fallback;
  };
  const size = Math.min(24, integer(query.size, defaultSize));
  const page = Math.min(Math.floor(2147483647 / size) + 1, integer(query.page, 1));
  return { page, size, offset: (page - 1) * size };
}

// Filter and paginate before loading owners, memberships and matching metadata.
export async function searchProjects(db, query, user) {
  const where = ["p.visibility = 'visible'"];
  const values = [];
  const lower = db.driver === 'sqlite' ? 'teamup_lower' : 'LOWER';
  const contains = (field, value) => {
    // Escape LIKE syntax so %, _ and [ remain literal search characters.
    values.push(`%${String(value).toLowerCase().replace(/[!%_\[]/g, '!$&')}%`);
    return `${lower}(${field}) LIKE ? ESCAPE '!'`;
  };
  const skills = db.driver === 'sqlite' ? 'json_each(p.skills)' : 'OPENJSON(p.skills)';
  if (query.mine && query.mine !== 'false') {
    check(user, 'Нэвтэрнэ үү.', 401);
    where.push('EXISTS (SELECT 1 FROM memberships mine WHERE mine.project_id = p.id AND mine.user_id = ?)');
    values.push(user.id);
  }
  if (query.q) where.push(`(${contains('p.name', query.q)} OR ${contains('p.description', query.q)} OR
    EXISTS (SELECT 1 FROM ${skills} s WHERE ${contains('s.value', query.q)}))`);
  for (const [key, field] of [['category', 'category'], ['type', 'project_type'], ['status', 'status']]) {
    if (query[key]) {
      where.push(`p.${field} = ?`);
      values.push(String(query[key]));
    }
  }
  if (query.skill) where.push(`EXISTS (SELECT 1 FROM ${skills} s WHERE ${contains('s.value', query.skill)})`);
  if (query.duration) {
    const duration = Number(query.duration);
    if (Number.isFinite(duration)) {
      where.push('p.duration > 0 AND p.duration <= ?');
      values.push(duration);
    } else where.push('1 = 0');
  }
  const { page, size, offset } = pagination(query);
  const filter = where.join(' AND ');
  const { total } = await db.get(`SELECT COUNT(*) AS total FROM projects p WHERE ${filter}`, values);
  const order = query.sort === 'spaces'
    ? 'p.capacity - (SELECT COUNT(*) FROM memberships m WHERE m.project_id = p.id) DESC, ' : '';
  const limit = db.driver === 'sqlite' ? 'LIMIT ? OFFSET ?' : 'OFFSET ? ROWS FETCH NEXT ? ROWS ONLY';
  const rows = await db.all(`SELECT p.* FROM projects p WHERE ${filter}
    ORDER BY ${order}p.created_at DESC, p.id DESC ${limit}`,
  [...values, ...(db.driver === 'sqlite' ? [size, offset] : [offset, size])]);
  return { rows, total, page, pages: Math.ceil(total / size) };
}

// Keep SQL Server well below its parameter limit for large profile histories.
export async function relatedRows(db, table, field, ids) {
  const unique = [...new Set(ids)];
  const rows = [];
  for (let start = 0; start < unique.length; start += 400) {
    const batch = unique.slice(start, start + 400);
    rows.push(...await db.all(`SELECT * FROM ${table} WHERE ${field} IN (${batch.map(() => '?').join(',')})`, batch));
  }
  return rows;
}
