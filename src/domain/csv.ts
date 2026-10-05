import { categoryName } from './categories';
import { formatDecimalBR } from './money';
import type { Transaction } from './types';

export const CSV_BOM = '\uFEFF';
export const CSV_SEPARATOR = ';';
export const CSV_HEADER = ['data', 'tipo', 'valor', 'categoria', 'conta', 'descrição'] as const;

/**
 * Neutraliza "formula injection": textos que comecam com = + - @ (ou tab/CR)
 * ganham um apostrofo na frente, e o Excel passa a trata-los como texto.
 */
export function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function escapeCsvField(value: string): string {
  if (/[;"\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

const textField = (v: string) => escapeCsvField(neutralizeFormula(v));

export function transactionsToCsv(transactions: readonly Transaction[]): string {
  const rows = [...transactions]
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
    .map((t) =>
      [
        t.date,
        t.type === 'income' ? 'Receita' : 'Despesa',
        formatDecimalBR(t.amountCents),
        textField(categoryName(t.categoryId)),
        textField(t.account),
        textField(t.description),
      ].join(CSV_SEPARATOR),
    );
  return CSV_BOM + [CSV_HEADER.join(CSV_SEPARATOR), ...rows].join('\r\n') + '\r\n';
}
