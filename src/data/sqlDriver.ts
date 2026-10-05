export type SqlValue = string | number | null;

export interface SqlQueryable {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlValue[]): Promise<{ changes: number }>;
  all<T = Record<string, SqlValue>>(sql: string, params?: SqlValue[]): Promise<T[]>;
}

/**
 * Contrato minimo de acesso ao SQLite. O app usa expo-sqlite (expoSqliteDriver.ts);
 * os testes usam sql.js. As telas nunca enxergam este nivel.
 *
 * `transaction` executa `fn` entre BEGIN e COMMIT (ROLLBACK se `fn` lancar) e entrega
 * um executor `tx` que DEVE ser usado dentro dela. Chamadas ao driver feitas de fora
 * esperam a transacao terminar. Nao aninhar.
 */
export interface SqlDriver extends SqlQueryable {
  transaction<T>(fn: (tx: SqlQueryable) => Promise<T>): Promise<T>;
}
