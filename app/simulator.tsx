import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { formatBRL, parsePercentBR } from '../src/domain/money';
import { SIMULATION_DISCLAIMER, simulate } from '../src/domain/simulator';
import type { RateBasis } from '../src/domain/simulator';
import { Card, Chip, Field, MoneyInput, Screen, Txt } from '../src/ui/components';
import { LineChart } from '../src/ui/Charts';
import { space } from '../src/ui/theme';
import { useTheme } from '../src/ui/ThemeProvider';

export default function Simulator() {
  const { p } = useTheme();
  const [initial, setInitial] = useState(0);
  const [monthly, setMonthly] = useState(50000);
  const [rateText, setRateText] = useState('10');
  const [basis, setBasis] = useState<RateBasis>('annual');
  const [monthsText, setMonthsText] = useState('120');

  const rate = parsePercentBR(rateText);
  const months = /^\d+$/.test(monthsText) ? Number(monthsText) : NaN;

  const outcome = useMemo(
    () => (rate === null ? null : simulate({ initialCents: initial, monthlyContributionCents: monthly, ratePercent: rate, rateBasis: basis, months })),
    [initial, monthly, rate, basis, months],
  );
  const errors = outcome && !outcome.ok ? outcome.errors : {};
  const result = outcome && outcome.ok ? outcome.result : null;

  return (
    <Screen edges={[]}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 48 }}>
        <MoneyInput label="Aporte inicial" cents={initial} onChange={setInitial} error={errors.initial} />
        <MoneyInput label="Aporte mensal" cents={monthly} onChange={setMonthly} error={errors.monthlyContribution} />

        <View style={{ gap: 6 }}>
          <Field label="Taxa de juros (%)" value={rateText} onChangeText={setRateText} keyboardType="decimal-pad"
            error={rate === null ? 'Informe um percentual válido, como 10 ou 0,8.' : errors.rate} />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Chip label="Ao ano" selected={basis === 'annual'} onPress={() => setBasis('annual')} />
            <Chip label="Ao mês" selected={basis === 'monthly'} onPress={() => setBasis('monthly')} />
          </View>
          {result && (
            <Txt variant="muted">
              Equivale a {result.monthlyRatePercent.toFixed(2).replace('.', ',')}% ao mês e {result.annualRatePercent.toFixed(2).replace('.', ',')}% ao ano.
            </Txt>
          )}
        </View>

        <View style={{ gap: 6 }}>
          <Field label="Prazo (meses)" value={monthsText} onChangeText={(t) => setMonthsText(t.replace(/\D/g, '').slice(0, 3))} keyboardType="number-pad" error={errors.months} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {[12, 60, 120, 240].map((m) => (
              <Chip key={m} label={m % 12 === 0 ? `${m / 12} ${m === 12 ? 'ano' : 'anos'}` : `${m} meses`} selected={months === m} onPress={() => setMonthsText(String(m))} />
            ))}
          </View>
        </View>

        {errors.result ? <Txt color={p.danger}>{errors.result}</Txt> : null}

        {result && (
          <>
            <Card>
              <Txt variant="label">Valor final estimado</Txt>
              <Txt variant="big">{formatBRL(result.finalCents)}</Txt>
              <View style={{ flexDirection: 'row', gap: space.lg }}>
                <View style={{ flex: 1 }}>
                  <Txt variant="label">Total aportado</Txt>
                  <Txt variant="heading">{formatBRL(result.contributedCents)}</Txt>
                </View>
                <View style={{ flex: 1 }}>
                  <Txt variant="label">Rendimento</Txt>
                  <Txt variant="heading" color={p.income}>{formatBRL(result.yieldCents)}</Txt>
                </View>
              </View>
              <LineChart
                label={`Projeção em ${months} meses: aportado ${formatBRL(result.contributedCents)}, valor final ${formatBRL(result.finalCents)}`}
                series={[
                  { color: p.muted, dashed: true, points: result.series.map((s) => ({ x: s.month, y: s.contributedCents })) },
                  { color: p.accent, points: result.series.map((s) => ({ x: s.month, y: s.balanceCents })) },
                ]}
              />
              <Txt variant="muted">Linha verde: valor estimado. Tracejada: total aportado.</Txt>
            </Card>

            {result.warnings.map((w) => (
              <Card key={w}><Txt color={p.warn}>{w}</Txt></Card>
            ))}

            <Card>
              <Txt variant="label">Premissas</Txt>
              {result.assumptions.map((a) => <Txt key={a} variant="muted">• {a}</Txt>)}
              <Txt variant="muted" style={{ marginTop: space.sm }}>{SIMULATION_DISCLAIMER}</Txt>
            </Card>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
