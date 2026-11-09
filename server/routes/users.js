import { Router } from 'express';
import { searchCache } from '../search-cache.js';
import { z } from 'zod';
import { requireUser } from '../auth.js';
import {
  check,
  currentUser,
  decode,
  id,
  isBlocked,
  link,
  now,
  parse,
  publicUser,
  strings,
  text,
} from '../utils.js';
import { decorateProjects } from './projects.js';

const profileSchema = z.object({
  name: text(2, 160),
  school: text(2, 160),
  major: text(2, 160),
  skills: strings,
  interests: strings,
  experience: text(0, 3000),
  portfolio: link,
  hours: z
    .number()
    .int()
    .min(0)
    .max(80),
  bio: text(0, 3000),
});
export function userRoutes(db) {
  const router = Router();
  router.use(requireUser);
  router.get('/recommendations', async (req, res) => {
    const user = decode(req.user);
    const projects = await decorateProjects(
      db,
      await db.all("SELECT * FROM projects WHERE status = 'open' AND visibility = 'visible'")
    );
    const memberships = await db.all('SELECT * FROM memberships WHERE user_id = ?', [user.id]);
    const ranked = [];
    for (const project of projects) {
      if (
        project.owner_id === user.id ||
        memberships.some(m => m.project_id === project.id) ||
        (await isBlocked(db, user.id, project.owner_id))
      )
        continue;
      const shared = project.skills.filter(skill => user.skills.includes(skill));
      const interest = user.interests.includes(project.category);
      if (
        (shared.length || interest) &&
        user.hours >= project.hours &&
        project.member_count < project.capacity
      )
        ranked.push({
          ...project,
          reasons: [
            ...shared,
            ...(interest ? [project.category] : []),
            `${project.hours} цаг / 7 хоног`,
          ],
          score: shared.length * 2 + Number(interest),
        });
    }
    const people = [];
    const ownProjects = projects.filter(project => project.owner_id === user.id);
    for (const row of await db.all(
      "SELECT * FROM users WHERE status = 'active' AND role = 'student'"
    )) {
      if (row.id === user.id || (await isBlocked(db, user.id, row.id))) continue;
      const candidate = publicUser(row);
      const shared = candidate.skills.filter(skill =>
        ownProjects.some(
          project => project.skills.includes(skill) && candidate.hours >= project.hours
        )
      );
      if (shared.length) people.push({ ...candidate, reasons: shared });
    }
    res.json({
      projects: ranked.sort((a, b) => b.score - a.score),
      people,
      incomplete: !user.skills.length || !user.hours,
    });
  });
  router.get('/people', searchCache(db), async (req, res) => {
    check(
      await db.get('SELECT id FROM projects WHERE owner_id = ?', [req.user.id]),
      'Хамтрагч хайхын тулд эхлээд төсөл нийтэлнэ үү.',
      403
    );
    let users = (await db.all("SELECT * FROM users WHERE status = 'active' AND role = 'student'"))
      .map(publicUser)
      .filter(user => user.id !== req.user.id);
    const { q, skill, major, interest, hours, experience } = req.query;
    if (q)
      users = users.filter(u =>
        `${u.name} ${u.school} ${u.major}`.toLowerCase().includes(String(q).toLowerCase())
      );
    if (skill)
      users = users.filter(u =>
        u.skills.some(s => s.toLowerCase().includes(String(skill).toLowerCase()))
      );
    if (major)
      users = users.filter(u => u.major.toLowerCase().includes(String(major).toLowerCase()));
    if (interest)
      users = users.filter(u =>
        u.interests.some(s => s.toLowerCase().includes(String(interest).toLowerCase()))
      );
    if (hours) users = users.filter(u => u.hours >= Number(hours));
    if (experience) users = users.filter(u => u.experience.includes(String(experience)));
    const visible = [];
    for (const user of users) if (!(await isBlocked(db, req.user.id, user.id))) visible.push(user);
    const page = Math.max(1, Number(req.query.page) || 1);
    res.json({
      items: visible.slice((page - 1) * 12, page * 12),
      total: visible.length,
      pages: Math.ceil(visible.length / 12),
    });
  });
  router.patch('/me', async (req, res) => {
    const data = parse(profileSchema, req.body);
    await db.update('users', req.user.id, {
      ...data,
      skills: JSON.stringify(data.skills),
      interests: JSON.stringify(data.interests),
    });
    res.json(currentUser(await db.get('SELECT * FROM users WHERE id = ?', [req.user.id])));
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
      ...publicUser(user),
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
