import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { categoryName } from '../src/domain/categories';
import { addMonths, clampDayToMonth, formatDateBR, formatMonthLabel } from '../src/domain/dates';
import { formatBRL } from '../src/domain/money';
import { useApp } from '../src/state/AppProvider';
import { Button, EmptyState, Screen, Txt } from '../src/ui/components';
import { useRepoData } from '../src/ui/hooks';
import { MIN_TOUCH, space } from '../src/ui/theme';
import { useTheme } from '../src/ui/ThemeProvider';

export default function CopyPrevious() {
  const { repo, month, bump } = useApp();
  const router = useRouter();
  const { p } = useTheme();
  const prevMonth = addMonths(month, -1);
  const { data, error } = useRepoData(() => repo.listTransactions(prevMonth), [prevMonth]);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const toggle = (id: string) =>
    setChosen((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const copy = async () => {
    if (!data) return;
    setSaving(true);
    setFailure(null);
    try {
      const inputs = data.filter((t) => chosen.has(t.id)).map((t) => ({
        type: t.type, amountCents: t.amountCents, date: clampDayToMonth(t.date, month),
        categoryId: t.categoryId, account: t.account, description: t.description,
      }));
      await repo.createTransactions(inputs);
      bump();
      router.back();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Não foi possível copiar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen edges={[]}>
      <View style={{ padding: space.lg, gap: space.sm }}>
        <Txt variant="muted">
          Marque os lançamentos de {formatMonthLabel(prevMonth)} que deseja trazer para {formatMonthLabel(month)}. As datas mantêm o dia do mês.
        </Txt>
        {data && data.length > 0 && (
          <Button
            label={chosen.size === data.length ? 'Desmarcar todos' : 'Selecionar todos'}
            kind="secondary"
            onPress={() => setChosen(chosen.size === data.length ? new Set() : new Set(data.map((t) => t.id)))}
          />
        )}
      </View>
      {error ? (
        <EmptyState title="Não foi possível carregar" message={error} />
      ) : data && data.length === 0 ? (
        <EmptyState title="Nada para copiar" message="O mês anterior não tem lançamentos." />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => {
            const on = chosen.has(item.id);
            return (
              <Pressable
                onPress={() => toggle(item.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${item.description}, ${formatBRL(item.amountCents)}, dia ${formatDateBR(item.date)}`}
                style={{ minHeight: MIN_TOUCH + 16, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, borderBottomWidth: 1, borderBottomColor: p.border }}
              >
                <Ionicons name={on ? 'checkbox' : 'square-outline'} size={24} color={on ? p.accent : p.muted} />
                <View style={{ flex: 1 }}>
                  <Txt numberOfLines={1}>{item.description}</Txt>
                  <Txt variant="muted" numberOfLines={1}>{categoryName(item.categoryId)} · {item.account}</Txt>
                </View>
                <Txt color={item.type === 'income' ? p.income : p.expense} style={{ fontWeight: '700' }}>
                  {item.type === 'income' ? '+' : '-'}{formatBRL(item.amountCents)}
                </Txt>
              </Pressable>
            );
          }}
        />
      )}
      <View style={{ padding: space.lg, gap: space.sm }}>
        {failure ? <Txt color={p.danger}>{failure}</Txt> : null}
        <Button label={chosen.size > 0 ? `Copiar ${chosen.size} lançamento${chosen.size > 1 ? 's' : ''}` : 'Selecione lançamentos'} onPress={copy} disabled={saving || chosen.size === 0} />
      </View>
    </Screen>
  );
}
