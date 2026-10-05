import { isCategoryValidFor } from './categories';
import { isValidDateString } from './dates';
import { isValidCents } from './money';
import {
  INVESTMENT_TYPES,
  type AppSettings,
  type InvestmentInput,
  type InvestmentType,
  type ThemePreference,
  type TransactionInput,
} from './types';

export const DESCRIPTION_MAX = 80;
export const ACCOUNT_MAX = 40;
export const INVESTMENT_NAME_MAX = 60;
export const TICKER_MAX = 12;
export const NOTE_MAX = 200;

export type FieldErrors<K extends string> = Partial<Record<K, string>>;
export type ValidationResult<T, K extends string> =
  | { ok: true; value: T }
  | { ok: false; errors: FieldErrors<K> };

const collapse = (s: string) => s.trim().replace(/\s+/g, ' ');

export type TransactionField =
  | 'type' | 'amount' | 'date' | 'category' | 'account' | 'description';

export function validateTransactionInput(
  input: Partial<Record<keyof TransactionInput, unknown>>,
): ValidationResult<TransactionInput, TransactionField> {
  const errors: FieldErrors<TransactionField> = {};

  const type = input.type;
  if (type !== 'income' && type !== 'expense') errors.type = 'Escolha receita ou despesa.';

  if (!isValidCents(input.amountCents)) {
    errors.amount =
      typeof input.amountCents === 'number' && input.amountCents > 0
        ? 'O valor excede o limite de R$ 1.000.000.000,00.'
        : 'Informe um valor maior que zero.';
  }

  if (!isValidDateString(input.date)) errors.date = 'Informe uma data válida.';

  if (typeof input.categoryId !== 'string' || input.categoryId === '') {
    errors.category = 'Escolha uma categoria.';
  } else if ((type === 'income' || type === 'expense') && !isCategoryValidFor(type, input.categoryId)) {
    errors.category = 'Escolha uma categoria válida para este tipo.';
  }

  const account = typeof input.account === 'string' ? collapse(input.account) : '';
  if (account.length === 0) errors.account = 'Informe a conta.';
  else if (account.length > ACCOUNT_MAX) errors.account = `Use até ${ACCOUNT_MAX} caracteres.`;

  const description = typeof input.description === 'string' ? collapse(input.description) : '';
  if (description.length === 0) errors.description = 'Informe uma descrição.';
  else if (description.length > DESCRIPTION_MAX) {
    errors.description = `Use até ${DESCRIPTION_MAX} caracteres.`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      type: type as TransactionInput['type'],
      amountCents: input.amountCents as number,
      date: input.date as string,
      categoryId: input.categoryId as string,
      account,
      description,
    },
  };
}

export type InvestmentField =
  | 'name' | 'type' | 'ticker' | 'invested' | 'marketValue' | 'purchaseDate' | 'note';

export function validateInvestmentInput(
  input: Partial<Record<keyof InvestmentInput, unknown>>,
): ValidationResult<InvestmentInput, InvestmentField> {
  const errors: FieldErrors<InvestmentField> = {};

  const name = typeof input.name === 'string' ? collapse(input.name) : '';
  if (name.length === 0) errors.name = 'Informe o nome do ativo.';
  else if (name.length > INVESTMENT_NAME_MAX) errors.name = `Use até ${INVESTMENT_NAME_MAX} caracteres.`;

  if (!INVESTMENT_TYPES.includes(input.type as InvestmentType)) errors.type = 'Escolha o tipo do ativo.';

  let ticker: string | undefined;
  if (input.ticker !== undefined && input.ticker !== null && input.ticker !== '') {
    if (typeof input.ticker !== 'string') errors.ticker = 'Ticker inválido.';
    else {
      ticker = input.ticker.trim().toUpperCase();
      if (ticker.length > TICKER_MAX || !/^[A-Z0-9.\-]+$/.test(ticker)) {
        errors.ticker = 'Use letras e números (até 12 caracteres).';
      }
    }
  }

  if (!isValidCents(input.investedAmountCents)) {
    errors.invested = 'Informe um valor aplicado maior que zero (até R$ 1.000.000.000,00).';
  }

  let marketValueCents: number | undefined;
  if (input.marketValueCents !== undefined && input.marketValueCents !== null) {
    if (!isValidCents(input.marketValueCents, { allowZero: true })) {
      errors.marketValue = 'Informe um valor de mercado válido (zero ou mais).';
    } else marketValueCents = input.marketValueCents;
  }

  if (!isValidDateString(input.purchaseDate)) errors.purchaseDate = 'Informe uma data válida.';

  let note: string | undefined;
  if (input.note !== undefined && input.note !== null && input.note !== '') {
    if (typeof input.note !== 'string') errors.note = 'Observação inválida.';
    else {
      note = input.note.trim();
      if (note.length > NOTE_MAX) errors.note = `Use até ${NOTE_MAX} caracteres.`;
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const value: InvestmentInput = {
    name,
    type: input.type as InvestmentType,
    investedAmountCents: input.investedAmountCents as number,
    purchaseDate: input.purchaseDate as string,
  };
  if (ticker) value.ticker = ticker;
  if (marketValueCents !== undefined) value.marketValueCents = marketValueCents;
  if (note) value.note = note;
  return { ok: true, value };
}

export type SettingsField = 'theme' | 'monthlyBudget';
const THEMES: readonly ThemePreference[] = ['dark', 'light', 'system'];

export function validateSettings(
  input: Partial<Record<keyof AppSettings, unknown>>,
): ValidationResult<AppSettings, SettingsField> {
  const errors: FieldErrors<SettingsField> = {};
  if (!THEMES.includes(input.theme as ThemePreference)) errors.theme = 'Tema inválido.';
  if (!isValidCents(input.monthlyBudgetCents, { allowZero: true })) {
    errors.monthlyBudget = 'Informe um orçamento válido (zero remove o orçamento).';
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      theme: input.theme as ThemePreference,
      monthlyBudgetCents: input.monthlyBudgetCents as number,
      currency: 'BRL',
    },
  };
}
