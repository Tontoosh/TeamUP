import { Router } from 'express';
import { uploadFile } from '../upload.js';
import { mkdirSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { requireUser } from '../auth.js';
import { check, id, now, notifyTeam, parse, projectAccess, publicUser, text } from '../utils.js';

export function chatRoutes(db) {
  const router = Router();
  const uploadRoot = resolve(process.env.UPLOAD_PATH || './data/uploads');
  mkdirSync(uploadRoot, { recursive: true });
  router.use(requireUser);
  router.get('/config', (_req, res) =>
    res.json({
      maxMb: Number(process.env.UPLOAD_MAX_MB || 10),
      types: process.env.UPLOAD_TYPES || '.pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.zip,.docx,.pptx',
    })
  );
  router.get('/:projectId', async (req, res) => {
    const project = await projectAccess(db, req.params.projectId, req.user);
    const rows = await db.all(
      "SELECT * FROM messages WHERE project_id = ? AND visibility = 'visible' ORDER BY created_at ASC",
      [project.id]
    );
    const messages = await Promise.all(
      rows.map(async message => ({
        ...message,
        user: publicUser(await db.get('SELECT * FROM users WHERE id = ?', [message.user_id])),
        attachments: (
          await db.all('SELECT * FROM attachments WHERE message_id = ?', [message.id])
        ).map(({ path, ...file }) => file),
      }))
    );
    res.json({ project, messages });
  });
  router.post(
    '/:projectId',
    async (req, res, next) => {
      try {
        const project = await projectAccess(db, req.params.projectId, req.user);
        check(!['archived', 'completed'].includes(project.status), 'Дууссан эсвэл архивласан чат зөвхөн унших горимтой.');
        next();
      } catch (error) {
        next(error);
      }
    },
    uploadFile(uploadRoot),
    async (req, res) => {
      let saved = false;
      try {
        const { body } = parse(z.object({ body: text(0, 5000).default('') }), req.body);
        check(body || req.file, 'Мессеж эсвэл файл сонгоно уу.');
        const message = {
          id: id(),
          project_id: req.params.projectId,
          user_id: req.user.id,
          body,
          visibility: 'visible',
          created_at: now(),
        };
        await db.transaction(async () => {
          const project = await projectAccess(db, req.params.projectId, req.user);
        check(!['archived', 'completed'].includes(project.status), 'Дууссан эсвэл архивласан чат зөвхөн унших горимтой.');
          await db.insert('messages', message);
          if (req.file)
            await db.insert('attachments', {
              id: id(),
              message_id: message.id,
              name: req.file.originalname,
              path: req.file.filename,
              mime: req.file.mimetype,
              size: req.file.size,
            });
          await notifyTeam(
            db,
            project.id,
            req.user.id,
            `${project.name}: ${req.user.name} ${req.file ? 'файл' : 'мессеж'} илгээлээ.`,
            `/chat?project=${project.id}`
          );
        });
        saved = true;
        res.status(201).json(message);
      } finally {
        if (req.file && !saved) unlinkSync(req.file.path);
      }
    }
  );
  router.get('/files/:id', async (req, res) => {
    const file = await db.get('SELECT * FROM attachments WHERE id = ?', [req.params.id]);
    check(file, 'Файл олдсонгүй.', 404);
    const message = await db.get('SELECT * FROM messages WHERE id = ?', [file.message_id]);
    check(message?.visibility === 'visible', 'Файл харах боломжгүй.', 404);
    await projectAccess(db, message.project_id, req.user);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.download(resolve(uploadRoot, file.path), file.name);
  });
  return router;
}
