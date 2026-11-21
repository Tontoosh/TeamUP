import { connectDatabase } from '../server/db/index.js';
import { seedDatabase } from '../server/db/seed.js';
import { createApp } from '../server/app.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Playwright owns the server in-process, including teardown on Windows.
// Never load the developer's .env, application database or uploads.
export default async function startBrowserServer() {
  const directory = await mkdtemp(join(tmpdir(), 'teamup-browser-'));
  process.env.DB_DRIVER = 'sqlite';
  process.env.SQLITE_PATH = ':memory:';
  process.env.UPLOAD_PATH = join(directory, 'uploads');
  process.env.SEED_DEMO = 'true';
  process.env.AUTH_BYPASS = 'false';
  process.env.COOKIE_SECURE = 'false';
  process.env.APP_URL = 'http://127.0.0.1:4173';
  delete process.env.SMTP_HOST;
  let db, server;
  try {
    db = await connectDatabase();
    await seedDatabase(db);
    await new Promise((resolve, reject) => {
      server = createApp(db).listen(4173, '127.0.0.1', resolve);
      server.once('error', reject);
    });
  } catch (error) {
    if (db) await db.close();
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
  return async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await db.close();
    await rm(directory, { recursive: true, force: true });
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const stop = await startBrowserServer();
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, async () => {
      await stop();
      process.exit(0);
    });
  }
}
