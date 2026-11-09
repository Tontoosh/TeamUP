import { Router } from 'express';
import { searchCache } from '../search-cache.js';
import { z } from 'zod';
import { requireUser } from '../auth.js';
import {
  check,
  decode,
  id,
  now,
  notify,
  notifyTeam,
  parse,
  projectAccess,
  publicUser,
  strings,
  text,
} from '../utils.js';

const projectSchema = z.object({
  name: text(3, 200),
  description: text(10, 5000),
  category: text(1, 100),
  project_type: text(1, 50),
  goal: text(10, 3000),
  duration: z
    .number()
    .int()
    .min(1)
    .max(520),
  capacity: z
    .number()
    .int()
    .min(2)
    .max(100),
  skills: strings.min(1),
  roles: strings,
  hours: z
    .number()
    .int()
    .min(1)
    .max(80),
});
export async function decorateProjects(db, projects) {
  const users = await db.all('SELECT * FROM users');
  const memberships = await db.all('SELECT * FROM memberships');
  return projects.map(row => ({
    ...decode(row),
    owner: publicUser(users.find(user => user.id === row.owner_id)),
    member_count: memberships.filter(member => member.project_id === row.id).length,
  }));
}
export function projectRoutes(db) {
  const router = Router();
  router.get('/', searchCache(db), async (req, res) => {
    let projects = await decorateProjects(
      db,
      await db.all("SELECT * FROM projects WHERE visibility = 'visible' ORDER BY created_at DESC")
    );
    const { q, category, skill, type, duration, mine, status, sort } = req.query;
    if (mine) {
      check(req.user, 'Нэвтэрнэ үү.', 401);
      const memberships = await db.all('SELECT project_id FROM memberships WHERE user_id = ?', [
        req.user.id,
      ]);
      projects = projects.filter(project =>
        memberships.some(member => member.project_id === project.id)
      );
    }
    if (q)
      projects = projects.filter(p =>
        `${p.name} ${p.description} ${p.skills.join(' ')}`
          .toLowerCase()
          .includes(String(q).toLowerCase())
      );
    if (category) projects = projects.filter(p => p.category === category);
    if (skill)
      projects = projects.filter(p =>
        p.skills.some(s => s.toLowerCase().includes(String(skill).toLowerCase()))
      );
    if (type) projects = projects.filter(p => p.project_type === type);
    if (duration) projects = projects.filter(p => p.duration <= Number(duration));
    if (status) projects = projects.filter(p => p.status === status);
    if (sort === 'spaces')
      projects.sort((a, b) => b.capacity - b.member_count - (a.capacity - a.member_count));
    const total = projects.length;
    const page = Math.max(1, Number(req.query.page) || 1);
    const size = Math.min(24, Math.max(1, Number(req.query.size) || 6));
    res.json({
      items: projects.slice((page - 1) * size, page * size),
      total,
      page,
      pages: Math.ceil(total / size),
    });
  });
  router.get('/:id', async (req, res) => {
    const row = await db.get("SELECT * FROM projects WHERE id = ? AND visibility = 'visible'", [
      req.params.id,
    ]);
    check(row, 'Төсөл олдсонгүй.', 404);
    const [project] = await decorateProjects(db, [row]);
    const members = await db.all('SELECT * FROM memberships WHERE project_id = ?', [project.id]);
    project.members = await Promise.all(
      members.map(async member => ({
        ...member,
        user: publicUser(await db.get('SELECT * FROM users WHERE id = ?', [member.user_id])),
      }))
    );
    project.application = req.user
      ? await db.all(
          'SELECT * FROM applications WHERE project_id = ? AND user_id = ? ORDER BY created_at DESC',
          [project.id, req.user.id]
        )
      : [];
    res.json(project);
  });
  router.post('/', requireUser, async (req, res) => {
    const data = parse(projectSchema.extend({ roles: strings.min(1) }), req.body);
    const project = {
      ...data,
      id: id(),
      owner_id: req.user.id,
      skills: JSON.stringify(data.skills),
      roles: JSON.stringify([...new Set(data.roles)]),
      status: 'open',
      visibility: 'visible',
      created_at: now(),
    };
    await db.transaction(async () => {
      await db.insert('projects', project);
      await db.insert('memberships', {
        id: id(),
        project_id: project.id,
        user_id: req.user.id,
        role: 'Төсөл эзэмшигч',
        created_at: now(),
      });
    });
    res.status(201).json(decode(project));
  });
  router.patch('/:id', requireUser, async (req, res) => {
    const data = parse(projectSchema, req.body);
    await db.transaction(async () => {
      const project = await projectAccess(db, req.params.id, req.user, true);
      check(project.status !== 'archived', 'Архивласан төслийг засахгүй.');
      const members = await db.all('SELECT id FROM memberships WHERE project_id = ?', [project.id]);
      check(data.capacity >= members.length, 'Багийн хэмжээ гишүүдийн тооноос бага байж болохгүй.');
      await db.update('projects', project.id, {
        ...data,
        skills: JSON.stringify(data.skills),
        roles: JSON.stringify([...new Set(data.roles)]),
      });
      await notifyTeam(
        db,
        project.id,
        req.user.id,
        `${project.name}: төслийн мэдээлэл шинэчлэгдлээ.`,
        `/projects/${project.id}`
      );
    });
    res.json({ ok: true });
  });
  router.post('/:id/status', requireUser, async (req, res) => {
    const { status } = parse(z.object({ status: z.enum(['closed', 'archived']) }), req.body);
    await db.transaction(async () => {
      const project = await projectAccess(db, req.params.id, req.user, true);
      check(
        project.status !== 'archived' && (status === 'archived' || project.status === 'open'),
        'Төлөв өөрчлөх боломжгүй.'
      );
      await db.update('projects', project.id, { status });
      for (const request of await db.all(
        "SELECT * FROM applications WHERE project_id = ? AND status IN ('pending','info')",
        [project.id]
      )) {
        await db.update('applications', request.id, {
          status: 'invalidated',
          reason: 'Төслийн элсэлт хаагдсан.',
        });
        await notify(
          db,
          request.user_id,
          `${project.name}: элсэлт хаагдаж, хүсэлт хүчингүй боллоо.`,
          '/requests'
        );
      }
      await notifyTeam(
        db,
        project.id,
        req.user.id,
        `${project.name}: ${status === 'archived' ? 'архивлагдлаа' : 'элсэлт хаагдлаа'}.`,
        `/projects/${project.id}`
      );
    });
    res.json({ ok: true });
  });
  router.patch('/:id/members/:userId', requireUser, async (req, res) => {
    const { role } = parse(z.object({ role: text(1, 100) }), req.body);
    await db.transaction(async () => {
      const project = await projectAccess(db, req.params.id, req.user, true);
      check(project.status !== 'archived', 'Архивласан багийн үүргийг өөрчлөхгүй.');
      check(req.params.userId !== project.owner_id, 'Эзэмшигчийн үүргийг өөрчлөхгүй.');
      const member = await db.get(
        'SELECT * FROM memberships WHERE project_id = ? AND user_id = ?',
        [project.id, req.params.userId]
      );
      check(member, 'Гишүүн олдсонгүй.', 404);
      await db.update('memberships', member.id, { role });
      await notify(
        db,
        member.user_id,
        `${project.name}: таны үүрэг «${role}» боллоо.`,
        `/projects/${project.id}`
      );
    });
    res.json({ ok: true });
  });
  return router;
}
