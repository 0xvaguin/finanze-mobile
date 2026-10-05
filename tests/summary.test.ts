import { computeMonthSummary } from '../src/domain/summary';
import { accountSuggestions, filterTransactions, groupByDay, lastUsedDefaults, normalizeText } from '../src/domain/statement';
import { tx } from './helpers/factories';

describe('computeMonthSummary', () => {
  const list = [
    tx({ type: 'income', amountCents: 500000, categoryId: 'salario' }),
    tx({ amountCents: 120000, categoryId: 'moradia' }),
    tx({ amountCents: 30000, categoryId: 'alimentacao' }),
    tx({ amountCents: 50000, categoryId: 'investimentos' }),
  ];

  test('saldo inclui aportes; orcamento usado exclui investimentos', () => {
    const s = computeMonthSummary(list, 200000);
    expect(s.incomeCents).toBe(500000);
    expect(s.expenseCents).toBe(200000);
    expect(s.balanceCents).toBe(300000);
    expect(s.budgetUsedCents).toBe(150000);
    expect(s.budgetPercent).toBe(75);
    expect(s.budgetStatus).toBe('within');
  });

  test('acima do orcamento so quando o uso passa do limite', () => {
    expect(computeMonthSummary(list, 150000).budgetStatus).toBe('within');
    expect(computeMonthSummary(list, 149999).budgetStatus).toBe('over');
  });

  test('sem orcamento', () => {
    const s = computeMonthSummary(list, 0);
    expect(s.budgetStatus).toBe('none');
    expect(s.budgetPercent).toBeNull();
  });

  test('grafico: so categorias com despesa, da maior para a menor', () => {
    const s = computeMonthSummary(list, 0);
    expect(s.expensesByCategory.map((c) => c.categoryId)).toEqual(['moradia', 'investimentos', 'alimentacao']);
  });

  test('mes vazio', () => {
    const s = computeMonthSummary([], 100000);
    expect(s).toMatchObject({ incomeCents: 0, expenseCents: 0, balanceCents: 0, budgetPercent: 0, transactionCount: 0 });
    expect(s.expensesByCategory).toEqual([]);
  });

  test('centavos somam sem deriva', () => {
    const many = Array.from({ length: 1000 }, () => tx({ amountCents: 10 }));
    expect(computeMonthSummary(many, 0).expenseCents).toBe(10000);
  });
});

describe('extrato', () => {
  test('busca ignora acento e caixa, em descricao e conta', () => {
    const items = [
      tx({ description: 'Almoço', account: 'Nubank' }),
      tx({ description: 'Mercado', account: 'Cartão Itaú' }),
    ];
    expect(filterTransactions(items, { query: 'ALMOCO' })).toHaveLength(1);
    expect(filterTransactions(items, { query: 'cartao' })).toHaveLength(1);
    expect(filterTransactions(items, { query: 'zzz' })).toHaveLength(0);
    expect(filterTransactions(items, { query: '' })).toHaveLength(2);
    expect(normalizeText('Alimentação')).toBe('alimentacao');
  });

  test('filtro por tipo', () => {
    const items = [tx({ type: 'income', categoryId: 'salario' }), tx()];
    expect(filterTransactions(items, { type: 'income' })).toHaveLength(1);
    expect(filterTransactions(items, { type: 'all' })).toHaveLength(2);
  });

  test('agrupa por dia, mais recente primeiro, com saldo do dia', () => {
    const groups = groupByDay([
      tx({ date: '2026-09-01', amountCents: 100 }),
      tx({ date: '2026-09-05', amountCents: 300 }),
      tx({ date: '2026-09-05', type: 'income', categoryId: 'salario', amountCents: 1000 }),
    ]);
    expect(groups.map((g) => g.date)).toEqual(['2026-09-05', '2026-09-01']);
    expect(groups[0]?.items).toHaveLength(2);
    expect(groups[0]?.netCents).toBe(700);
  });

  test('sugestoes de conta: sem duplicar por caixa/acento, mais usadas primeiro', () => {
    const items = [
      tx({ account: 'Nubank' }), tx({ account: 'nubank' }), tx({ account: 'Itaú' }),
      tx({ account: 'Dinheiro' }), tx({ account: 'Dinheiro' }), tx({ account: 'DINHEIRO' }),
    ];
    expect(accountSuggestions(items)).toEqual(['Dinheiro', 'Nubank', 'Itaú']);
    expect(accountSuggestions(items, 1)).toEqual(['Dinheiro']);
  });
});

test('padroes do formulario: tipo e conta do ultimo lancamento criado', () => {
  expect(lastUsedDefaults([])).toBeNull();
  const items = [
    tx({ account: 'Nubank', createdAt: '2026-09-01T10:00:00.000Z' }),
    tx({ account: 'Itaú', type: 'income', categoryId: 'salario', createdAt: '2026-09-05T10:00:00.000Z' }),
    tx({ account: 'Dinheiro', createdAt: '2026-09-03T10:00:00.000Z' }),
  ];
  expect(lastUsedDefaults(items)).toEqual({ type: 'income', account: 'Itaú' });
});
