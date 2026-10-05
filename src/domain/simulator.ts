import { MAX_CENTS } from './money';

export type RateBasis = 'annual' | 'monthly';

export interface SimulationInput {
  initialCents: number;
  monthlyContributionCents: number;
  /** Percentual (ex.: 12 = 12%), na base indicada por `rateBasis`. 0..100 */
  ratePercent: number;
  rateBasis: RateBasis;
  /** 1..600 */
  months: number;
}

export type SimulationField = 'initial' | 'monthlyContribution' | 'rate' | 'months';

export interface SimulationPoint {
  month: number;
  balanceCents: number;
  contributedCents: number;
}

export interface SimulationResult {
  finalCents: number;
  contributedCents: number;
  yieldCents: number;
  monthlyRatePercent: number;
  annualRatePercent: number;
  /** month 0 = aporte inicial, antes de qualquer aporte mensal. */
  series: SimulationPoint[];
  assumptions: string[];
  warnings: string[];
}

export type SimulationOutcome =
  | { ok: true; result: SimulationResult }
  | { ok: false; errors: Partial<Record<SimulationField | 'result', string>> };

export const SIMULATION_DISCLAIMER =
  'Esta é uma simulação matemática e não representa garantia de rentabilidade ou recomendação de investimento.';

export const MAX_MONTHS = 600;
export const HIGH_ANNUAL_RATE_WARNING = 30;

export function annualToMonthlyPercent(annualPercent: number): number {
  return (Math.pow(1 + annualPercent / 100, 1 / 12) - 1) * 100;
}

export function monthlyToAnnualPercent(monthlyPercent: number): number {
  return (Math.pow(1 + monthlyPercent / 100, 12) - 1) * 100;
}

const isMoney = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= MAX_CENTS;

export function simulate(input: SimulationInput): SimulationOutcome {
  const errors: Partial<Record<SimulationField | 'result', string>> = {};

  if (!isMoney(input.initialCents)) errors.initial = 'Informe um aporte inicial válido (zero ou mais).';
  if (!isMoney(input.monthlyContributionCents)) {
    errors.monthlyContribution = 'Informe um aporte mensal válido (zero ou mais).';
  }
  if (!Number.isFinite(input.ratePercent) || input.ratePercent < 0 || input.ratePercent > 100) {
    errors.rate = 'A taxa deve estar entre 0% e 100%.';
  }
  if (!Number.isInteger(input.months) || input.months < 1 || input.months > MAX_MONTHS) {
    errors.months = `O prazo deve ser de 1 a ${MAX_MONTHS} meses.`;
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const monthlyRatePercent =
    input.rateBasis === 'annual' ? annualToMonthlyPercent(input.ratePercent) : input.ratePercent;
  const annualRatePercent =
    input.rateBasis === 'annual' ? input.ratePercent : monthlyToAnnualPercent(input.ratePercent);
  const r = monthlyRatePercent / 100;

  // Simulacao estimativa: ponto flutuante e aceito (decisao de produto).
  let balance = input.initialCents;
  const series: SimulationPoint[] = [
    { month: 0, balanceCents: Math.round(balance), contributedCents: input.initialCents },
  ];
  for (let m = 1; m <= input.months; m++) {
    balance = balance * (1 + r) + input.monthlyContributionCents; // aporte no fim do mes
    if (!Number.isFinite(balance) || balance > Number.MAX_SAFE_INTEGER) {
      return {
        ok: false,
        errors: { result: 'Os valores informados geram um resultado grande demais para exibir.' },
      };
    }
    series.push({
      month: m,
      balanceCents: Math.round(balance),
      contributedCents: input.initialCents + input.monthlyContributionCents * m,
    });
  }

  const contributedCents = input.initialCents + input.monthlyContributionCents * input.months;
  const finalCents = Math.round(balance);
  const warnings: string[] = [];
  if (annualRatePercent > HIGH_ANNUAL_RATE_WARNING) {
    warnings.push('Essa taxa é muito alta em comparação com o mercado. Confira se ela está na base certa (mensal ou anual).');
  }

  return {
    ok: true,
    result: {
      finalCents,
      contributedCents,
      yieldCents: finalCents - contributedCents,
      monthlyRatePercent,
      annualRatePercent,
      series,
      assumptions: [
        'Aportes mensais realizados no fim de cada mês.',
        'Taxa constante durante todo o prazo.',
        'Valores nominais, antes de impostos e sem descontar inflação.',
      ],
      warnings,
    },
  };
}
