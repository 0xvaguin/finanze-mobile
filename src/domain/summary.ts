import { BUDGET_EXCLUDED_CATEGORY_IDS } from './categories';
import type { Transaction } from './types';

export type BudgetStatus = 'none' | 'within' | 'over';

export interface CategoryTotal {
  categoryId: string;
  totalCents: number;
}

export interface MonthSummary {
  incomeCents: number;
  expenseCents: number;
  /** receitas - despesas (inclui aportes). */
  balanceCents: number;
  /** Despesas que contam no orcamento (exclui categoria Investimentos). */
  budgetUsedCents: number;
  budgetCents: number;
  /** null quando nao ha orcamento. Uma casa decimal. */
  budgetPercent: number | null;
  budgetStatus: BudgetStatus;
  /** Apenas categorias com despesa > 0, da maior para a menor. */
  expensesByCategory: CategoryTotal[];
  transactionCount: number;
}

export function computeMonthSummary(transactions: readonly Transaction[], budgetCents: number): MonthSummary {
  let income = 0;
  let expense = 0;
  let budgetUsed = 0;
  const byCategory = new Map<string, number>();

  for (const t of transactions) {
    if (t.type === 'income') {
      income += t.amountCents;
    } else {
      expense += t.amountCents;
      byCategory.set(t.categoryId, (byCategory.get(t.categoryId) ?? 0) + t.amountCents);
      if (!BUDGET_EXCLUDED_CATEGORY_IDS.includes(t.categoryId)) budgetUsed += t.amountCents;
    }
  }

  const hasBudget = budgetCents > 0;
  return {
    incomeCents: income,
    expenseCents: expense,
    balanceCents: income - expense,
    budgetUsedCents: budgetUsed,
    budgetCents,
    budgetPercent: hasBudget ? Math.round((budgetUsed * 1000) / budgetCents) / 10 : null,
    budgetStatus: !hasBudget ? 'none' : budgetUsed > budgetCents ? 'over' : 'within',
    expensesByCategory: [...byCategory.entries()]
      .filter(([, total]) => total > 0)
      .map(([categoryId, totalCents]) => ({ categoryId, totalCents }))
      .sort((a, b) => b.totalCents - a.totalCents || a.categoryId.localeCompare(b.categoryId)),
    transactionCount: transactions.length,
  };
}
