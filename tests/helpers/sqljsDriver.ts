import initSqlJs from 'sql.js';
import type { SqlDriver, SqlQueryable, SqlValue } from '../../src/data/sqlDriver';

export interface TestDriver extends SqlDriver {
  /** Faz a (n+1)-esima chamada a run() falhar (0 = a proxima). null desativa. */
  failRunIn(n: number | null): void;
}

/** SQLite real (sql.js/WASM) em memoria, com o mesmo contrato SqlDriver do app. */
export async function createTestDriver(): Promise<TestDriver> {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  let failIn: number | null = null;

  const maybeFail = () => {
    if (failIn === null) return;
    if (failIn === 0) {
      failIn = null;
      throw new Error('falha injetada');
    }
    failIn--;
  };

  const q: SqlQueryable = {
    exec: async (sql) => {
      db.exec(sql);
    },
    run: async (sql, params: SqlValue[] = []) => {
      maybeFail();
      db.run(sql, params);
      return { changes: db.getRowsModified() };
    },
    all: async <T>(sql: string, params: SqlValue[] = []) => {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      const rows: unknown[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      return rows as T[];
    },
  };

  return {
    ...q,
    transaction: async <T>(fn: (tx: SqlQueryable) => Promise<T>) => {
      db.exec('BEGIN');
      try {
        const result = await fn(q);
        db.exec('COMMIT');
        return result;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    failRunIn: (n) => {
      failIn = n;
    },
  };
}
