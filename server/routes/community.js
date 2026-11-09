import { Router } from 'express';
import { z } from 'zod';
import { requireUser } from '../auth.js';
import { check, id, now, parse, projectAccess, publicUser, text } from '../utils.js';

export function communityRoutes(db) {
  const router = Router();
  router.use(requireUser);
  router.get('/notifications', async (req, res) => {
    let rows = await db.all(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    const unread = rows.filter(row => !row.is_read).length;
    if (req.query.unread === 'true') rows = rows.filter(row => !row.is_read);
    res.json({ items: rows, unread });
  });
  router.patch('/notifications/read', async (req, res) => {
    if (req.body.id)
      await db.run('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND id = ?', [
        req.user.id,
        req.body.id,
      ]);
    else await db.run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
    res.json({ ok: true });
  });
  router.post('/reports', async (req, res) => {
    const data = parse(
      z.object({
        target_type: z.enum(['project', 'user', 'message']),
        target_id: text(1, 36),
        reason: text(3, 200),
        description: text(10, 3000),
      }),
      req.body
    );
    const table = { project: 'projects', user: 'users', message: 'messages' }[data.target_type];
    const target = await db.get(`SELECT * FROM ${table} WHERE id = ?`, [data.target_id]);
    check(
      target && (!target.visibility || target.visibility === 'visible'),
      'Мэдээлэх контент олдсонгүй.',
      404
    );
    if (data.target_type === 'message') await projectAccess(db, target.project_id, req.user);
    check(
      !(await db.get(
        "SELECT id FROM reports WHERE user_id = ? AND target_type = ? AND target_id = ? AND status = 'pending'",
        [req.user.id, data.target_type, data.target_id]
      )),
      'Ижил зөрчлийн мэдээлэл хүлээгдэж байна.',
      409
    );
    const report = {
      ...data,
      id: id(),
      user_id: req.user.id,
      status: 'pending',
      decision: '',
      created_at: now(),
    };
    await db.insert('reports', report);
    res.status(201).json(report);
  });
  router.get('/reports', async (req, res) =>
    res.json(
      await db.all('SELECT * FROM reports WHERE user_id = ? ORDER BY created_at DESC', [
        req.user.id,
      ])
    )
  );
  router.get('/blocks', async (req, res) => {
    const rows = await db.all('SELECT * FROM blocks WHERE user_id = ?', [req.user.id]);
    res.json(
      await Promise.all(
        rows.map(async row => ({
          ...row,
          user: publicUser(await db.get('SELECT * FROM users WHERE id = ?', [row.target_id])),
        }))
      )
    );
  });
  router.post('/blocks', async (req, res) => {
    const { target_id } = parse(z.object({ target_id: text(1, 36) }), req.body);
    check(target_id !== req.user.id, 'Өөрийгөө блоклохгүй.');
    check(
      await db.get('SELECT id FROM users WHERE id = ?', [target_id]),
      'Хэрэглэгч олдсонгүй.',
      404
    );
    if (
      !(await db.get('SELECT id FROM blocks WHERE user_id = ? AND target_id = ?', [
        req.user.id,
        target_id,
      ]))
    ) {
      await db.insert('blocks', { id: id(), user_id: req.user.id, target_id });
    }
    res.json({ ok: true });
  });
  router.delete('/blocks/:id', async (req, res) => {
    await db.run('DELETE FROM blocks WHERE user_id = ? AND target_id = ?', [
      req.user.id,
      req.params.id,
    ]);
    res.json({ ok: true });
  });
  return router;
}
