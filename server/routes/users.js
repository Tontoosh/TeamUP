import { searchPeople } from '../people-search.js';
import { Router } from 'express';
import { profileSchema } from '../validation/profile.js';
import { searchCache } from '../search-cache.js';
import { z } from 'zod';
import { requireUser } from '../auth.js';
import {
  check,
  currentUser,
  decode,
  id,
  link,
  now,
  parse,
  publicUser,
  text,
} from '../utils.js';
import { decorateProjects } from './projects.js';
import { bestMatch } from '../matching/algorithm.js';
import { loadUserMatching, matchingUser, saveSkillLevels } from '../matching/store.js';
import { matchOrder, recommendationsFor } from '../matching/recommendations.js';

export function userRoutes(db) {
  const router = Router();
  router.use(requireUser);
  router.get('/recommendations', async (req, res) => {
    res.json(await recommendationsFor(db, req.user));
  });
  router.get('/owned-projects', async (req, res) => {
    const projects = await decorateProjects(db, await db.all(
      "SELECT * FROM projects WHERE owner_id = ? AND status = 'open' AND visibility = 'visible' ORDER BY created_at DESC", [req.user.id]));
    res.json(projects.filter(project => project.member_count < project.capacity && project.roles.length));
  });
  router.get('/people', searchCache(db), async (req, res) => {
    check(
      await db.get('SELECT id FROM projects WHERE owner_id = ?', [req.user.id]),
      'Хамтрагч хайхын тулд эхлээд төсөл нийтэлнэ үү.',
      403
    );
    const result = await searchPeople(db, req.query, req.user.id);
    const matching = await loadUserMatching(db, result.rows.map(user => user.id));
    const visible = result.rows.map(row => matchingUser(row, matching));
    let ranked = visible;
    if (req.query.project) {
      const row = await db.get("SELECT * FROM projects WHERE id = ? AND visibility = 'visible'", [String(req.query.project)]);
      check(row?.owner_id === req.user.id, 'Өөрийн төслийг сонгоно уу.', 403);
      const [project] = await decorateProjects(db, [row]);
      check(project.status === 'open' && project.member_count < project.capacity, 'Төслийн элсэлт нээлттэй байх ёстой.');
      const roles = project.roleRequirements.filter(role => !req.query.role || role.role === req.query.role);
      check(roles.length, 'Нээлттэй үүрэг олдсонгүй.', 404);
      const members = await db.all('SELECT user_id FROM memberships WHERE project_id = ?', [project.id]);
      ranked = visible.flatMap(user => {
        if (members.some(item => item.user_id === user.id)) return [];
        const match = bestMatch(user, project, roles);
        return match ? [{ ...user, match, reasons: match.reasons }] : [];
      }).sort(matchOrder);
    }
    const page = result.page;
    res.json({
      items: req.query.project ? ranked.slice((page - 1) * 12, page * 12) : ranked, page,
      total: req.query.project ? ranked.length : result.total,
      pages: req.query.project ? Math.ceil(ranked.length / 12) : result.pages,
    });
  });
  router.patch('/me', async (req, res) => {
    const { skillLevels, ...data } = parse(profileSchema, req.body);
    await db.transaction(async () => {
      await db.update('users', req.user.id, {
        ...data, skills: JSON.stringify(data.skills), interests: JSON.stringify(data.interests),
      });
      await saveSkillLevels(db, req.user.id, data.skills, skillLevels);
    });
    const row = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    res.json({ ...currentUser(row), ...matchingUser(row, await loadUserMatching(db, row.id)), email: row.email });
  });
  router.get('/me/portfolio', async (req, res) =>
    res.json(
      await db.all('SELECT * FROM portfolios WHERE user_id = ? ORDER BY created_at DESC', [
        req.user.id,
      ])
    )
  );
  router.post('/me/portfolio', async (req, res) => {
    const data = parse(
      z.object({
        title: text(2, 200),
        url: z.url().refine(value => /^https?:\/\//i.test(value)),
        contribution: text(2, 3000),
      }),
      req.body
    );
    const entry = { ...data, id: id(), user_id: req.user.id, created_at: now() };
    await db.insert('portfolios', entry);
    res.status(201).json(entry);
  });
  router.patch('/me/portfolio/:id', async (req, res) => {
    const data = parse(
      z.object({
        title: text(2, 200),
        url: z.url().refine(value => /^https?:\/\//i.test(value)),
        contribution: text(2, 3000),
      }),
      req.body
    );
    check(
      await db.get('SELECT id FROM portfolios WHERE id = ? AND user_id = ?', [
        req.params.id,
        req.user.id,
      ]),
      'Бүтээл олдсонгүй.',
      404
    );
    await db.update('portfolios', req.params.id, data);
    res.json({ ok: true });
  });
  router.delete('/me/portfolio/:id', async (req, res) => {
    await db.run('DELETE FROM portfolios WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id,
    ]);
    res.json({ ok: true });
  });
  router.get('/:id', async (req, res) => {
    const user = await db.get("SELECT * FROM users WHERE id = ? AND status = 'active'", [
      req.params.id,
    ]);
    check(user, 'Хэрэглэгч олдсонгүй.', 404);
    const projects = await decorateProjects(
      db,
      await db.all(
        "SELECT p.* FROM projects p JOIN memberships m ON p.id = m.project_id WHERE m.user_id = ? AND p.visibility = 'visible'",
        [user.id]
      )
    );
    res.json({
      ...matchingUser(user, await loadUserMatching(db, user.id)),
      projects,
      portfolioEntries: await db.all('SELECT * FROM portfolios WHERE user_id = ?', [user.id]),
      blocked: !!(await db.get('SELECT id FROM blocks WHERE user_id = ? AND target_id = ?', [
        req.user.id,
        user.id,
      ])),
    });
  });
  return router;
}
