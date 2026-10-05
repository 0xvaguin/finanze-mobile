import type { Transaction, TransactionType } from './types';

/** minusculas e sem acentos: "Alimentação" casa com "alimentacao". */
export function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export interface StatementFilter {
  query?: string;
  type?: TransactionType | 'all';
}

export function filterTransactions(
  transactions: readonly Transaction[],
  filter: StatementFilter,
): Transaction[] {
  const query = normalizeText(filter.query ?? '');
  const type = filter.type ?? 'all';
  return transactions.filter((t) => {
    if (type !== 'all' && t.type !== type) return false;
    if (query === '') return true;
    return normalizeText(t.description).includes(query) || normalizeText(t.account).includes(query);
  });
}

export interface DayGroup {
  date: string;
  items: Transaction[];
  /** receitas - despesas do dia */
  netCents: number;
}

/** Agrupa por dia, do mais recente para o mais antigo (desempate por criacao). */
export function groupByDay(transactions: readonly Transaction[]): DayGroup[] {
  const sorted = [...transactions].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  );
  const groups: DayGroup[] = [];
  for (const t of sorted) {
    let last = groups[groups.length - 1];
    if (!last || last.date !== t.date) {
      last = { date: t.date, items: [], netCents: 0 };
      groups.push(last);
    }
    last.items.push(t);
    last.netCents += t.type === 'income' ? t.amountCents : -t.amountCents;
  }
  return groups;
}

/** Contas ja usadas (sem repetir ignorando caixa/acento), mais frequentes primeiro. */
export function accountSuggestions(transactions: readonly Transaction[], limit = 8): string[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const t of transactions) {
    const key = normalizeText(t.account);
    const current = counts.get(key);
    if (current) current.count += 1;
    else counts.set(key, { label: t.account, count: 1 });
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map((c) => c.label);
}

/** Padroes do formulario: tipo e conta do ultimo lancamento criado (por createdAt). */
export function lastUsedDefaults(
  transactions: readonly Transaction[],
): { type: TransactionType; account: string } | null {
  let last: Transaction | undefined;
  for (const t of transactions) if (!last || t.createdAt > last.createdAt) last = t;
  return last ? { type: last.type, account: last.account } : null;
}
