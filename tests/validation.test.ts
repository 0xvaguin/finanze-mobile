import { MAX_CENTS } from '../src/domain/money';
import {
  validateInvestmentInput, validateSettings, validateTransactionInput,
} from '../src/domain/validation';
import { txInput } from './helpers/factories';

describe('validateTransactionInput', () => {
  test('aceita e normaliza (aparar e colapsar espacos)', () => {
    const r = validateTransactionInput(txInput({ description: '  Almoço   com   time ', account: ' Conta  corrente ' }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.description).toBe('Almoço com time');
      expect(r.value.account).toBe('Conta corrente');
    }
  });

  test('aceita valor no teto e recusa acima dele', () => {
    expect(validateTransactionInput(txInput({ amountCents: MAX_CENTS })).ok).toBe(true);
    const r = validateTransactionInput(txInput({ amountCents: MAX_CENTS + 1 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.amount).toMatch(/limite/);
  });

  test.each([0, -100, 10.5, NaN, Infinity, '100' as unknown as number])('recusa valor %j', (amountCents) => {
    const r = validateTransactionInput(txInput({ amountCents }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.amount).toBeDefined();
  });

  test('cada erro fica no campo certo', () => {
    const r = validateTransactionInput({
      type: 'x', amountCents: 0, date: '2026-02-30', categoryId: '', account: '   ', description: '',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.errors).sort()).toEqual(['account', 'amount', 'category', 'date', 'description', 'type']);
    }
  });

  test('categoria precisa pertencer ao tipo', () => {
    const r1 = validateTransactionInput(txInput({ type: 'income', categoryId: 'alimentacao' }));
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.errors.category).toBeDefined();
    expect(validateTransactionInput(txInput({ type: 'income', categoryId: 'salario' })).ok).toBe(true);
    expect(validateTransactionInput(txInput({ type: 'expense', categoryId: 'salario' })).ok).toBe(false);
    expect(validateTransactionInput(txInput({ categoryId: 'nao-existe' })).ok).toBe(false);
  });

  test('limites de texto: 80 na descricao, 40 na conta', () => {
    expect(validateTransactionInput(txInput({ description: 'a'.repeat(80) })).ok).toBe(true);
    expect(validateTransactionInput(txInput({ description: 'a'.repeat(81) })).ok).toBe(false);
    expect(validateTransactionInput(txInput({ account: 'c'.repeat(40) })).ok).toBe(true);
    expect(validateTransactionInput(txInput({ account: 'c'.repeat(41) })).ok).toBe(false);
  });

  test('datas futuras sao permitidas', () => {
    expect(validateTransactionInput(txInput({ date: '2031-01-01' })).ok).toBe(true);
  });
});

describe('validateInvestmentInput', () => {
  const base = { name: 'CDB Banco X', type: 'cdb', investedAmountCents: 100000, purchaseDate: '2026-09-01' };

  test('aceita minimo e normaliza ticker', () => {
    expect(validateInvestmentInput(base).ok).toBe(true);
    const r = validateInvestmentInput({ ...base, type: 'acoes', ticker: ' petr4 ', note: ' bom ' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.ticker).toBe('PETR4');
      expect(r.value.note).toBe('bom');
    }
  });

  test('valor de mercado pode ser zero, mas nao negativo', () => {
    expect(validateInvestmentInput({ ...base, marketValueCents: 0 }).ok).toBe(true);
    expect(validateInvestmentInput({ ...base, marketValueCents: -1 }).ok).toBe(false);
  });

  test('erros por campo', () => {
    const r = validateInvestmentInput({ name: '', type: 'bitcoin', investedAmountCents: 0, purchaseDate: 'x', ticker: '!!' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['invested', 'name', 'purchaseDate', 'ticker', 'type']);
  });
});

describe('validateSettings', () => {
  test('aceita e rejeita', () => {
    expect(validateSettings({ theme: 'dark', monthlyBudgetCents: 0 }).ok).toBe(true);
    expect(validateSettings({ theme: 'system', monthlyBudgetCents: 500000 }).ok).toBe(true);
    expect(validateSettings({ theme: 'azul', monthlyBudgetCents: 0 }).ok).toBe(false);
    expect(validateSettings({ theme: 'dark', monthlyBudgetCents: -1 }).ok).toBe(false);
    expect(validateSettings({ theme: 'dark', monthlyBudgetCents: MAX_CENTS + 1 }).ok).toBe(false);
  });
});
