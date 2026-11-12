import { loadEnvFile } from 'node:process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { sqlServerConnection } from '../server/db/sqlserver.js';
if (existsSync('.env')) loadEnvFile('.env');
let pool;
const report = { capturedAt: new Date().toISOString() };
const quote = value => `[${value.replaceAll(']', ']]')}]`;
try {
  const { sql, config } = await sqlServerConnection();
  pool = await new sql.ConnectionPool(config).connect();
  report.connection = (await pool.request().query('SELECT @@SERVERNAME AS server_name, DB_NAME() AS database_name, SUSER_SNAME() AS login_name')).recordset[0];
  report.columns = (await pool.request().query('SELECT TABLE_SCHEMA,TABLE_NAME,COLUMN_NAME,DATA_TYPE,IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS ORDER BY TABLE_SCHEMA,TABLE_NAME,ORDINAL_POSITION')).recordset;
  report.foreignKeys = (await pool.request().query('SELECT OBJECT_SCHEMA_NAME(parent_object_id) AS source_schema, OBJECT_NAME(parent_object_id) AS source_table, COL_NAME(parent_object_id,parent_column_id) AS source_column, OBJECT_SCHEMA_NAME(referenced_object_id) AS target_schema, OBJECT_NAME(referenced_object_id) AS target_table, COL_NAME(referenced_object_id,referenced_column_id) AS target_column FROM sys.foreign_key_columns')).recordset;
  const tables = (await pool.request().query("SELECT TABLE_SCHEMA,TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' ORDER BY TABLE_SCHEMA,TABLE_NAME")).recordset;
  report.tables = [];
  for (const table of tables) {
    const path = `${quote(table.TABLE_SCHEMA)}.${quote(table.TABLE_NAME)}`;
    const columns = report.columns.filter(c => c.TABLE_SCHEMA === table.TABLE_SCHEMA && c.TABLE_NAME === table.TABLE_NAME);
    const entry = { ...table, count: (await pool.request().query(`SELECT COUNT_BIG(*) AS total FROM ${path}`)).recordset[0].total };
    if (/project|category|skill|reference/i.test(table.TABLE_NAME)) {
      const safe = columns.filter(c => /^(id|name|title|project_name|projectname|category|category_id|status|visibility|owner_id|created_at|code|type|duration|capacity|skills|roles)$/i.test(c.COLUMN_NAME));
      if (safe.length) entry.sample = (await pool.request().query(`SELECT TOP (5) ${safe.map(c => quote(c.COLUMN_NAME)).join(',')} FROM ${path}`)).recordset;
    }
    report.tables.push(entry);
  }
  report.api = {};
  for (const path of ['/api/health', '/api/projects', '/api/reference']) {
    try {
      const response = await fetch(`http://localhost:${process.env.PORT || 3001}${path}`, { signal: AbortSignal.timeout(5000) });
      report.api[path] = { status: response.status, body: await response.json() };
    } catch (error) { report.api[path] = { error: error.message }; }
  }
} catch (error) { report.error = error.message; process.exitCode = 1; }
finally {
  if (pool) await pool.close();
  mkdirSync('work', { recursive: true });
  writeFileSync('work/db-inspection.json', JSON.stringify(report, null, 2));
  console.log('Inspection saved: work/db-inspection.json');
  if (report.error) console.error(report.error);
  else console.log(report.tables.map(t => `${t.TABLE_SCHEMA}.${t.TABLE_NAME}: ${t.count} rows`).join('\n'));
}
