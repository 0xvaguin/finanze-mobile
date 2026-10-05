import type { Investment, InvestmentValueEntry } from './types';

export interface PortfolioSummary {
  count: number;
  totalInvestedCents: number;
  /** "Patrimonio informado": soma dos ultimos valores informados manualmente. */
  totalMarketValueCents: number;
  gainCents: number;
}

export function summarizePortfolio(investments: readonly Investment[]): PortfolioSummary {
  let invested = 0;
  let market = 0;
  for (const i of investments) {
    invested += i.investedAmountCents;
    market += i.marketValueCents;
  }
  return {
    count: investments.length,
    totalInvestedCents: invested,
    totalMarketValueCents: market,
    gainCents: market - invested,
  };
}

export function investmentGainCents(i: Pick<Investment, 'investedAmountCents' | 'marketValueCents'>): number {
  return i.marketValueCents - i.investedAmountCents;
}

/** Ordenacao: data e, em empate, ordem de criacao. */
const byRecency = (a: InvestmentValueEntry, b: InvestmentValueEntry) =>
  a.recordedAt.localeCompare(b.recordedAt) || a.createdAt.localeCompare(b.createdAt);

export function latestEntry(entries: readonly InvestmentValueEntry[]): InvestmentValueEntry | undefined {
  return [...entries].sort(byRecency).pop();
}

export interface PortfolioHistoryPoint {
  date: string;
  totalMarketValueCents: number;
}

/**
 * Serie do patrimonio informado: em cada data em que algum valor foi informado,
 * soma o ultimo valor conhecido de cada ativo (carrega o valor anterior adiante).
 * Ativos sem entrada ate a data nao contam. O formato e de "degraus" - so muda
 * quando a pessoa atualiza valores.
 */
export function buildPortfolioHistory(entries: readonly InvestmentValueEntry[]): PortfolioHistoryPoint[] {
  const sorted = [...entries].sort(byRecency);
  const dates = [...new Set(sorted.map((e) => e.recordedAt))];
  const latestByInvestment = new Map<string, number>();
  const points: PortfolioHistoryPoint[] = [];
  let cursor = 0;
  for (const date of dates) {
    while (cursor < sorted.length && (sorted[cursor] as InvestmentValueEntry).recordedAt <= date) {
      const e = sorted[cursor] as InvestmentValueEntry;
      latestByInvestment.set(e.investmentId, e.marketValueCents);
      cursor++;
    }
    let total = 0;
    for (const v of latestByInvestment.values()) total += v;
    points.push({ date, totalMarketValueCents: total });
  }
  return points;
}
