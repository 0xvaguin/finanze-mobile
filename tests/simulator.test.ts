import { MAX_CENTS } from '../src/domain/money';
import { annualToMonthlyPercent, monthlyToAnnualPercent, simulate } from '../src/domain/simulator';

const base = { initialCents: 100000, monthlyContributionCents: 0, ratePercent: 1, rateBasis: 'monthly' as const, months: 12 };

function ok(input: Parameters<typeof simulate>[0]) {
  const r = simulate(input);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.result;
}

describe('simulate', () => {
  test('juros compostos conhecidos: 1000 a 1% a.m. por 12 meses', () => {
    const r = ok(base);
    expect(r.finalCents).toBe(112683); // 1000 * 1,01^12 = 1126,83
    expect(r.contributedCents).toBe(100000);
    expect(r.yieldCents).toBe(12683);
    expect(r.series).toHaveLength(13);
    expect(r.series[0]).toEqual({ month: 0, balanceCents: 100000, contributedCents: 100000 });
  });

  test('taxa anual e convertida para mensal equivalente', () => {
    const r = ok({ ...base, ratePercent: 12, rateBasis: 'annual' });
    expect(r.monthlyRatePercent).toBeCloseTo(0.9489, 4);
    expect(Math.abs(r.finalCents - 112000)).toBeLessThanOrEqual(1); // 12% a.a. em 12 meses
    expect(r.annualRatePercent).toBe(12);
    expect(annualToMonthlyPercent(monthlyToAnnualPercent(1))).toBeCloseTo(1, 10);
  });

  test('aporte no fim do mes: o primeiro aporte nao rende no mes 1', () => {
    const r = ok({ initialCents: 0, monthlyContributionCents: 100000, ratePercent: 1, rateBasis: 'monthly', months: 2 });
    expect(r.series[1]?.balanceCents).toBe(100000);
    expect(r.series[2]?.balanceCents).toBe(201000); // 1000*1,01 + 1000
  });

  test('taxa zero: so soma os aportes', () => {
    const r = ok({ initialCents: 50000, monthlyContributionCents: 10000, ratePercent: 0, rateBasis: 'annual', months: 12 });
    expect(r.finalCents).toBe(170000);
    expect(r.yieldCents).toBe(0);
  });

  test('prazo minimo e maximo', () => {
    expect(simulate({ ...base, months: 1 }).ok).toBe(true);
    expect(simulate({ ...base, months: 600 }).ok).toBe(true);
    expect(simulate({ ...base, months: 0 }).ok).toBe(false);
    expect(simulate({ ...base, months: 601 }).ok).toBe(false);
    expect(simulate({ ...base, months: 1.5 }).ok).toBe(false);
  });

  test('entradas invalidas', () => {
    for (const bad of [
      { ...base, ratePercent: -1 }, { ...base, ratePercent: 101 }, { ...base, ratePercent: NaN },
      { ...base, initialCents: -1 }, { ...base, initialCents: MAX_CENTS + 1 },
      { ...base, monthlyContributionCents: 1.5 },
    ]) {
      expect(simulate(bad).ok).toBe(false);
    }
  });

  test('aviso para taxa anual equivalente muito alta (mensal 12 = ~289% a.a.)', () => {
    expect(ok({ ...base, ratePercent: 12, rateBasis: 'monthly' }).warnings).toHaveLength(1);
    expect(ok({ ...base, ratePercent: 12, rateBasis: 'annual' }).warnings).toHaveLength(0);
    expect(ok({ ...base, ratePercent: 31, rateBasis: 'annual' }).warnings).toHaveLength(1);
  });

  test('resultado grande demais vira erro, nunca Infinity/NaN', () => {
    const r = simulate({ initialCents: MAX_CENTS, monthlyContributionCents: MAX_CENTS, ratePercent: 100, rateBasis: 'monthly', months: 600 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.result).toBeDefined();
  });

  test('premissas sempre indicam valores nominais', () => {
    expect(ok(base).assumptions.join(' ')).toMatch(/nominais.*impostos.*inflação/);
  });
});
