import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { RepositoryError } from '../src/data/repository';
import { formatDateBR, maskDateBR, parseDateBR, todayLocal } from '../src/domain/dates';
import { formatBRL } from '../src/domain/money';
import { INVESTMENT_TYPES, INVESTMENT_TYPE_LABELS, type InvestmentType, type InvestmentValueEntry } from '../src/domain/types';
import { useApp } from '../src/state/AppProvider';
import { Button, Card, Chip, ConfirmDialog, Field, MoneyInput, Screen, Txt } from '../src/ui/components';
import { space } from '../src/ui/theme';
import { useTheme } from '../src/ui/ThemeProvider';

type Errors = Partial<Record<'name' | 'type' | 'ticker' | 'invested' | 'marketValue' | 'purchaseDate' | 'note', string>>;

export default function InvestmentScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { repo, bump } = useApp();
  const router = useRouter();
  const { p } = useTheme();
  const editing = !!id;

  const [ready, setReady] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<InvestmentType>('cdb');
  const [ticker, setTicker] = useState('');
  const [invested, setInvested] = useState(0);
  const [market, setMarket] = useState(0);
  const [marketTouched, setMarketTouched] = useState(false);
  const [dateText, setDateText] = useState(formatDateBR(todayLocal()));
  const [note, setNote] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [entries, setEntries] = useState<InvestmentValueEntry[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [offerAporte, setOfferAporte] = useState<{ cents: number; date: string; name: string } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (id) {
          const inv = (await repo.listInvestments()).find((i) => i.id === id);
          if (inv) {
            setName(inv.name); setType(inv.type); setTicker(inv.ticker ?? ''); setInvested(inv.investedAmountCents);
            setMarket(inv.marketValueCents); setMarketTouched(true); setDateText(formatDateBR(inv.purchaseDate));
            setNote(inv.note ?? ''); setUpdatedAt(inv.marketValueUpdatedAt);
            setEntries((await repo.listInvestmentValueEntries()).filter((e) => e.investmentId === id));
          }
        }
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => { alive = false; };
  }, [repo, id]);

  const shownMarket = marketTouched ? market : invested;

  const save = async () => {
    setFormError(null);
    const purchaseDate = parseDateBR(dateText);
    if (!purchaseDate) { setErrors({ purchaseDate: 'Informe uma data válida (dd/mm/aaaa).' }); return; }
    setSaving(true);
    try {
      const base = { name, type, ticker, investedAmountCents: invested, purchaseDate, note };
      if (editing && id) {
        await repo.updateInvestment(id, { ...base, marketValueCents: shownMarket });
        bump();
        router.back();
      } else {
        await repo.createInvestment(marketTouched ? { ...base, marketValueCents: market } : base);
        bump();
        setOfferAporte({ cents: invested, date: purchaseDate, name: name.trim() });
      }
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
      await repo.deleteInvestment(id);
      bump();
      router.back();
    } catch (e) {
      setConfirmDelete(false);
      setFormError(e instanceof Error ? e.message : 'Não foi possível excluir.');
    }
  };

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: editing ? 'Editar ativo' : 'Novo ativo' }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 48 }}>
          {ready && (
            <>
              <Field label="Nome" value={name} onChangeText={setName} placeholder="Ex.: CDB Banco X" maxLength={60} error={errors.name} autoFocus={!editing} />

              <View style={{ gap: 6 }}>
                <Txt variant="label">Tipo</Txt>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                  {INVESTMENT_TYPES.map((t) => (
                    <Chip key={t} label={INVESTMENT_TYPE_LABELS[t]} selected={type === t} onPress={() => setType(t)} />
                  ))}
                </View>
                {errors.type ? <Txt variant="muted" color={p.danger}>{errors.type}</Txt> : null}
              </View>

              <Field label="Ticker (opcional)" value={ticker} onChangeText={setTicker} placeholder="Ex.: PETR4" maxLength={12} autoCapitalize="characters" error={errors.ticker} />
              <MoneyInput label="Valor aplicado" cents={invested} onChange={setInvested} error={errors.invested} />
              <View style={{ gap: 6 }}>
                <MoneyInput label="Valor de mercado atual" cents={shownMarket} onChange={(c) => { setMarket(c); setMarketTouched(true); }} error={errors.marketValue} />
                <Txt variant="muted">
                  {editing && updatedAt
                    ? `Informado em ${formatDateBR(updatedAt)}. Ao alterar, o valor anterior fica guardado no histórico.`
                    : 'Você informa este valor manualmente. Se não alterar, ele começa igual ao valor aplicado.'}
                </Txt>
              </View>
              <Field label="Data da aplicação" value={dateText} onChangeText={(t) => setDateText(maskDateBR(t))} keyboardType="number-pad" placeholder="dd/mm/aaaa" maxLength={10} error={errors.purchaseDate} />
              <Field label="Observação (opcional)" value={note} onChangeText={setNote} maxLength={200} error={errors.note} />

              {formError ? <Txt color={p.danger}>{formError}</Txt> : null}
              <Button label={saving ? 'Salvando…' : 'Salvar'} onPress={save} disabled={saving} />
              {editing && <Button label="Excluir ativo" kind="danger" onPress={() => setConfirmDelete(true)} />}

              {editing && entries.length > 0 && (
                <Card>
                  <Txt variant="label">Histórico de valores informados</Txt>
                  {[...entries].reverse().map((e) => (
                    <View key={e.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Txt variant="muted">{formatDateBR(e.recordedAt)}</Txt>
                      <Txt>{formatBRL(e.marketValueCents)}</Txt>
                    </View>
                  ))}
                </Card>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <ConfirmDialog
        visible={confirmDelete}
        title="Excluir ativo?"
        message="O ativo e todo o seu histórico de valores serão removidos. Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        destructive
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
      <ConfirmDialog
        visible={!!offerAporte}
        title="Registrar o aporte no Extrato?"
        message={offerAporte ? `Cria uma despesa de ${formatBRL(offerAporte.cents)} na categoria Investimentos, com a data da aplicação. Você pode ajustar antes de salvar.` : ''}
        confirmLabel="Registrar"
        onConfirm={() => {
          const o = offerAporte;
          setOfferAporte(null);
          if (o) router.replace({ pathname: '/transaction', params: { prefillAmount: String(o.cents), prefillDate: o.date, prefillDescription: `Aporte ${o.name}` } });
        }}
        onCancel={() => { setOfferAporte(null); router.back(); }}
      />
    </Screen>
  );
}
