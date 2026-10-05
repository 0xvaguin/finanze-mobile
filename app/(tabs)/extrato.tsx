import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, SectionList, TextInput, View } from 'react-native';
import { categoryName, getCategory } from '../../src/domain/categories';
import { addMonths, formatDateBR, isFutureDate, todayLocal } from '../../src/domain/dates';
import { formatBRL } from '../../src/domain/money';
import { filterTransactions, groupByDay } from '../../src/domain/statement';
import type { Transaction } from '../../src/domain/types';
import { useApp } from '../../src/state/AppProvider';
import { Button, Chip, ConfirmDialog, EmptyState, Fab, MonthSwitcher, Pill, Screen, Txt } from '../../src/ui/components';
import { useRepoData } from '../../src/ui/hooks';
import { MIN_TOUCH, radius, space } from '../../src/ui/theme';
import { useStyles, useTheme } from '../../src/ui/ThemeProvider';

type TypeFilter = 'all' | 'income' | 'expense';

export default function Extrato() {
  const { repo, month, setMonth, bump } = useApp();
  const router = useRouter();
  const { p } = useTheme();
  const [query, setQuery] = useState('');
  const [type, setType] = useState<TypeFilter>('all');
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Transaction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const cur = useRepoData(() => repo.listTransactions(month), [month]);
  const prev = useRepoData(() => repo.listTransactions(addMonths(month, -1)), [month]);

  const today = todayLocal();
  const sections = useMemo(
    () => groupByDay(filterTransactions(cur.data ?? [], { query, type })).map((g) => ({ ...g, data: g.items })),
    [cur.data, query, type],
  );
  const s = useStyles((pal) => ({
    row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm, backgroundColor: pal.surface, borderBottomWidth: 1, borderBottomColor: pal.border },
    sectionHead: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingVertical: space.sm, backgroundColor: pal.bg },
    search: { minHeight: MIN_TOUCH, borderRadius: radius.md, borderWidth: 1, borderColor: pal.border, backgroundColor: pal.surface, color: pal.text, paddingHorizontal: space.md, fontSize: 16 },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: pal.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space.lg, gap: space.sm },
  }));

  const hasFilter = query.trim() !== '' || type !== 'all';
  const monthEmpty = (cur.data?.length ?? 0) === 0;

  const doDelete = async () => {
    if (!confirmDelete) return;
    try {
      await repo.deleteTransaction(confirmDelete.id);
      setConfirmDelete(null);
      bump();
    } catch (e) {
      setConfirmDelete(null);
      setActionError(e instanceof Error ? e.message : 'Não foi possível excluir.');
    }
  };

  return (
    <Screen>
      <View style={{ padding: space.lg, gap: space.sm }}>
        <MonthSwitcher month={month} onChange={setMonth} />
        <TextInput
          accessibilityLabel="Buscar por descrição ou conta"
          placeholder="Buscar por descrição ou conta"
          placeholderTextColor={p.muted}
          value={query}
          onChangeText={setQuery}
          style={s.search}
          returnKeyType="search"
        />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Chip label="Todos" selected={type === 'all'} onPress={() => setType('all')} />
          <Chip label="Receitas" selected={type === 'income'} onPress={() => setType('income')} color={p.income} />
          <Chip label="Despesas" selected={type === 'expense'} onPress={() => setType('expense')} color={p.expense} />
        </View>
        {actionError ? <Txt variant="muted" color={p.danger}>{actionError}</Txt> : null}
      </View>

      {cur.error ? (
        <EmptyState title="Não foi possível carregar" message={cur.error} action={<Button label="Tentar novamente" onPress={cur.reload} />} />
      ) : cur.data && sections.length === 0 ? (
        monthEmpty ? (
          <EmptyState
            title="Nenhum lançamento neste mês"
            message="Registre um lançamento ou traga os do mês anterior."
            action={
              <View style={{ gap: space.sm }}>
                <Button label="Registrar lançamento" onPress={() => router.push('/transaction')} />
                {(prev.data?.length ?? 0) > 0 && (
                  <Button label="Copiar do mês anterior" kind="secondary" onPress={() => router.push('/copy-previous')} />
                )}
              </View>
            }
          />
        ) : (
          <EmptyState title="Nada encontrado" message="Nenhum lançamento corresponde à busca." action={hasFilter ? <Button label="Limpar filtros" kind="secondary" onPress={() => { setQuery(''); setType('all'); }} /> : undefined} />
        )
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ paddingBottom: 96 }}
          stickySectionHeadersEnabled
          renderSectionHeader={({ section }) => (
            <View style={s.sectionHead}>
              <Txt variant="label">{formatDateBR(section.date)}</Txt>
              <Txt variant="muted" color={section.netCents < 0 ? p.expense : p.muted}>{formatBRL(section.netCents)}</Txt>
            </View>
          )}
          renderItem={({ item }) => {
            const cat = getCategory(item.categoryId);
            const sign = item.type === 'income' ? '+' : '-';
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.description}, ${item.type === 'income' ? 'receita' : 'despesa'} de ${formatBRL(item.amountCents)}, ${categoryName(item.categoryId)}, ${item.account}. Abrir opções`}
                onPress={() => setSelected(item)}
                style={s.row}
              >
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: cat?.color ?? p.muted }} />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Txt style={{ flexShrink: 1 }} numberOfLines={1}>{item.description}</Txt>
                    {isFutureDate(item.date, today) && <Pill label="Futuro" tone="warn" />}
                  </View>
                  <Txt variant="muted" numberOfLines={1}>{categoryName(item.categoryId)} · {item.account}</Txt>
                </View>
                <Txt color={item.type === 'income' ? p.income : p.expense} style={{ fontVariant: ['tabular-nums'], fontWeight: '700' }}>
                  {sign}{formatBRL(item.amountCents)}
                </Txt>
              </Pressable>
            );
          }}
        />
      )}

      <Fab onPress={() => router.push('/transaction')} />

      <Modal transparent visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        <Pressable style={s.backdrop} onPress={() => setSelected(null)} accessibilityLabel="Fechar opções">
          <Pressable style={s.sheet} onPress={() => undefined}>
            <Txt variant="heading" numberOfLines={1}>{selected?.description}</Txt>
            <Button label="Editar" kind="secondary" onPress={() => { const id = selected?.id; setSelected(null); if (id) router.push({ pathname: '/transaction', params: { id } }); }} />
            <Button label="Repetir" kind="secondary" onPress={() => { const id = selected?.id; setSelected(null); if (id) router.push({ pathname: '/transaction', params: { repeatId: id } }); }} />
            <Button label="Excluir" kind="danger" onPress={() => { setConfirmDelete(selected); setSelected(null); }} />
          </Pressable>
        </Pressable>
      </Modal>

      <ConfirmDialog
        visible={!!confirmDelete}
        title="Excluir lançamento?"
        message={confirmDelete ? `“${confirmDelete.description}” (${formatBRL(confirmDelete.amountCents)}) será removido. Esta ação não pode ser desfeita.` : ''}
        confirmLabel="Excluir"
        destructive
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </Screen>
  );
}
