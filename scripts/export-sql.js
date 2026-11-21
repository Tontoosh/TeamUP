import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { tables } from '../server/db/schema.js';

mkdirSync('database', { recursive: true });
mkdirSync('work', { recursive: true });
const trace = resolve('work/sql-trace.ndjson');
writeFileSync(trace, '');
const tests = readdirSync('tests').filter(file => file.endsWith('.test.js')).map(file => `tests/${file}`);
const result = spawnSync(process.execPath, ['--import', pathToFileURL(resolve('scripts/trace-sql.js')).href,
  '--test', '--test-concurrency=1', ...tests], {
  stdio: 'inherit', env: { ...process.env, TEAMUP_SQL_TRACE: trace },
});
if (result.error) throw result.error;
if (result.status !== 0) throw new Error('Tests failed; SQL export was not finalized.');
const commands = [...new Set(readFileSync(trace, 'utf8').trim().split('\n').filter(Boolean)
  .map(line => JSON.parse(line).replace(/\s+/g, ' ').trim()))];
const lines = [
  '-- TeamUP: SQL statements observed during all SQLite unit/integration tests.',
  '-- Generated with: node scripts/export-sql.js',
  '-- Each distinct statement appears once. Bind parameters (?) deliberately omit all values.',
  '-- This is an execution inventory, not a migration: statements span isolated test databases.',
  '-- BEGIN/COMMIT/ROLLBACK and test-only inserts must not be replayed against live data.',
  ...commands.map(sql => sql.endsWith(';') ? sql : `${sql};`),
];
writeFileSync('database/executed-sqlite.sql', lines.join('\n') + '\n');
const sqlServer = [
  '-- TeamUP SQL Server application schema. Run in the intended existing database.',
  '-- Generated from server/db/schema.js; does not drop or overwrite existing data.',
  '-- This script was exported, not executed against SQL Server (SSPI authentication unavailable).',
  '-- Normalized legacy source views are installed by server/db/source-schema.js at app startup.',
  'SET XACT_ABORT ON;',
  'GO',
];
for (const [name, definition] of Object.entries(tables)) {
  const columns = definition.replaceAll('TEXT', 'NVARCHAR(MAX)').replaceAll('VARCHAR(', 'NVARCHAR(').replaceAll('NNVARCHAR', 'NVARCHAR');
  sqlServer.push(`IF OBJECT_ID(N'dbo.${name}', N'U') IS NULL CREATE TABLE dbo.${name} (${columns.replace(/\s+/g, ' ').trim()});`, 'GO');
}
const indexes = {
  idx_login_user: 'login_attempts(user_id, created_at)', idx_project_owner: 'projects(owner_id)',
  idx_project_search: 'projects(visibility, created_at, id)', idx_membership_user: 'memberships(user_id)',
  idx_application_project: 'applications(project_id, status)', idx_messages_project: 'messages(project_id, created_at)',
  idx_notification_user: 'notifications(user_id, is_read)', idx_review_target: 'peer_reviews(target_id, created_at)',
};
for (const [name, target] of Object.entries(indexes)) {
  const table = target.slice(0, target.indexOf('('));
  sqlServer.push(`IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'${name}' AND object_id = OBJECT_ID(N'dbo.${table}')) CREATE INDEX ${name} ON dbo.${target};`, 'GO');
}
sqlServer.push('-- Read-only connection diagnostics attempted in this session; connection failed before execution.',
  'SELECT DB_NAME() AS database_name, SUSER_SNAME() AS login_name;',
  "SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE';", 'GO');
writeFileSync('database/teamup-sqlserver.sql', sqlServer.join('\n') + '\n');
console.log(`SQL export: ${commands.length} distinct SQLite commands; ${Object.keys(tables).length} SQL Server tables.`);
