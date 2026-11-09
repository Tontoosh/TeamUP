import { Router } from 'express';
import { z } from 'zod';
import { readCsv } from '../csv.js';
import { requireUser, requireAdmin } from '../auth.js';
import { check, id, now, notify, parse, publicUser, text } from '../utils.js';

const csvCell = value =>
  `"${String(value ?? '')
    .replace(/^[\s]*[=+@\-\t\r]/, "'$&")
    .replaceAll('"', '""')}"`;
const importSchema = z.object({
  code: text(1, 100).regex(/^[a-zA-Z0-9_-]+$/),
  name: text(1, 160),
  type: z.enum(['category', 'skill']),
});
export function adminRoutes(db) {
  const router = Router();
  router.use(requireUser, requireAdmin);
  router.get('/overview', async (_req, res) => {
    const users = await db.all('SELECT * FROM users');
    const projects = await db.all('SELECT * FROM projects');
    const reports = await db.all('SELECT * FROM reports ORDER BY created_at DESC');
    const audit = await db.all('SELECT * FROM audit ORDER BY created_at DESC');
    res.json({ users: users.map(publicUser), projects, reports, audit });
  });
  router.get('/reports/:id', async (req, res) => {
    const report = await db.get('SELECT * FROM reports WHERE id = ?', [req.params.id]);
    check(report, 'Зөрчил олдсонгүй.', 404);
    const table = { project: 'projects', user: 'users', message: 'messages' }[report.target_type];
    const row = await db.get(`SELECT * FROM ${table} WHERE id = ?`, [report.target_id]);
    const content = report.target_type === 'user' ? publicUser(row) : row;
    const audit = await db.all('SELECT * FROM audit WHERE target_id = ? ORDER BY created_at DESC', [
      report.target_id,
    ]);
    res.json({ report, content, audit });
  });
  router.post('/reports/:id/resolve', async (req, res) => {
    const data = parse(
      z.object({ action: z.enum(['hide', 'delete', 'suspend', 'dismiss']), reason: text(3, 3000) }),
      req.body
    );
    await db.transaction(async () => {
      const report = await db.get('SELECT * FROM reports WHERE id = ?', [req.params.id]);
      check(report, 'Зөрчил олдсонгүй.', 404);
      check(report.status === 'pending', 'Зөрчил өмнө нь шийдвэрлэгдсэн.', 409);
      const table = { project: 'projects', user: 'users', message: 'messages' }[report.target_type];
      const target = await db.get(`SELECT * FROM ${table} WHERE id = ?`, [report.target_id]);
      check(target, 'Контент олдсонгүй.', 404);
      let values = {};
      if (data.action === 'suspend') {
        check(
          report.target_type === 'user' && target.role !== 'admin' && target.id !== req.user.id,
          'Энэ хэрэглэгчийг түдгэлзүүлэх боломжгүй.'
        );
        values = { status: 'suspended' };
      } else if (['hide', 'delete'].includes(data.action)) {
        check(report.target_type !== 'user', 'Профайлд эрх түдгэлзүүлэх үйлдлийг сонгоно уу.');
        values = { visibility: data.action === 'hide' ? 'hidden' : 'deleted' };
      }
      if (Object.keys(values).length) await db.update(table, target.id, values);
      await db.update('reports', report.id, { status: 'resolved', decision: data.reason });
      await db.insert('audit', {
        id: id(),
        admin_id: req.user.id,
        target_type: report.target_type,
        target_id: target.id,
        action: data.action,
        reason: data.reason,
        before_state: JSON.stringify({ status: target.status, visibility: target.visibility }),
        after_state: JSON.stringify(values),
        created_at: now(),
      });
      await notify(
        db,
        report.user_id,
        'Таны илгээсэн зөрчлийн мэдээллийг шийдвэрлэлээ.',
        '/settings'
      );
      const owner = report.target_type === 'user' ? target.id : target.owner_id || target.user_id;
      if (owner !== report.user_id)
        await notify(db, owner, `Хяналтын шийдвэр: ${data.reason}`, '/settings');
    });
    res.json({ ok: true });
  });
  router.get('/export', async (req, res) => {
    const kind = String(req.query.kind || 'projects');
    check(['projects', 'users', 'reports', 'audit'].includes(kind), 'Тайлангийн төрөл буруу.');
    const from = String(req.query.from || ''),
      to = String(req.query.to || '');
    check(!from || /^\d{4}-\d{2}-\d{2}$/.test(from), 'Эхлэх огноо буруу.');
    check(!to || /^\d{4}-\d{2}-\d{2}$/.test(to), 'Дуусах огноо буруу.');
    let rows = await db.all(`SELECT * FROM ${kind} ORDER BY created_at DESC`);
    if (from) rows = rows.filter(row => row.created_at.slice(0, 10) >= from);
    if (to) rows = rows.filter(row => row.created_at.slice(0, 10) <= to);
    if (req.query.status) rows = rows.filter(row => row.status === req.query.status);
    check(rows.length <= 10000, '10,000 мөрөөс их байна. Огноо/төлөвийн шүүлтүүр ашиглана уу.');
    if (kind === 'users') rows = rows.map(({ password, email, ...user }) => user);
    const columns = Object.keys(rows[0] || { id: '' });
    const content =
      '\uFEFF' +
      [columns.join(','), ...rows.map(row => columns.map(key => csvCell(row[key])).join(','))].join(
        '\r\n'
      );
    res
      .type('text/csv; charset=utf-8')
      .attachment(`teamup-${kind}.csv`)
      .send(content);
  });
  async function validateImport(body) {
    const { csv } = parse(z.object({ csv: text(1, 2000000) }), body);
    let rows;
    try {
      rows = await readCsv(csv.replace(/^\uFEFF/, ''), {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        max_record_size: 10000,
      });
    } catch {
      check(false, 'CSV бүтэц буруу байна.');
    }
    check(rows.length > 0 && rows.length <= 5000, '1–5,000 мөртэй CSV оруулна уу.');
    const seen = new Set();
    const valid = rows.map((row, index) => {
      check(
        Object.keys(row)
          .sort()
          .join(',') === 'code,name,type',
        `${index + 2}-р мөр: code,name,type багана шаардлагатай.`
      );
      const parsed = importSchema.safeParse(row);
      check(parsed.success, `${index + 2}-р мөрийн утга буруу байна.`);
      check(!seen.has(row.code.toLowerCase()), `${index + 2}-р мөр: code давхардсан.`);
      seen.add(row.code.toLowerCase());
      return { ...parsed.data, code: row.code.toLowerCase() };
    });
    const existing = await db.all('SELECT code FROM reference_data');
    check(
      !valid.some(row => existing.some(item => item.code.toLowerCase() === row.code)),
      'Өгөгдлийн санд байгаа code давхардсан.'
    );
    return valid;
  }
  router.post('/import/preview', async (req, res) => {
    const rows = await validateImport(req.body);
    res.json({ count: rows.length, rows: rows.slice(0, 20) });
  });
  router.post('/import', async (req, res) => {
    let count;
    await db.transaction(async () => {
      const rows = await validateImport(req.body);
      for (const row of rows) await db.insert('reference_data', { id: id(), ...row });
      count = rows.length;
      await db.insert('audit', {
        id: id(),
        admin_id: req.user.id,
        target_type: 'reference_data',
        target_id: id(),
        action: 'import',
        reason: `${count} лавлах өгөгдөл импортолсон.`,
        before_state: '{}',
        after_state: JSON.stringify({ count }),
        created_at: now(),
      });
    });
    res.json({ count });
  });
  return router;
}
