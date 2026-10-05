/** Teto financeiro: R$ 1.000.000.000,00 em centavos. */
export const MAX_CENTS = 100_000_000_000;

export function isValidCents(value: unknown, opts: { allowZero?: boolean } = {}): value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) return false;
  if (value < 0 || value > MAX_CENTS) return false;
  if (value === 0 && !opts.allowZero) return false;
  return true;
}

/**
 * Interpreta um valor digitado em pt-BR e devolve centavos inteiros, sem usar
 * ponto flutuante. Retorna null quando o texto e invalido.
 *  "1.234,56" -> 123456 | "1234,5" -> 123450 | "1.234" -> 123400 | "12.50" -> 1250
 *  "R$ 10" -> 1000 | "-5" -> null | "1,234" -> null (3 casas decimais)
 */
export function parseBRL(input: string): number | null {
  if (typeof input !== 'string') return null;
  let text = input.replace(/R\$/gi, '').replace(/\s+/g, '');
  if (text === '') return null;

  let intPart: string;
  let decPart = '';

  if (text.includes(',')) {
    const pieces = text.split(',');
    if (pieces.length !== 2) return null;
    const left = pieces[0] as string;
    const right = pieces[1] as string;
    if (!/^\d{1,2}$/.test(right)) return null;
    if (!/^(\d+|\d{1,3}(\.\d{3})+)$/.test(left)) return null;
    intPart = left.replace(/\./g, '');
    decPart = right;
  } else if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
    intPart = text.replace(/\./g, '');
  } else if (/^\d+\.\d{1,2}$/.test(text)) {
    const [l, r] = text.split('.') as [string, string];
    intPart = l;
    decPart = r;
  } else if (/^\d+$/.test(text)) {
    intPart = text;
  } else {
    return null;
  }

  decPart = decPart.padEnd(2, '0');
  const digits = (intPart + decPart).replace(/^0+(?=\d)/, '');
  if (digits.length > 15) return null;
  const cents = Number(digits);
  return Number.isSafeInteger(cents) ? cents : null;
}

/** Formata centavos como "R$ 1.234,56" (deterministico, sem depender de ICU). */
export function formatBRL(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.trunc(cents));
  const reais = Math.floor(abs / 100);
  const rest = String(abs % 100).padStart(2, '0');
  const grouped = String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negative ? '-' : ''}R$ ${grouped},${rest}`;
}

/** "1234,56" (sem simbolo nem separador de milhar) - usado no CSV. */
export function formatDecimalBR(cents: number): string {
  const abs = Math.abs(Math.trunc(cents));
  const text = `${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
  return cents < 0 ? `-${text}` : text;
}

/** Percentual digitado em pt-BR: "12", "12,5", "12.5" -> numero; invalido -> null. */
export function parsePercentBR(input: string): number | null {
  const t = input.replace('%', '').replace(/\s+/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,4})?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
