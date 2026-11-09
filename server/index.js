import { loadEnvFile } from 'node:process';
import { existsSync } from 'node:fs';
import { connectDatabase } from './db/index.js';
import { seedDatabase } from './db/seed.js';
import { createApp } from './app.js';

if (existsSync('.env')) loadEnvFile('.env');
const db = await connectDatabase();
await seedDatabase(db);
const port = Number(process.env.PORT || 3001);
const authBypass = process.env.AUTH_BYPASS !== 'false';
const server = createApp(db, { authBypass }).listen(port, '127.0.0.1', async error => {
  if (error) {
    console.error(`TeamUp could not start: ${error.code} (${error.message})`);
    await db.close();
    process.exitCode = 1;
    return;
  }
  console.log(`TeamUp API: http://localhost:${port}`);
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () =>
    server.close(async () => {
      await db.close();
      process.exit(0);
    })
  );
}
