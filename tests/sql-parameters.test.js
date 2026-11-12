import test from 'node:test';
import assert from 'node:assert/strict';
import sql from 'mssql/msnodesqlv8.js';
import { bindSqlParameters } from '../server/db/sql-parameters.js';

test('Windows SQL insert avoids ODBC reserved parameter names and preserves all values', async () => {
  const pool = new sql.ConnectionPool({ server: 'unused', options: {} });
  pool._connected = true;
  let captured;
  pool.acquire = (_request, callback) => callback(null, {
    queryRaw(statement, values) {
      captured = { statement: statement.query_str, values };
      throw new Error('Captured before executing SQL');
    },
  }, { requestTimeout: 5000 });
  pool.release = () => {};
  const values = Array.from({ length: 20 }, (_, i) => `value-${i}`);
  const request = new sql.Request(pool);
  const statement = bindSqlParameters(request,
    `INSERT INTO users VALUES (${values.map(() => '?').join(',')})`, values);
  await assert.rejects(request.query(statement), /Captured before executing SQL/);
  assert.ok(captured);
  assert.doesNotMatch(captured.statement, /@p\d+\b/i);
  assert.match(captured.statement, /@teamup_arg_19/);
  assert.deepEqual(captured.values, values);
  assert.equal((captured.statement.match(/set @teamup_arg_\d+=\?/g) || []).length, 20);
});

