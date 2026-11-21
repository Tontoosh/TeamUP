import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createSchema } from './schema.js';
import { sqlServerConnection } from './sqlserver.js';
import { bindSqlParameters } from './sql-parameters.js';
import { installSourceMapping } from './source-schema.js';

export async function connectDatabase() {
  const driver = process.env.DB_DRIVER || 'sqlite';
  const context = new AsyncLocalStorage();
  let sqlite, pool, mssql;
  if (driver === 'mssql') {
    const connection = await sqlServerConnection();
    mssql = connection.sql;
    pool = await new mssql.ConnectionPool(connection.config).connect();
  } else if (driver === 'sqlite') {
    const { DatabaseSync } = await import('node:sqlite');
    const file = process.env.SQLITE_PATH || './data/teamup.db';
    mkdirSync(dirname(file), { recursive: true });
    sqlite = new DatabaseSync(file);
    sqlite.function('teamup_lower', { deterministic: true }, value => String(value ?? '').toLowerCase());
    sqlite.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  } else throw new Error('DB_DRIVER must be sqlite or mssql');

  async function query(sql, params, one = false, write = false) {
    if (sqlite) {
      if (!context.getStore()) await tail;
      const statement = sqlite.prepare(sql);
      return write
        ? statement.run(...params)
        : one
        ? statement.get(...params)
        : statement.all(...params);
    }
    const request = new mssql.Request(context.getStore() || pool);
    const prepared = bindSqlParameters(request, !write && db.mapRead ? db.mapRead(sql) : sql, params);
    const result = await request.query(prepared);
    return write
      ? { changes: result.rowsAffected[0] }
      : one
      ? result.recordset[0]
      : result.recordset;
  }
  let tail = Promise.resolve();
  const db = {
    driver,
    revision: 0,
    all: (sql, params = []) => query(sql, params),
    get: (sql, params = []) => query(sql, params, true),
    run: (sql, params = []) => {
      db.revision++;
      return query(sql, params, false, true);
    },
    async insert(table, values) {
      const keys = Object.keys(values);
      await db.run(
        `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`,
        Object.values(values)
      );
      return values;
    },
    async update(table, id, values) {
      const apply = async () => {
      if (db.sourceUpdate) await db.sourceUpdate(table, id, values);
      await db.run(
        `UPDATE ${table} SET ${Object.keys(values)
          .map(key => `${key} = ?`)
          .join(',')} WHERE id = ?`,
        [...Object.values(values), id]
      );
      };
      return db.sourceUpdate && !context.getStore() ? db.transaction(apply) : apply();
    },
    async transaction(callback) {
      // Serialize local writers; SQL Server additionally locks rows with SERIALIZABLE.
      const previous = tail;
      let release;
      tail = new Promise(resolve => {
        release = resolve;
      });
      await previous;
      const tx = sqlite ? null : new mssql.Transaction(pool);
      try {
        if (sqlite) sqlite.exec('BEGIN IMMEDIATE');
        else await tx.begin(mssql.ISOLATION_LEVEL.SERIALIZABLE);
        const result = await context.run(tx || true, callback);
        if (sqlite) sqlite.exec('COMMIT');
        else await tx.commit();
        db.revision++;
        return result;
      } catch (error) {
        if (sqlite) sqlite.exec('ROLLBACK');
        else await tx.rollback();
        db.revision++;
        throw error;
      } finally {
        release();
      }
    },
    close: () => (sqlite ? sqlite.close() : pool.close()),
  };
  try {
    await createSchema(db);
    await installSourceMapping(db);
  } catch (error) {
    await db.close();
    throw error;
  }
  return db;
}






