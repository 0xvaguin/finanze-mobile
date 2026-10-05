import type { BackupData } from '../domain/backup';
import type {
  AppSettings,
  Investment,
  InvestmentInput,
  InvestmentValueEntry,
  Transaction,
  TransactionInput,
} from '../domain/types';

export type RepositoryErrorCode = 'not_found' | 'validation' | 'storage';

export class RepositoryError extends Error {
  constructor(
    public readonly code: RepositoryErrorCode,
    message: string,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}

/** Campos editaveis de um ativo. Mudar o valor de mercado gera nova entrada no historico. */
export type InvestmentUpdate = Omit<InvestmentInput, 'marketValueCents'> & { marketValueCents: number };

export interface FinanceRepository {
  listTransactions(month: string): Promise<Transaction[]>;
  listAllTransactions(): Promise<Transaction[]>;
  createTransaction(input: TransactionInput): Promise<Transaction>;
  /** Cria varios de uma vez, tudo ou nada (valida todos antes de gravar). */
  createTransactions(inputs: TransactionInput[]): Promise<Transaction[]>;
  updateTransaction(id: string, input: TransactionInput): Promise<Transaction>;
  deleteTransaction(id: string): Promise<void>;

  listInvestments(): Promise<Investment[]>;
  createInvestment(input: InvestmentInput): Promise<Investment>;
  updateInvestment(id: string, input: InvestmentUpdate): Promise<Investment>;
  deleteInvestment(id: string): Promise<void>;
  listInvestmentValueEntries(): Promise<InvestmentValueEntry[]>;

  getSettings(): Promise<AppSettings>;
  updateSettings(input: AppSettings): Promise<AppSettings>;

  /** Data/hora ISO do ultimo backup exportado, ou null se nunca exportou. */
  getLastBackupAt(): Promise<string | null>;
  setLastBackupAt(iso: string): Promise<void>;

  /** Contas ja usadas, mais frequentes primeiro (sugestoes do formulario). */
  listAccountSuggestions(limit?: number): Promise<string[]>;

  exportAll(): Promise<BackupData>;
  /** Substitui TODO o conteudo, de forma atomica (tudo ou nada). Dados ja validados por parseBackup. */
  replaceAll(data: BackupData): Promise<void>;
  clearAllData(): Promise<void>;
}
