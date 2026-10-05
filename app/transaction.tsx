import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { RepositoryError } from '../src/data/repository';
import { categoriesFor } from '../src/domain/categories';
import { addDays, formatDateBR, maskDateBR, parseDateBR, todayLocal } from '../src/domain/dates';
import { lastUsedDefaults } from '../src/domain/statement';
import type { TransactionType } from '../src/domain/types';
import { useApp } from '../src/state/AppProvider';
import { Button, Chip, ConfirmDialog, Field, MoneyInput, Screen, Txt } from '../src/ui/components';
import { space } from '../src/ui/theme';
import { useTheme } from '../src/ui/ThemeProvider';

type Errors = Partial<Record<'amount' | 'date' | 'category' | 'account' | 'description' | 'type', string>>;

export default function TransactionScreen() {
  const { id, repeatId, prefillAmount, prefillDate, prefillDescription } = useLocalSearchParams<{
    id?: string; repeatId?: string; prefillAmount?: string; prefillDate?: string; prefillDescription?: string;
  }>();
  const { repo, bump } = useApp();
  const router = useRouter();
  const { p } = useTheme();
  const editing = !!id;

  const [ready, setReady] = useState(false);
  const [type, setType] = useState<TransactionType>('expense');
  const [cents, setCents] = useState(0);
  const [categoryId, setCategoryId] = useState('');
  const [dateText, setDateText] = useState(formatDateBR(todayLocal()));
  const [account, setAccount] = useState('');
  const [description, setDescription] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const all = await repo.listAllTransactions();
        const source = all.find((t) => t.id === (id ?? repeatId));
        if (source) {
          setType(source.type); setCents(source.amountCents); setCategoryId(source.categoryId);
          setAccount(source.account); setDescription(source.description);
          if (editing) setDateText(formatDateBR(source.date));
        } else {
          const d = lastUsedDefaults(all);
          if (d) { setAccount(d.account); setType(prefillAmount ? 'expense' : d.type); }
          if (prefillAmount) {
            setType('expense'); setCategoryId('investimentos');
            setCents(Number(prefillAmount) || 0);
            if (prefillDate) setDateText(formatDateBR(prefillDate));
            if (prefillDescription) setDescription(prefillDescription);
          }
        }
        setSuggestions(await repo.listAccountSuggestions());
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => { alive = false; };
  }, [repo, id, repeatId, editing, prefillAmount, prefillDate, prefillDescription]);

  const changeType = (next: TransactionType) => {
    setType(next);
    if (!categoriesFor(next).some((c) => c.id === categoryId)) setCategoryId('');
  };

  const save = async () => {
    setFormError(null);
    const date = parseDateBR(dateText);
    if (!date) { setErrors({ date: 'Informe uma data válida (dd/mm/aaaa).' }); return; }
    setSaving(true);
    try {
      const input = { type, amountCents: cents, date, categoryId, account, description };
      if (editing && id) await repo.updateTransaction(id, input);
      else await repo.createTransaction(input);
      bump();
      router.back();
    } catch (e) {
      if (e instanceof RepositoryError && e.fieldErrors) setErrors(e.fieldErrors as Errors);
      else setFormError(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!id) return;
    try {
      await repo.deleteTransaction(id);
      bump();
      router.back();
    } catch (e) {
      setConfirmDelete(false);
      setFormError(e instanceof Error ? e.message : 'Não foi possível excluir.');
    }
  };

  const title = editing ? 'Editar lançamento' : repeatId ? 'Repetir lançamento' : 'Novo lançamento';
  const today = todayLocal();

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 48 }}>
          {ready && (
            <>
              <MoneyInput label="Valor" cents={cents} onChange={setCents} error={errors.amount} autoFocus={!editing} />

              <View style={{ gap: 6 }}>
                <Txt variant="label">Tipo</Txt>
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <Chip label="Despesa" selected={type === 'expense'} color={p.expense} onPress={() => changeType('expense')} />
                  <Chip label="Receita" selected={type === 'income'} color={p.income} onPress={() => changeType('income')} />
                </View>
              </View>

              <View style={{ gap: 6 }}>
                <Txt variant="label">Categoria</Txt>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                  {categoriesFor(type).map((c) => (
                    <Chip key={c.id} label={c.name} color={c.color} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
                  ))}
                </View>
                {errors.category ? <Txt variant="muted" color={p.danger}>{errors.category}</Txt> : null}
              </View>

              <View style={{ gap: 6 }}>
                <Field label="Data" value={dateText} onChangeText={(t) => setDateText(maskDateBR(t))} keyboardType="number-pad" placeholder="dd/mm/aaaa" maxLength={10} error={errors.date} />
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <Chip label="Hoje" selected={parseDateBR(dateText) === today} onPress={() => setDateText(formatDateBR(today))} />
                  <Chip label="Ontem" selected={parseDateBR(dateText) === addDays(today, -1)} onPress={() => setDateText(formatDateBR(addDays(today, -1)))} />
                </View>
              </View>

              <View style={{ gap: 6 }}>
                <Field label="Conta" value={account} onChangeText={setAccount} placeholder="Ex.: Nubank, Dinheiro" maxLength={40} error={errors.account} autoCapitalize="sentences" />
                {suggestions.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                    {suggestions.map((sug) => (
                      <Chip key={sug} label={sug} selected={account.trim().toLowerCase() === sug.toLowerCase()} onPress={() => setAccount(sug)} />
                    ))}
                  </View>
                )}
              </View>

              <Field label="Descrição" value={description} onChangeText={setDescription} placeholder="Ex.: Almoço" maxLength={80} error={errors.description} />

              {formError ? <Txt color={p.danger}>{formError}</Txt> : null}
              <Button label={saving ? 'Salvando…' : 'Salvar'} onPress={save} disabled={saving} />
              {editing && <Button label="Excluir lançamento" kind="danger" onPress={() => setConfirmDelete(true)} />}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <ConfirmDialog
        visible={confirmDelete}
        title="Excluir lançamento?"
        message="Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        destructive
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </Screen>
  );
}
