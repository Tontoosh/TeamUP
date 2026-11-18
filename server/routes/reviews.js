import { Router } from 'express';
import { z } from 'zod';
import { requireUser } from '../auth.js';
import { check, id, isBlocked, now, notify, parse, text } from '../utils.js';
import { reputationSummary } from '../matching/algorithm.js';

const rating = z.number().int().min(1).max(5);
const reviewSchema = z.object({
  project_id: text(1, 36), target_id: text(1, 36),
  quality: rating, reliability: rating, communication: rating, comment: text(10, 2000),
});

export function reviewRoutes(db) {
  const router = Router();
  router.use(requireUser);
  router.get('/:userId', async (req, res) => {
    const target = req.params.userId;
    check(await db.get("SELECT id FROM users WHERE id = ? AND status = 'active'", [target]), 'Хэрэглэгч олдсонгүй.', 404);
    const reviews = await db.all(`SELECT r.*, u.name AS author_name, p.name AS project_name,
      m.role AS target_role FROM peer_reviews r JOIN users u ON u.id = r.author_id
      JOIN projects p ON p.id = r.project_id
      JOIN completion_members m ON m.project_id = r.project_id AND m.user_id = r.target_id
      WHERE r.target_id = ? AND p.visibility = 'visible' ORDER BY r.created_at DESC, r.id DESC`, [target]);
    const canReview = target !== req.user.id && !(await isBlocked(db, req.user.id, target));
    const eligibleProjects = canReview ? await db.all(`SELECT p.id, p.name FROM projects p
      JOIN project_completions c ON c.id = p.id
      JOIN completion_members a ON a.project_id = p.id AND a.user_id = ?
      JOIN completion_members t ON t.project_id = p.id AND t.user_id = ?
      WHERE p.visibility = 'visible' AND NOT EXISTS
      (SELECT 1 FROM peer_reviews r WHERE r.project_id = p.id AND r.author_id = ? AND r.target_id = ?)
      ORDER BY c.completed_at DESC`, [req.user.id, target, req.user.id, target]) : [];
    res.json({ items: reviews.slice(0, 50), total: reviews.length, reputation: reputationSummary(reviews), eligibleProjects });
  });
  router.post('/', async (req, res) => {
    const data = parse(reviewSchema, req.body);
    await db.transaction(async () => {
      check(data.target_id !== req.user.id, 'Өөрийгөө үнэлэх боломжгүй.');
      check(await db.get("SELECT id FROM users WHERE id = ? AND status = 'active'", [data.target_id]), 'Хэрэглэгч олдсонгүй.', 404);
      check(!(await isBlocked(db, req.user.id, data.target_id)), 'Блоклосон хэрэглэгчид үнэлгээ өгөхгүй.', 403);
      const project = await db.get("SELECT * FROM projects WHERE id = ? AND visibility = 'visible'", [data.project_id]);
      check(project && await db.get('SELECT id FROM project_completions WHERE id = ?', [project.id]),
        'Зөвхөн ажил дууссан төслийн гишүүд үнэлгээ өгнө.', 403);
      const members = await db.all('SELECT user_id FROM completion_members WHERE project_id = ?', [project.id]);
      check([req.user.id, data.target_id].every(userId => members.some(member => member.user_id === userId)),
        'Төсөл дуусах үед нэг багийн гишүүн байсан байх ёстой.', 403);
      check(!(await db.get('SELECT id FROM peer_reviews WHERE project_id = ? AND author_id = ? AND target_id = ?',
        [project.id, req.user.id, data.target_id])), 'Энэ төслийн үнэлгээг өмнө нь өгсөн байна.', 409);
      await db.insert('peer_reviews', { ...data, id: id(), author_id: req.user.id, created_at: now() });
      await notify(db, data.target_id, `${project.name}: хамтын ажиллагааны шинэ үнэлгээ ирлээ.`, `/people/${data.target_id}`);
    });
    res.status(201).json({ ok: true });
  });
  return router;
}
