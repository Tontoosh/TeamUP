import { DatabaseSync } from 'node:sqlite';
import { appendFileSync } from 'node:fs';

// Loaded only by export-sql.js in isolated test processes. Never record values.
const destination = process.env.TEAMUP_SQL_TRACE;
if (destination) {
  const seen = new Set();
  const record = sql => {
    if (seen.has(sql)) return;
    seen.add(sql);
    appendFileSync(destination, JSON.stringify(sql) + '\n');
  };
  for (const method of ['prepare', 'exec']) {
    const original = DatabaseSync.prototype[method];
    DatabaseSync.prototype[method] = function (sql, ...args) {
      const result = original.call(this, sql, ...args);
      record(sql);
      return result;
    };
  }
}
