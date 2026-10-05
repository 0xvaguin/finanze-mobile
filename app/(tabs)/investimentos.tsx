import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { INVESTMENT_TYPE_LABELS } from '../../src/domain/types';
import { formatDateBR } from '../../src/domain/dates';
import { formatBRL } from '../../src/domain/money';
import { buildPortfolioHistory, investmentGainCents, summarizePortfolio } from '../../src/domain/portfolio';
import { useApp } from '../../src/state/AppProvider';
import { Button, Card, EmptyState, Fab, Screen, Txt } from '../../src/ui/components';
import { LineChart, dayNumber } from '../../src/ui/Charts';
import { useRepoData } from '../../src/ui/hooks';
import { MIN_TOUCH, space } from '../../src/ui/theme';
import { useTheme } from '../../src/ui/ThemeProvider';

export default function Investimentos() {
  const { repo } = useApp();
  const router = useRouter();
  const { p } = useTheme();
  const { data, error, reload } = useRepoData(async () => ({
    investments: await repo.listInvestments(),
    entries: await repo.listInvestmentValueEntries(),
  }), []);

  const addNew = () => router.push('/investment');
  const investments = data?.investments ?? [];
  const summary = summarizePortfolio(investments);
  const history = buildPortfolioHistory(data?.entries ?? []);
  const gainColor = summary.gainCents < 0 ? p.expense : p.income;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: 96 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Txt variant="title" accessibilityRole="header">Investimentos</Txt>
          <Button label="Simulador" kind="secondary" onPress={() => router.push('/simulator')} />
        </View>

        {error ? (
          <EmptyState title="Não foi possível carregar" message={error} action={<Button label="Tentar novamente" onPress={reload} />} />
        ) : data && investments.length === 0 ? (
          <EmptyState
            title="Nenhum ativo cadastrado"
            message="Cadastre seus investimentos para acompanhar o patrimônio que você informa."
            action={<Button label="Cadastrar ativo" onPress={addNew} />}
          />
        ) : data ? (
          <>
            <Card>
              <Txt variant="label">Patrimônio informado</Txt>
              <Txt variant="big">{formatBRL(summary.totalMarketValueCents)}</Txt>
              <View style={{ flexDirection: 'row', gap: space.lg }}>
                <View style={{ flex: 1 }}>
                  <Txt variant="label">Aplicado</Txt>
                  <Txt variant="heading">{formatBRL(summary.totalInvestedCents)}</Txt>
                </View>
                <View style={{ flex: 1 }}>
                  <Txt variant="label">Rendimento</Txt>
                  <Txt variant="heading" color={gainColor}>{summary.gainCents > 0 ? '+' : ''}{formatBRL(summary.gainCents)}</Txt>
                </View>
              </View>
              <Txt variant="muted">Valores informados por você, não são cotações de mercado.</Txt>
            </Card>

            <Card>
              <Txt variant="label">Evolução do patrimônio informado</Txt>
              {history.length >= 2 ? (
                <>
                  <LineChart
                    series={[{ step: true, color: p.accent, points: history.map((h) => ({ x: dayNumber(h.date), y: h.totalMarketValueCents })) }]}
                    label={`Evolução do patrimônio informado, de ${formatBRL((history[0] as { totalMarketValueCents: number }).totalMarketValueCents)} em ${formatDateBR((history[0] as { date: string }).date)} até ${formatBRL(summary.totalMarketValueCents)}`}
                  />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Txt variant="muted">{formatDateBR((history[0] as { date: string }).date)}</Txt>
                    <Txt variant="muted">{formatDateBR((history[history.length - 1] as { date: string }).date)}</Txt>
                  </View>
                  <Txt variant="muted">O gráfico só muda nos dias em que você atualiza os valores.</Txt>
                </>
              ) : (
                <Txt variant="muted">Atualize o valor de mercado dos ativos ao longo do tempo para ver a evolução aqui.</Txt>
              )}
            </Card>

            <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
              {investments.map((i, idx) => {
                const gain = investmentGainCents(i);
                return (
                  <Pressable
                    key={i.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${i.name}, ${INVESTMENT_TYPE_LABELS[i.type]}, valor informado ${formatBRL(i.marketValueCents)} em ${formatDateBR(i.marketValueUpdatedAt)}. Abrir`}
                    onPress={() => router.push({ pathname: '/investment', params: { id: i.id } })}
                    style={{ minHeight: MIN_TOUCH + 20, padding: space.lg, gap: 2, borderTopWidth: idx === 0 ? 0 : 1, borderTopColor: p.border }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
                      <Txt variant="heading" style={{ flexShrink: 1 }} numberOfLines={1}>{i.name}{i.ticker ? ` · ${i.ticker}` : ''}</Txt>
                      <Txt variant="heading">{formatBRL(i.marketValueCents)}</Txt>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Txt variant="muted">{INVESTMENT_TYPE_LABELS[i.type]} · informado em {formatDateBR(i.marketValueUpdatedAt)}</Txt>
                      <Txt variant="muted" color={gain < 0 ? p.expense : gain > 0 ? p.income : p.muted}>{gain > 0 ? '+' : ''}{formatBRL(gain)}</Txt>
                    </View>
                  </Pressable>
                );
              })}
            </Card>
          </>
        ) : null}
      </ScrollView>
      <Fab onPress={addNew} label="Novo ativo" />
    </Screen>
  );
}
