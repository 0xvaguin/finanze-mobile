import type { SqlDriver } from './sqlDriver';

/** Cada item leva o banco de user_version N-1 para N. Nunca edite uma migracao publicada. */
export const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE transactions (
    id TEXT PRIMARY KEY NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income','expense')),
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0 AND amount_cents <= 100000000000),
    date TEXT NOT NULL,
    category_id TEXT NOT NULL,
    account TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT
  );
  CREATE INDEX idx_transactions_date ON transactions(date);

  CREATE TABLE investments (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    ticker TEXT,
    invested_cents INTEGER NOT NULL CHECK (invested_cents > 0 AND invested_cents <= 100000000000),
    market_value_cents INTEGER NOT NULL CHECK (market_value_cents >= 0 AND market_value_cents <= 100000000000),
    market_value_updated_at TEXT NOT NULL,
    purchase_date TEXT NOT NULL,
    note TEXT,
    quote_status TEXT NOT NULL DEFAULT 'manual',
    created_at TEXT NOT NULL
  );

  CREATE TABLE investment_value_entries (
    id TEXT PRIMARY KEY NOT NULL,
    investment_id TEXT NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
    market_value_cents INTEGER NOT NULL CHECK (market_value_cents >= 0 AND market_value_cents <= 100000000000),
    recorded_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX idx_entries_investment ON investment_value_entries(investment_id);

  CREATE TABLE settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS.length;

export async function runMigrations(driver: SqlDriver): Promise<void> {
  const rows = await driver.all<{ user_version: number }>('PRAGMA user_version');
  const current = Number(rows[0]?.user_version ?? 0);
  if (current > LATEST_SCHEMA_VERSION) {
    throw new Error('O banco de dados foi criado por uma versão mais nova do app.');
  }
  for (let version = current; version < LATEST_SCHEMA_VERSION; version++) {
    await driver.transaction(async (tx) => {
      await tx.exec(MIGRATIONS[version] as string);
      await tx.exec(`PRAGMA user_version = ${version + 1}`);
    });
  }
}
