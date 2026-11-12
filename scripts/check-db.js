import { loadEnvFile } from 'node:process';
import { existsSync } from 'node:fs';
import { sqlServerConnection } from '../server/db/sqlserver.js';
if (existsSync('.env')) loadEnvFile('.env');
let pool;
try {
  const { sql, config } = await sqlServerConnection();
  pool = await new sql.ConnectionPool(config).connect();
  const result = await pool.request().query(`
    SELECT DB_NAME() AS database_name, SUSER_SNAME() AS login_name;
    SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE';
  `);
  console.log(JSON.stringify(result.recordsets, null, 2));
} catch (error) {
  console.error('SQL Server connection failed:', error.message);
  if (/SSPI|credentials|security package|Local Security Authority/i.test(error.message)) {
    console.error('Windows authentication credentials are unavailable. Run start-teamup.cmd directly from File Explorer under the Windows account used in SSMS.');
  } else {
    console.error('Check SQL Server is running, TCP/IP is enabled on port 1433, and your Windows account can access TeamUpDB.');
  }
  process.exitCode = 1;
} finally {
  if (pool) await pool.close();
}

