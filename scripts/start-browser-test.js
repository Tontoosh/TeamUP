import { connectDatabase } from '../server/db/index.js';
import { seedDatabase } from '../server/db/seed.js';
import { createApp } from '../server/app.js';

// Use an isolated, disposable database and never load the developer's .env.
process.env.DB_DRIVER = 'sqlite';
process.env.SQLITE_PATH = ':memory:';
process.env.SEED_DEMO = 'true';
process.env.AUTH_BYPASS = 'false';
process.env.COOKIE_SECURE = 'false';
process.env.APP_URL = 'http://127.0.0.1:4173';
delete process.env.SMTP_HOST;
const db = await connectDatabase();
await seedDatabase(db);
const server = createApp(db).listen(4173, '127.0.0.1');
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(async () => {
    await db.close();
    process.exit(0);
  }));
}
