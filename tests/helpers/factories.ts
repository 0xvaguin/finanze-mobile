import type { Transaction, TransactionInput } from '../../src/domain/types';

let seq = 0;
export function tx(overrides: Partial<Transaction> = {}): Transaction {
  seq++;
  return {
    id: `t${seq}`,
    type: 'expense',
    amountCents: 1000,
    date: '2026-09-10',
    categoryId: 'alimentacao',
    account: 'Nubank',
    description: 'Almoço',
    createdAt: `2026-09-10T12:00:${String(seq % 60).padStart(2, '0')}.000Z`,
    ...overrides,
  };
}

export function txInput(overrides: Partial<TransactionInput> = {}): TransactionInput {
  return {
    type: 'expense',
    amountCents: 1500,
    date: '2026-09-10',
    categoryId: 'alimentacao',
    account: 'Nubank',
    description: 'Almoço',
    ...overrides,
  };
}
