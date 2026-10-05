import type { BackupData } from '../domain/backup';
import { isValidMonth, monthRange, todayLocal } from '../domain/dates';
import { accountSuggestions } from '../domain/statement';
import { generateId } from '../domain/ids';
import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type Investment,
  type InvestmentInput,
  type InvestmentType,
  type InvestmentValueEntry,
  type ThemePreference,
  type Transaction,
  type TransactionInput,
  type TransactionType,
} from '../domain/types';
import {
  validateInvestmentInput,
  validateSettings,
  validateTransactionInput,
} from '../domain/validation';
import { runMigrations } from './migrations';
import {
  RepositoryError,
  type FinanceRepository,
  type InvestmentUpdate,
} from './repository';
import type { SqlDriver, SqlQueryable } from './sqlDriver';

export interface RepositoryDeps {
  now?: () => Date;
  newId?: () => string;
}

type TxRow = {
  id: string; type: string; amount_cents: number; date: string; category_id: string;
  account: string; description: string; created_at: string; updated_at: string | null;
};
type InvRow = {
  id: string; name: string; type: string; ticker: string | null; invested_cents: number;
  market_value_cents: number; market_value_updated_at: string; purchase_date: string;
  note: string | null; quote_status: string; created_at: string;
};
type EntryRow = {
  id: string; investment_id: string; market_value_cents: number; recorded_at: string; created_at: string;
};

const toTransaction = (r: TxRow): Transaction => {
  const t: Transaction = {
    id: r.id,
    type: r.type as TransactionType,
    amountCents: r.amount_cents,
    date: r.date,
    categoryId: r.category_id,
    account: r.account,
    description: r.description,
    createdAt: r.created_at,
  };
  if (r.updated_at) t.updatedAt = r.updated_at;
  return t;
};

const toInvestment = (r: InvRow): Investment => {
  const i: Investment = {
    id: r.id,
    name: r.name,
    type: r.type as InvestmentType,
    investedAmountCents: r.invested_cents,
    marketValueCents: r.market_value_cents,
    marketValueUpdatedAt: r.market_value_updated_at,
    purchaseDate: r.purchase_date,
    quoteStatus: 'manual',
    createdAt: r.created_at,
  };
  if (r.ticker) i.ticker = r.ticker;
  if (r.note) i.note = r.note;
  return i;
};

const toEntry = (r: EntryRow): InvestmentValueEntry => ({
  id: r.id,
  investmentId: r.investment_id,
  marketValueCents: r.market_value_cents,
  recordedAt: r.recorded_at,
  createdAt: r.created_at,
});

const TX_COLS = 'id, type, amount_cents, date, category_id, account, description, created_at, updated_at';
const INV_COLS =
  'id, name, type, ticker, invested_cents, market_value_cents, market_value_updated_at, purchase_date, note, quote_status, created_at';

export class SqlFinanceRepository implements FinanceRepository {
  private readonly now: () => Date;
  private readonly newId: () => string;

  private constructor(private readonly db: SqlDriver, deps: RepositoryDeps) {
    this.now = deps.now ?? (() => new Date());
    this.newId = deps.newId ?? generateId;
  }

  static async create(db: SqlDriver, deps: RepositoryDeps = {}): Promise<SqlFinanceRepository> {
    try {
      await db.exec('PRAGMA foreign_keys = ON');
      await runMigrations(db);
    } catch (e) {
      throw new RepositoryError('storage', 'Não foi possível abrir o banco de dados.');
    }
    return new SqlFinanceRepository(db, deps);
  }

