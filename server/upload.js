import { writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { check } from './utils.js';

// Use Node's standard multipart parser, with a bounded request body.
export function uploadFile(uploadRoot) {
  return async (req, _res, next) => {
    try {
      const limit = Number(process.env.UPLOAD_MAX_MB || 10) * 1024 * 1024;
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        check(size <= limit + 65536, 'Файлын хэмжээ хэтэрсэн.', 413);
        chunks.push(chunk);
      }
      const request = new Request('http://localhost/upload', {
        method: 'POST',
        headers: { 'Content-Type': req.headers['content-type'] || '' },
        body: Buffer.concat(chunks),
      });
      const form = await request.formData();
      const files = form.getAll('file');
      check(files.length <= 1, 'Нэг удаа нэг файл илгээнэ үү.');
      req.body = { body: typeof form.get('body') === 'string' ? form.get('body') : '' };
      const file = files[0];
      if (file && typeof file !== 'string' && file.size) {
        const allowed = (
          process.env.UPLOAD_TYPES || '.pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.zip,.docx,.pptx'
        ).split(',');
        check(allowed.includes(extname(file.name).toLowerCase()), 'Энэ төрлийн файл зөвшөөрөхгүй.');
        check(file.size <= limit, 'Файлын хэмжээ хэтэрсэн.', 413);
        const filename = randomUUID();
        const path = join(uploadRoot, filename);
        await writeFile(path, Buffer.from(await file.arrayBuffer()));
        req.file = {
          originalname: file.name,
          filename,
          path,
          mimetype: file.type || 'application/octet-stream',
          size: file.size,
        };
      }
      next();
    } catch (error) {
      next(Object.assign(error, { status: error.status || 400 }));
    }
  };
}
