import { spawn } from 'node:child_process';

const result = await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ['--test', 'tests/auth-integration.test.js'], { stdio: 'inherit' });
  child.on('error', reject);
  child.on('exit', code => resolve(code));
});
if (result !== 0) {
  console.error('Интеграци тест амжилтгүй: сервер асахгүй.');
  process.exitCode = 1;
} else {
  process.env.DB_DRIVER = 'sqlite';
  process.env.AUTH_BYPASS = 'false';
  console.log('Интеграци тест амжилттай. TeamUP серверийг асааж байна.');
  await import('../server/index.js');
}
