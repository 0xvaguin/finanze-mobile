import { buildPortfolioHistory, investmentGainCents, latestEntry, summarizePortfolio } from '../src/domain/portfolio';
import type { Investment, InvestmentValueEntry } from '../src/domain/types';

const inv = (over: Partial<Investment>): Investment => ({
  id: 'i1', name: 'CDB', type: 'cdb', investedAmountCents: 100000, marketValueCents: 100000,
  marketValueUpdatedAt: '2026-01-01', purchaseDate: '2026-01-01', quoteStatus: 'manual', createdAt: '2026-01-01T00:00:00.000Z', ...over,
});
let n = 0;
const entry = (investmentId: string, recordedAt: string, marketValueCents: number): InvestmentValueEntry => ({
  id: `e${++n}`, investmentId, recordedAt, marketValueCents, createdAt: `2026-01-01T00:00:${String(n).padStart(2, '0')}.000Z`,
});

test('resumo da carteira', () => {
  const s = summarizePortfolio([inv({}), inv({ id: 'i2', investedAmountCents: 50000, marketValueCents: 60000 })]);
  expect(s).toEqual({ count: 2, totalInvestedCents: 150000, totalMarketValueCents: 160000, gainCents: 10000 });
  expect(investmentGainCents(inv({ marketValueCents: 90000 }))).toBe(-10000);
  expect(summarizePortfolio([]).gainCents).toBe(0);
});

test('historico carrega o ultimo valor conhecido de cada ativo (degraus)', () => {
  const h = buildPortfolioHistory([
    entry('a', '2026-01-01', 100),
    entry('b', '2026-02-01', 200),
    entry('a', '2026-03-01', 150),
  ]);
  expect(h).toEqual([
    { date: '2026-01-01', totalMarketValueCents: 100 },
    { date: '2026-02-01', totalMarketValueCents: 300 },
    { date: '2026-03-01', totalMarketValueCents: 350 },
  ]);
});

test('duas atualizacoes no mesmo dia: vale a ultima criada', () => {
  const h = buildPortfolioHistory([entry('a', '2026-01-01', 100), entry('a', '2026-01-01', 120)]);
  expect(h).toEqual([{ date: '2026-01-01', totalMarketValueCents: 120 }]);
  expect(latestEntry([entry('a', '2026-01-01', 1), entry('a', '2026-01-01', 2)])?.marketValueCents).toBe(2);
});

test('vazio', () => {
  expect(buildPortfolioHistory([])).toEqual([]);
  expect(latestEntry([])).toBeUndefined();
});
