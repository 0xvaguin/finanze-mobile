import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { getCategory, categoryName } from '../../src/domain/categories';
import { formatBRL } from '../../src/domain/money';
import { computeMonthSummary } from '../../src/domain/summary';
import { useApp } from '../../src/state/AppProvider';
import { useAuth } from '../../src/state/AuthProvider';
import { Button, Card, EmptyState, Fab, MonthSwitcher, Screen, Txt } from '../../src/ui/components';
import { useRepoData } from '../../src/ui/hooks';
import { space } from '../../src/ui/theme';
import { useTheme } from '../../src/ui/ThemeProvider';

export default function Dashboard() {
  const { repo, month, setMonth, settings } = useApp();
  const router = useRouter();
  const { p } = useTheme();
  const { name } = useAuth();
  const { data, error, reload } = useRepoData(() => repo.listTransactions(month), [month]);

  const newTx = () => router.push('/transaction');
  const summary = data ? computeMonthSummary(data, settings.monthlyBudgetCents) : null;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: 96 }}>
        {name ? <Txt variant="muted">Olá, {name}</Txt> : null}
        <MonthSwitcher month={month} onChange={setMonth} />

        {error ? (
          <EmptyState title="Não foi possível carregar" message={error} action={<Button label="Tentar novamente" onPress={reload} />} />
        ) : summary && summary.transactionCount === 0 ? (
          <EmptyState
            title="Nenhum lançamento neste mês"
            message="Registre sua primeira receita ou despesa para ver o resumo aqui."
            action={<Button label="Registrar lançamento" onPress={newTx} />}
          />
        ) : summary ? (
          <>
            <Card>
              <Txt variant="label">Saldo do mês</Txt>
              <Txt variant="big" color={summary.balanceCents < 0 ? p.expense : p.text} accessibilityLabel={`Saldo do mês ${formatBRL(summary.balanceCents)}`}>
                {formatBRL(summary.balanceCents)}
              </Txt>
              <View style={{ flexDirection: 'row', gap: space.lg, marginTop: space.sm }}>
                <View style={{ flex: 1 }}>
                  <Txt variant="label">Receitas</Txt>
                  <Txt variant="heading" color={p.income}>{formatBRL(summary.incomeCents)}</Txt>
                </View>
                <View style={{ flex: 1 }}>
                  <Txt variant="label">Despesas</Txt>
                  <Txt variant="heading" color={p.expense}>{formatBRL(summary.expenseCents)}</Txt>
                </View>
              </View>
              <Txt variant="muted">Inclui lançamentos com data futura neste mês.</Txt>
            </Card>

            <Card>
              <Txt variant="label">Orçamento atual</Txt>
              {summary.budgetStatus === 'none' ? (
                <>
                  <Txt variant="muted">Defina um limite mensal de referência para acompanhar seus gastos.</Txt>
                  <Button label="Definir orçamento" kind="secondary" onPress={() => router.navigate('/settings')} />
                </>
              ) : (
                <>
                  <Txt variant="heading">
                    {formatBRL(summary.budgetUsedCents)} de {formatBRL(summary.budgetCents)}
                  </Txt>
                  <View style={{ height: 10, borderRadius: 5, backgroundColor: p.surface2, overflow: 'hidden' }} accessibilityRole="progressbar"
                    accessibilityValue={{ min: 0, max: 100, now: Math.min(100, Math.round(summary.budgetPercent ?? 0)) }}>
                    <View style={{ height: 10, width: `${Math.min(100, summary.budgetPercent ?? 0)}%`, backgroundColor: summary.budgetStatus === 'over' ? p.warn : p.accent }} />
                  </View>
                  <Txt variant="muted">
                    {summary.budgetStatus === 'over'
                      ? `${formatBRL(summary.budgetUsedCents - summary.budgetCents)} acima do orçamento de referência (${summary.budgetPercent}%).`
                      : `${summary.budgetPercent}% do orçamento de referência.`}{' '}
                    Não conta a categoria Investimentos.
                  </Txt>
                </>
              )}
            </Card>

            {summary.expensesByCategory.length > 0 && (
              <Card>
                <Txt variant="label">Despesas por categoria</Txt>
                {summary.expensesByCategory.map((c) => {
                  const pct = summary.expenseCents > 0 ? (c.totalCents / summary.expenseCents) * 100 : 0;
                  const color = getCategory(c.categoryId)?.color ?? p.muted;
                  return (
                    <View key={c.categoryId} style={{ gap: 4, paddingVertical: 4 }} accessible accessibilityLabel={`${categoryName(c.categoryId)}, ${formatBRL(c.totalCents)}, ${Math.round(pct)} por cento das despesas`}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Txt>{categoryName(c.categoryId)}</Txt>
                        <Txt>{formatBRL(c.totalCents)}</Txt>
                      </View>
                      <View style={{ height: 6, borderRadius: 3, backgroundColor: p.surface2 }}>
                        <View style={{ height: 6, borderRadius: 3, width: `${Math.max(2, pct)}%`, backgroundColor: color }} />
                      </View>
                    </View>
                  );
                })}
              </Card>
            )}
          </>
        ) : null}
      </ScrollView>
      <Fab onPress={newTx} />
    </Screen>
  );
}
