import type { TransactionType } from './types';

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  /** Nome do icone (mapeado para o set de icones na camada de UI). */
  icon: string;
  /** Cor semantica discreta. */
  color: string;
}

export const EXPENSE_CATEGORIES: readonly Category[] = [
  { id: 'moradia', name: 'Moradia', type: 'expense', icon: 'home', color: '#7C8CF8' },
  { id: 'alimentacao', name: 'Alimentação', type: 'expense', icon: 'utensils', color: '#F2A65A' },
  { id: 'transporte', name: 'Transporte', type: 'expense', icon: 'car', color: '#5AB2F2' },
  { id: 'saude', name: 'Saúde', type: 'expense', icon: 'heart-pulse', color: '#F27C8C' },
  { id: 'educacao', name: 'Educação', type: 'expense', icon: 'graduation-cap', color: '#B08CF2' },
  { id: 'lazer', name: 'Lazer', type: 'expense', icon: 'party-popper', color: '#F2D35A' },
  { id: 'assinaturas', name: 'Assinaturas', type: 'expense', icon: 'repeat', color: '#8CD3F2' },
  { id: 'investimentos', name: 'Investimentos', type: 'expense', icon: 'trending-up', color: '#5AF2B0' },
  { id: 'outros', name: 'Outros', type: 'expense', icon: 'circle-ellipsis', color: '#9AA5B1' },
];

export const INCOME_CATEGORIES: readonly Category[] = [
  { id: 'salario', name: 'Salário', type: 'income', icon: 'briefcase', color: '#5AF2B0' },
  { id: 'rendimentos', name: 'Rendimentos', type: 'income', icon: 'piggy-bank', color: '#7CF2C8' },
  { id: 'reembolsos', name: 'Reembolsos', type: 'income', icon: 'undo-2', color: '#8CD3F2' },
  { id: 'outras_receitas', name: 'Outros', type: 'income', icon: 'circle-ellipsis', color: '#9AA5B1' },
];

const ALL: readonly Category[] = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

/** Categorias que NAO contam no "orcamento usado" (o aporte sai do saldo, mas nao e gasto). */
export const BUDGET_EXCLUDED_CATEGORY_IDS: readonly string[] = ['investimentos'];

export function getCategory(id: string): Category | undefined {
  return ALL.find((c) => c.id === id);
}

export function categoriesFor(type: TransactionType): readonly Category[] {
  return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

export function isCategoryValidFor(type: TransactionType, id: string): boolean {
  return categoriesFor(type).some((c) => c.id === id);
}

export function categoryName(id: string): string {
  return getCategory(id)?.name ?? 'Categoria desconhecida';
}
