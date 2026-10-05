export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  type: TransactionType;
  /** Valor em centavos inteiros (BRL). Sempre > 0; o sinal vem de `type`. */
  amountCents: number;
  /** Data de calendario local, YYYY-MM-DD. */
  date: string;
  categoryId: string;
  /** Texto livre (1..40), com sugestoes das contas ja usadas. */
  account: string;
  description: string;
  /** ISO 8601 (UTC). */
  createdAt: string;
  updatedAt?: string;
}

export interface TransactionInput {
  type: TransactionType;
  amountCents: number;
  date: string;
  categoryId: string;
  account: string;
  description: string;
}

export const INVESTMENT_TYPES = [
  'cdb',
  'tesouro',
  'acoes',
  'etf',
  'fundo',
  'renda_fixa',
  'outro',
] as const;
export type InvestmentType = (typeof INVESTMENT_TYPES)[number];

export const INVESTMENT_TYPE_LABELS: Record<InvestmentType, string> = {
  cdb: 'CDB',
  tesouro: 'Tesouro Direto',
  acoes: 'Ações',
  etf: 'ETF',
  fundo: 'Fundo',
  renda_fixa: 'Renda fixa',
  outro: 'Outro',
};

export type QuoteStatus = 'manual' | 'unavailable' | 'available';

export interface Investment {
  id: string;
  name: string;
  type: InvestmentType;
  ticker?: string;
  investedAmountCents: number;
  /** Ultimo valor de mercado informado (= ultima entrada do historico). */
  marketValueCents: number;
  /** Data (YYYY-MM-DD) da ultima atualizacao do valor de mercado. */
  marketValueUpdatedAt: string;
  purchaseDate: string;
  note?: string;
  quoteStatus: QuoteStatus;
  createdAt: string;
}

export interface InvestmentInput {
  name: string;
  type: InvestmentType;
  ticker?: string;
  investedAmountCents: number;
  /** Opcional na criacao: se omitido, igual ao valor aplicado. */
  marketValueCents?: number;
  purchaseDate: string;
  note?: string;
}

/** Historico append-only de valores informados manualmente. */
export interface InvestmentValueEntry {
  id: string;
  investmentId: string;
  marketValueCents: number;
  /** YYYY-MM-DD (data local em que o valor foi informado/vale). */
  recordedAt: string;
  createdAt: string;
}

export type ThemePreference = 'dark' | 'light' | 'system';

export interface AppSettings {
  theme: ThemePreference;
  /** 0 = sem orcamento configurado. Valor global, aplicado a todos os meses. */
  monthlyBudgetCents: number;
  currency: 'BRL';
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  monthlyBudgetCents: 0,
  currency: 'BRL',
};
