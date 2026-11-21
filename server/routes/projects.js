import { relatedRows, searchProjects } from '../project-search.js';
import { Router } from 'express';
import { searchCache } from '../search-cache.js';
import { z } from 'zod';
import { roleRequirementsSchema } from '../validation/matching.js';
import { loadRoleMatching, matchingProject, saveRoleRequirements } from '../matching/store.js';
import { skillKey } from '../matching/algorithm.js';
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
  skills: strings.min(1).refine(items => new Set(items.map(skillKey)).size === items.length),
  roles: strings.refine(items => new Set(items.map(item => item.toLowerCase())).size === items.length),
  roleRequirements: roleRequirementsSchema.optional(),
  hours: z
    .number()
    .int()
    .min(1)
    .max(80),
});
export async function decorateProjects(db, projects) {
  const users = await relatedRows(db, 'users', 'id', projects.map(project => project.owner_id));
  const memberships = await relatedRows(db, 'memberships', 'project_id', projects.map(project => project.id));
  const matching = await loadRoleMatching(db, projects.map(project => project.id));
  const owners = new Map(users.map(user => [user.id, publicUser(user)]));
  const counts = new Map();
  for (const member of memberships) counts.set(member.project_id, (counts.get(member.project_id) || 0) + 1);
  return projects.map(row => ({
    ...matchingProject(row, matching),
    owner: owners.get(row.owner_id) || null,
    member_count: counts.get(row.id) || 0,
  }));
}
export function projectRoutes(db) {
  const router = Router();
  router.get('/', searchCache(db), async (req, res) => {
    const { rows, ...page } = await searchProjects(db, req.query, req.user);
    res.json({ ...page, items: await decorateProjects(db, rows) });
  });
  router.get('/options', async (_req, res) => {
    const projects = await db.all("SELECT category, project_type, skills FROM projects WHERE visibility = 'visible'");
    const unique = values => [...new Set(values.filter(Boolean))].sort();
    res.json({
      categories: unique(projects.map(p => p.category)),
      types: unique(projects.map(p => p.project_type)),
      skills: unique(projects.flatMap(p => JSON.parse(p.skills))),
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
    const { roleRequirements, ...data } = parse(projectSchema.refine(data => data.roles.length > 0), req.body);
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
      await saveRoleRequirements(db, { ...data, id: project.id }, roleRequirements);
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
    const { roleRequirements, ...data } = parse(projectSchema, req.body);
    await db.transaction(async () => {
      const project = await projectAccess(db, req.params.id, req.user, true);
      check(!['archived', 'completed'].includes(project.status), 'Дууссан эсвэл архивласан төслийг засахгүй.');
      const members = await db.all('SELECT id FROM memberships WHERE project_id = ?', [project.id]);
      check(data.capacity >= members.length, 'Багийн хэмжээ гишүүдийн тооноос бага байж болохгүй.');
      await db.update('projects', project.id, {
        ...data,
        skills: JSON.stringify(data.skills),
        roles: JSON.stringify([...new Set(data.roles)]),
      });
      await saveRoleRequirements(db, { ...data, id: project.id }, roleRequirements);
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
    const { status } = parse(z.object({ status: z.enum(['closed', 'completed', 'archived']) }), req.body);
    await db.transaction(async () => {
      const project = await projectAccess(db, req.params.id, req.user, true);
      check(
        project.status !== 'archived' && (status === 'archived' ||
          (status === 'completed' && ['open', 'closed'].includes(project.status)) ||
          (status === 'closed' && project.status === 'open')),
        'Төлөв өөрчлөх боломжгүй.'
      );
      await db.update('projects', project.id, { status });
      if (status === 'completed') {
        await db.insert('project_completions', { id: project.id, completed_at: now() });
        for (const member of await db.all('SELECT * FROM memberships WHERE project_id = ?', [project.id])) {
          await db.insert('completion_members', {
            id: id(), project_id: project.id, user_id: member.user_id, role: member.role,
          });
        }
      }
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
        `${project.name}: ${status === 'archived' ? 'архивлагдлаа' : status === 'completed' ? 'ажил дуусаж, багийн үнэлгээ нээгдлээ' : 'элсэлт хаагдлаа'}.`,
        `/projects/${project.id}`
      );
    });
    res.json({ ok: true });
  });
  router.patch('/:id/members/:userId', requireUser, async (req, res) => {
    const { role } = parse(z.object({ role: text(1, 100) }), req.body);
    await db.transaction(async () => {
      const project = await projectAccess(db, req.params.id, req.user, true);
      check(!['archived', 'completed'].includes(project.status), 'Дууссан эсвэл архивласан багийн үүргийг өөрчлөхгүй.');
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