  private async guard<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof RepositoryError) throw e;
      throw new RepositoryError('storage', 'Não foi possível salvar ou ler seus dados. Tente novamente.');
    }
  }

  // ---------- transacoes ----------

  listTransactions(month: string): Promise<Transaction[]> {
    return this.guard(async () => {
      if (!isValidMonth(month)) throw new RepositoryError('validation', 'Mês inválido.');
      const { start, endExclusive } = monthRange(month);
      const rows = await this.db.all<TxRow>(
        `SELECT ${TX_COLS} FROM transactions WHERE date >= ? AND date < ? ORDER BY date DESC, created_at DESC, id DESC`,
        [start, endExclusive],
      );
      return rows.map(toTransaction);
    });
  }

  listAllTransactions(): Promise<Transaction[]> {
    return this.guard(async () => {
      const rows = await this.db.all<TxRow>(
        `SELECT ${TX_COLS} FROM transactions ORDER BY date DESC, created_at DESC, id DESC`,
      );
      return rows.map(toTransaction);
    });
  }

  createTransaction(input: TransactionInput): Promise<Transaction> {
    return this.guard(async () => {
      const v = validateTransactionInput(input);
      if (!v.ok) throw new RepositoryError('validation', 'Dados inválidos.', v.errors as Record<string, string>);
      const t: Transaction = { id: this.newId(), ...v.value, createdAt: this.now().toISOString() };
      await this.db.run(
        `INSERT INTO transactions (${TX_COLS}) VALUES (?,?,?,?,?,?,?,?,NULL)`,
        [t.id, t.type, t.amountCents, t.date, t.categoryId, t.account, t.description, t.createdAt],
      );
      return t;
    });
  }

  createTransactions(inputs: TransactionInput[]): Promise<Transaction[]> {
    return this.guard(async () => {
      const created: Transaction[] = [];
      for (const input of inputs) {
        const v = validateTransactionInput(input);
        if (!v.ok) throw new RepositoryError('validation', 'Dados inválidos.', v.errors as Record<string, string>);
        created.push({ id: this.newId(), ...v.value, createdAt: this.now().toISOString() });
      }
      await this.db.transaction(async (tx) => {
        for (const t of created) {
          await tx.run(
            `INSERT INTO transactions (${TX_COLS}) VALUES (?,?,?,?,?,?,?,?,NULL)`,
            [t.id, t.type, t.amountCents, t.date, t.categoryId, t.account, t.description, t.createdAt],
          );
        }
      });
      return created;
    });
  }

  updateTransaction(id: string, input: TransactionInput): Promise<Transaction> {
    return this.guard(async () => {
      const v = validateTransactionInput(input);
      if (!v.ok) throw new RepositoryError('validation', 'Dados inválidos.', v.errors as Record<string, string>);
      const existing = await this.db.all<TxRow>(`SELECT ${TX_COLS} FROM transactions WHERE id = ?`, [id]);
      const current = existing[0];
      if (!current) throw new RepositoryError('not_found', 'Lançamento não encontrado.');
      const updatedAt = this.now().toISOString();
      await this.db.run(
        `UPDATE transactions SET type=?, amount_cents=?, date=?, category_id=?, account=?, description=?, updated_at=? WHERE id=?`,
        [v.value.type, v.value.amountCents, v.value.date, v.value.categoryId, v.value.account, v.value.description, updatedAt, id],
      );
      return { id, ...v.value, createdAt: current.created_at, updatedAt };
    });
  }

  deleteTransaction(id: string): Promise<void> {
    return this.guard(async () => {
      const { changes } = await this.db.run('DELETE FROM transactions WHERE id = ?', [id]);
      if (changes === 0) throw new RepositoryError('not_found', 'Lançamento não encontrado.');
    });
  }

  // ---------- investimentos ----------

  listInvestments(): Promise<Investment[]> {
    return this.guard(async () => {
      const rows = await this.db.all<InvRow>(`SELECT ${INV_COLS} FROM investments ORDER BY created_at DESC, id`);
      return rows.map(toInvestment);
    });
  }

  listInvestmentValueEntries(): Promise<InvestmentValueEntry[]> {
    return this.guard(async () => {
      const rows = await this.db.all<EntryRow>(
        'SELECT id, investment_id, market_value_cents, recorded_at, created_at FROM investment_value_entries ORDER BY recorded_at, created_at, id',
      );
      return rows.map(toEntry);
    });
  }

  private async insertEntry(q: SqlQueryable, investmentId: string, valueCents: number, recordedAt: string): Promise<void> {
    await q.run(
      'INSERT INTO investment_value_entries (id, investment_id, market_value_cents, recorded_at, created_at) VALUES (?,?,?,?,?)',
      [this.newId(), investmentId, valueCents, recordedAt, this.now().toISOString()],
    );
  }

  createInvestment(input: InvestmentInput): Promise<Investment> {
    return this.guard(async () => {
      const v = validateInvestmentInput(input);
      if (!v.ok) throw new RepositoryError('validation', 'Dados inválidos.', v.errors as Record<string, string>);
      const today = todayLocal(this.now());
      const marketValue = v.value.marketValueCents ?? v.value.investedAmountCents;
      const marketUpdatedAt = marketValue === v.value.investedAmountCents ? v.value.purchaseDate : today;
      const inv: Investment = {
        id: this.newId(),
        name: v.value.name,
        type: v.value.type,
        investedAmountCents: v.value.investedAmountCents,
        marketValueCents: marketValue,
        marketValueUpdatedAt: marketUpdatedAt,
        purchaseDate: v.value.purchaseDate,
        quoteStatus: 'manual',
        createdAt: this.now().toISOString(),
      };
      if (v.value.ticker) inv.ticker = v.value.ticker;
      if (v.value.note) inv.note = v.value.note;

      await this.db.transaction(async (tx) => {
        await tx.run(
          `INSERT INTO investments (${INV_COLS}) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          [inv.id, inv.name, inv.type, inv.ticker ?? null, inv.investedAmountCents, inv.marketValueCents,
           inv.marketValueUpdatedAt, inv.purchaseDate, inv.note ?? null, inv.quoteStatus, inv.createdAt],
        );
        // 1a entrada: o valor aplicado, na data da aplicacao.
        await this.insertEntry(tx, inv.id, inv.investedAmountCents, inv.purchaseDate);
        // Se ja nasceu com valor de mercado diferente, registra a 2a entrada (hoje).
        if (marketValue !== inv.investedAmountCents) await this.insertEntry(tx, inv.id, marketValue, today);
      });
      return inv;
    });
  }

  updateInvestment(id: string, input: InvestmentUpdate): Promise<Investment> {
    return this.guard(async () => {
      const v = validateInvestmentInput(input);
      if (!v.ok) throw new RepositoryError('validation', 'Dados inválidos.', v.errors as Record<string, string>);
      const rows = await this.db.all<InvRow>(`SELECT ${INV_COLS} FROM investments WHERE id = ?`, [id]);
      const current = rows[0];
      if (!current) throw new RepositoryError('not_found', 'Ativo não encontrado.');

      const newMarket = v.value.marketValueCents ?? current.market_value_cents;
      const valueChanged = newMarket !== current.market_value_cents;
      const today = todayLocal(this.now());
      const updatedAt = valueChanged ? today : current.market_value_updated_at;

      await this.db.transaction(async (tx) => {
        await tx.run(
          `UPDATE investments SET name=?, type=?, ticker=?, invested_cents=?, market_value_cents=?, market_value_updated_at=?, purchase_date=?, note=? WHERE id=?`,
          [v.value.name, v.value.type, v.value.ticker ?? null, v.value.investedAmountCents, newMarket,
           updatedAt, v.value.purchaseDate, v.value.note ?? null, id],
        );
        if (valueChanged) await this.insertEntry(tx, id, newMarket, today);
      });

      const inv: Investment = {
        id,
        name: v.value.name,
        type: v.value.type,
        investedAmountCents: v.value.investedAmountCents,
        marketValueCents: newMarket,
        marketValueUpdatedAt: updatedAt,
        purchaseDate: v.value.purchaseDate,
        quoteStatus: 'manual',
        createdAt: current.created_at,
      };
      if (v.value.ticker) inv.ticker = v.value.ticker;
      if (v.value.note) inv.note = v.value.note;
      return inv;
    });
  }

  deleteInvestment(id: string): Promise<void> {
    return this.guard(async () => {
      await this.db.transaction(async (tx) => {
        await tx.run('DELETE FROM investment_value_entries WHERE investment_id = ?', [id]);
        const { changes } = await tx.run('DELETE FROM investments WHERE id = ?', [id]);
        if (changes === 0) throw new RepositoryError('not_found', 'Ativo não encontrado.');
      });
    });
  }

  // ---------- configuracoes / meta ----------

  private async readSetting(key: string): Promise<string | null> {
    const rows = await this.db.all<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
    return rows[0]?.value ?? null;
  }

  private async writeSetting(q: SqlQueryable, key: string, value: string): Promise<void> {
    await q.run(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, value],
    );
  }

  getSettings(): Promise<AppSettings> {
    return this.guard(async () => {
      const theme = await this.readSetting('theme');
      const budget = await this.readSetting('monthly_budget_cents');
      const parsed = validateSettings({
        theme: (theme ?? DEFAULT_SETTINGS.theme) as ThemePreference,
        monthlyBudgetCents: budget === null ? DEFAULT_SETTINGS.monthlyBudgetCents : Number(budget),
      });
      return parsed.ok ? parsed.value : { ...DEFAULT_SETTINGS };
    });
  }

  updateSettings(input: AppSettings): Promise<AppSettings> {
    return this.guard(async () => {
      const v = validateSettings(input);
      if (!v.ok) throw new RepositoryError('validation', 'Configurações inválidas.', v.errors as Record<string, string>);
      await this.db.transaction(async (tx) => {
        await this.writeSetting(tx, 'theme', v.value.theme);
        await this.writeSetting(tx, 'monthly_budget_cents', String(v.value.monthlyBudgetCents));
      });
      return v.value;
    });
  }

  getLastBackupAt(): Promise<string | null> {
    return this.guard(() => this.readSetting('last_backup_at'));
  }

  setLastBackupAt(iso: string): Promise<void> {
    return this.guard(() => this.writeSetting(this.db, 'last_backup_at', iso));
  }

  listAccountSuggestions(limit = 8): Promise<string[]> {
    return this.guard(async () => {
      const rows = await this.db.all<TxRow>(`SELECT ${TX_COLS} FROM transactions`);
      return accountSuggestions(rows.map(toTransaction), limit);
    });
  }

  // ---------- exportacao / importacao / limpeza ----------

  exportAll(): Promise<BackupData> {
    return this.guard(async () => ({
      settings: await this.getSettings(),
      transactions: await this.listAllTransactions(),
      investments: await this.listInvestments(),
      investmentValueEntries: await this.listInvestmentValueEntries(),
    }));
  }

  replaceAll(data: BackupData): Promise<void> {
    return this.guard(async () => {
      await this.db.transaction(async (tx) => {
        await this.wipe(tx);
        for (const t of data.transactions) {
          await tx.run(
            `INSERT INTO transactions (${TX_COLS}) VALUES (?,?,?,?,?,?,?,?,?)`,
            [t.id, t.type, t.amountCents, t.date, t.categoryId, t.account, t.description, t.createdAt, t.updatedAt ?? null],
          );
        }
        for (const i of data.investments) {
          await tx.run(
            `INSERT INTO investments (${INV_COLS}) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
            [i.id, i.name, i.type, i.ticker ?? null, i.investedAmountCents, i.marketValueCents,
             i.marketValueUpdatedAt, i.purchaseDate, i.note ?? null, i.quoteStatus, i.createdAt],
          );
        }
        for (const e of data.investmentValueEntries) {
          await tx.run(
            'INSERT INTO investment_value_entries (id, investment_id, market_value_cents, recorded_at, created_at) VALUES (?,?,?,?,?)',
            [e.id, e.investmentId, e.marketValueCents, e.recordedAt, e.createdAt],
          );
        }
        await this.writeSetting(tx, 'theme', data.settings.theme);
        await this.writeSetting(tx, 'monthly_budget_cents', String(data.settings.monthlyBudgetCents));
      });
    });
  }

  clearAllData(): Promise<void> {
    return this.guard(async () => {
      await this.db.transaction(async (tx) => {
        await this.wipe(tx);
        await tx.run('DELETE FROM settings');
      });
    });
  }

  private async wipe(q: SqlQueryable): Promise<void> {
    await q.run('DELETE FROM investment_value_entries');
    await q.run('DELETE FROM investments');
    await q.run('DELETE FROM transactions');
  }
}
