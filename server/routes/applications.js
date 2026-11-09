import { Router } from 'express';
import { z } from 'zod';
import { requireUser } from '../auth.js';
import {
  check,
  decode,
  id,
  isBlocked,
  now,
  notify,
  notifyTeam,
  parse,
  projectAccess,
  publicUser,
  text,
} from '../utils.js';

export function applicationRoutes(db) {
  const router = Router();
  router.use(requireUser);
  router.get('/', async (req, res) => {
    const incoming = req.query.incoming === 'true';
    const projects = await db.all('SELECT * FROM projects');
    const users = await db.all('SELECT * FROM users');
    let requests = await db.all('SELECT * FROM applications ORDER BY created_at DESC');
    requests = requests.filter(request =>
      incoming
        ? projects.find(p => p.id === request.project_id)?.owner_id === req.user.id
        : request.user_id === req.user.id
    );
    if (req.query.status)
      requests = requests.filter(request => request.status === req.query.status);
    res.json(
      requests.map(request => ({
        ...request,
        project: decode(projects.find(p => p.id === request.project_id)),
        user: publicUser(users.find(user => user.id === request.user_id)),
      }))
    );
  });
  router.post('/', async (req, res) => {
    const data = parse(
      z.object({ project_id: text(), role: text(1, 100), introduction: text(10, 3000) }),
      req.body
    );
    const request = {
      ...data,
      id: id(),
      user_id: req.user.id,
      status: 'pending',
      question: '',
      answer: '',
      reason: '',
      created_at: now(),
    };
    await db.transaction(async () => {
      const project = decode(
        await db.get('SELECT * FROM projects WHERE id = ?', [data.project_id])
      );
      check(project && project.visibility === 'visible', 'Төсөл олдсонгүй.', 404);
      check(project.status === 'open', 'Энэ төсөл хүсэлт авахгүй байна.');
      check(project.owner_id !== req.user.id, 'Өөрийн төсөлд хүсэлт илгээхгүй.');
      check(
        !(await isBlocked(db, project.owner_id, req.user.id)),
        'Блоклосон хэрэглэгчтэй хүсэлт солилцохгүй.',
        403
      );
      const members = await db.all('SELECT * FROM memberships WHERE project_id = ?', [project.id]);
      check(
        !members.some(member => member.user_id === req.user.id),
        'Та аль хэдийн багийн гишүүн байна.',
        409
      );
      check(
        members.length < project.capacity && project.roles.includes(data.role),
        'Сонгосон үүрэг эсвэл сул орон тоо байхгүй.'
      );
      check(
        !(await db.get(
          "SELECT id FROM applications WHERE project_id = ? AND user_id = ? AND status IN ('pending','info')",
          [project.id, req.user.id]
        )),
        'Шийдвэрлэгдээгүй хүсэлт байна.',
        409
      );
      await db.insert('applications', request);
      await notify(
        db,
        project.owner_id,
        `${req.user.name}: «${project.name}» төсөлд нэгдэх хүсэлт илгээлээ.`,
        '/requests?tab=incoming'
      );
    });
    res.status(201).json(request);
  });
  router.post('/:id/decision', async (req, res) => {
    const { action, reason } = parse(
      z.object({
        action: z.enum(['accepted', 'rejected', 'info']),
        reason: text(0, 3000).default(''),
      }),
      req.body
    );
    await db.transaction(async () => {
      const request = await db.get('SELECT * FROM applications WHERE id = ?', [req.params.id]);
      check(request, 'Хүсэлт олдсонгүй.', 404);
      const project = await projectAccess(db, request.project_id, req.user, true);
      check(['pending', 'info'].includes(request.status), 'Хүсэлт өмнө нь шийдвэрлэгдсэн.', 409);
      check(project.status === 'open', 'Элсэлт хаагдсан.');
      if (action === 'accepted') {
        check(request.status === 'pending', 'Нэмэлт мэдээллийн хариуг хүлээнэ үү.');
        const applicant = await db.get('SELECT * FROM users WHERE id = ?', [request.user_id]);
        check(
          applicant?.status === 'active' && !(await isBlocked(db, req.user.id, request.user_id)),
          'Хэрэглэгчийн эрх эсвэл блок хязгаарласан.',
          403
        );
        const members = await db.all('SELECT * FROM memberships WHERE project_id = ?', [
          project.id,
        ]);
        check(
          members.length < project.capacity && project.roles.includes(request.role),
          'Баг дүүрсэн эсвэл сонгосон үүрэг байхгүй.',
          409
        );
        check(
          !members.some(member => member.user_id === request.user_id),
          'Гишүүн аль хэдийн нэмэгдсэн.',
          409
        );
        await db.insert('memberships', {
          id: id(),
          project_id: project.id,
          user_id: request.user_id,
          role: request.role,
          created_at: now(),
        });
        await db.update('projects', project.id, {
          roles: JSON.stringify(project.roles.filter(role => role !== request.role)),
        });
        await notifyTeam(
          db,
          project.id,
          request.user_id,
          `${project.name}: шинэ гишүүн багт нэгдлээ.`,
          `/projects/${project.id}`
        );
      } else {
        check(
          reason.length >= 3,
          action === 'info' ? 'Нэмэлт асуултаа оруулна уу.' : 'Татгалзсан шалтгаанаа оруулна уу.'
        );
        if (action === 'info')
          check(request.status === 'pending', 'Өмнөх асуултын хариуг хүлээнэ үү.', 409);
      }
      await db.update('applications', request.id, {
        status: action,
        ...(action === 'info' ? { question: reason, answer: '' } : { reason }),
      });
      const labels = {
        accepted: 'зөвшөөрөгдлөө',
        rejected: 'татгалзлаа',
        info: 'нэмэлт мэдээлэл хүссэн байна',
      };
      await notify(db, request.user_id, `${project.name}: хүсэлт ${labels[action]}.`, '/requests');
    });
    res.json({ ok: true });
  });
  router.post('/:id/reply', async (req, res) => {
    const { answer } = parse(z.object({ answer: text(3, 3000) }), req.body);
    await db.transaction(async () => {
      const request = await db.get('SELECT * FROM applications WHERE id = ?', [req.params.id]);
      check(request?.user_id === req.user.id, 'Хүсэлтэд хандах эрхгүй.', 403);
      check(request.status === 'info', 'Хариу өгөх хүсэлт байхгүй.', 409);
      const project = await db.get('SELECT * FROM projects WHERE id = ?', [request.project_id]);
      check(project.status === 'open' && project.visibility === 'visible', 'Элсэлт хаагдсан.');
      await db.update('applications', request.id, { answer, status: 'pending' });
      await notify(
        db,
        project.owner_id,
        `${req.user.name}: нэмэлт мэдээлэл ирүүллээ.`,
        '/requests?tab=incoming'
      );
    });
    res.json({ ok: true });
  });
  return router;
}
