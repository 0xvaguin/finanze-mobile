/**
 * Datas do app sao SEMPRE datas de calendario locais (YYYY-MM-DD).
 * Nunca usar Date#toISOString() para "hoje": converte para UTC e, no Brasil
 * (UTC-3), depois das 21h o "hoje" viraria o dia seguinte.
 */

const pad = (n: number, size = 2) => String(n).padStart(size, '0');

export function toLocalDateString(date: Date): string {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayLocal(now: Date = new Date()): string {
  return toLocalDateString(now);
}

export function isValidDateString(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

export function isValidMonth(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function currentMonth(now: Date = new Date()): string {
  return monthOf(todayLocal(now));
}

export function addMonths(month: string, delta: number): string {
  const year = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7)) - 1 + delta;
  const y = year + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  return `${pad(y, 4)}-${pad(mm + 1)}`;
}

/** Intervalo semiaberto [start, endExclusive) em strings YYYY-MM-DD. */
export function monthRange(month: string): { start: string; endExclusive: string } {
  return { start: `${month}-01`, endExclusive: `${addMonths(month, 1)}-01` };
}

export function isFutureDate(date: string, today: string): boolean {
  return date > today;
}

const MONTH_NAMES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export function formatMonthLabel(month: string): string {
  const name = MONTH_NAMES[Number(month.slice(5, 7)) - 1] ?? month;
  return `${name} de ${month.slice(0, 4)}`;
}

/** "29/09/2026" */
export function formatDateBR(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
}

/** Leva o dia de `date` para `month` (YYYY-MM), limitando ao ultimo dia do mes (31 -> 28/30). */
export function clampDayToMonth(date: string, month: string): string {
  const day = Number(date.slice(8, 10));
  const last = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  return `${month}-${String(Math.min(day, last)).padStart(2, '0')}`;
}

/** Mascara de digitacao "ddmmaaaa" -> "dd/mm/aaaa" (aceita colar com barras). */
export function maskDateBR(input: string): string {
  const d = input.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** "29/09/2026" -> "2026-09-29"; null se incompleta ou impossivel. */
export function parseDateBR(text: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  return isValidDateString(iso) ? iso : null;
}

/** Soma dias a uma data de calendario (usa UTC so como calculadora, sem fuso). */
export function addDays(date: string, delta: number): string {
  const t = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)) + delta);
  const d = new Date(t);
  return `${String(d.getUTCFullYear()).padStart(4, '0')}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
