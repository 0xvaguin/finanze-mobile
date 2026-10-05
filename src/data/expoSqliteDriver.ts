/**
 * Adaptador de producao sobre expo-sqlite (API assincrona, SDK 51+).
 * ATENCAO: este arquivo NAO e compilado nem testado na entrega A (o Expo ainda
 * nao esta instalado neste projeto). Sera verificado na entrega B, ao instalar o Expo.
 */
import type { SqlDriver, SqlQueryable, SqlValue } from './sqlDriver';

// Tipagem minima do que usamos de expo-sqlite (SQLiteDatabase).
interface ExpoDb {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params: SqlValue[]): Promise<{ changes: number }>;
  getAllAsync<T>(sql: string, params: SqlValue[]): Promise<T[]>;
}

export function createExpoSqliteDriver(db: ExpoDb): SqlDriver {
  // Fila: uma operacao por vez. `transaction` ocupa a fila inteira ate o COMMIT/ROLLBACK,
  // entao chamadas de fora esperam; dentro dela, `fn` usa o executor `raw` (sem fila).
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = queue.then(fn, fn);
    queue = next.catch(() => undefined);
    return next;
  };

  const raw: SqlQueryable = {
    exec: (sql) => db.execAsync(sql),
    run: (sql, params = []) => db.runAsync(sql, params),
    all: <T>(sql: string, params: SqlValue[] = []) => db.getAllAsync<T>(sql, params),
  };

  return {
    exec: (sql) => serial(() => raw.exec(sql)),
    run: (sql, params) => serial(() => raw.run(sql, params)),
    all: <T>(sql: string, params?: SqlValue[]) => serial(() => raw.all<T>(sql, params)),
    transaction: <T>(fn: (tx: SqlQueryable) => Promise<T>) =>
      serial(async () => {
        await raw.exec('BEGIN');
        try {
          const result = await fn(raw);
          await raw.exec('COMMIT');
          return result;
        } catch (e) {
          await raw.exec('ROLLBACK');
          throw e;
        }
      }),
  };
}
