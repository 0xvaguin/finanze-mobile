import Constants from 'expo-constants';
import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { formatDateBR, toLocalDateString, currentMonth } from '../../src/domain/dates';
import type { BackupData, BackupSummary } from '../../src/domain/backup';
import { exportBackupJson, exportTransactionsCsv, pickAndParseBackup } from '../../src/services/backupService';
import type { ThemePreference } from '../../src/domain/types';
import { useApp } from '../../src/state/AppProvider';
import { Button, Card, Chip, Field, MoneyInput, Screen, Txt } from '../../src/ui/components';
import { Modal, Switch } from 'react-native';
import { useAuth } from '../../src/state/AuthProvider';
import { authenticateBiometric, authService, biometricAvailable } from '../../src/services/authRuntime';
import { ChangePinModal } from '../../src/ui/auth/ChangePinModal';
import { radius } from '../../src/ui/theme';
import { useRepoData } from '../../src/ui/hooks';
import { space } from '../../src/ui/theme';
import { useTheme } from '../../src/ui/ThemeProvider';

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'dark', label: 'Escuro' },
  { value: 'light', label: 'Claro' },
  { value: 'system', label: 'Sistema' },
];

export default function Settings() {
  const { repo, settings, updateSettings, refreshSettings, bump, setMonth } = useApp();
  const auth = useAuth();
  const [changePin, setChangePin] = useState(false);
  const [bioOk, setBioOk] = useState(false);
  useEffect(() => { biometricAvailable().then(setBioOk); }, []);
  const toggleBio = async (on: boolean) => {
    if (on && !(await authenticateBiometric('Confirme para ativar a biometria'))) { setNotice('Não foi possível confirmar a biometria.'); return; }
    await authService.setBiometricEnabled(on);
    await auth.reloadProfile();
  };
  const { p } = useTheme();
  const [budget, setBudget] = useState(settings.monthlyBudgetCents);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const backup = useRepoData(() => repo.getLastBackupAt(), []);

  useEffect(() => setBudget(settings.monthlyBudgetCents), [settings.monthlyBudgetCents]);

  const saveBudget = async () => {
    setError(null);
    try {
      await updateSettings({ ...settings, monthlyBudgetCents: budget });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar.');
    }
  };


  type Flow =
    | { kind: 'import'; data: BackupData; summary: BackupSummary }
    | { kind: 'clear' };
  const [flow, setFlow] = useState<Flow | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [backedUp, setBackedUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [importIssues, setImportIssues] = useState<string[] | null>(null);
  const [counts, setCounts] = useState<{ tx: number; inv: number } | null>(null);
  const isWeb = Platform.OS === 'web';

  const run = async (fn: () => Promise<void>, okMessage?: string) => {
    setBusy(true); setNotice(null);
    try { await fn(); if (okMessage) setNotice(okMessage); backup.reload(); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'Algo deu errado. Tente novamente.'); }
    finally { setBusy(false); }
  };

  const loadCounts = async () => {
    const [t, i] = await Promise.all([repo.listAllTransactions(), repo.listInvestments()]);
    setCounts({ tx: t.length, inv: i.length });
  };

  const startImport = () => run(async () => {
    const parsed = await pickAndParseBackup();
    if (!parsed) return;
    if (!parsed.ok) {
      setImportIssues(parsed.issues.slice(0, 6).map((i) => `${i.path}: ${i.message}`));
      return;
    }
    await loadCounts();
    setBackedUp(false); setConfirmText('');
    setFlow({ kind: 'import', data: parsed.data, summary: parsed.summary });
  });

  const startClear = () => run(async () => {
    await loadCounts();
    setBackedUp(false); setConfirmText('');
    setFlow({ kind: 'clear' });
  });

  const exportBeforeDestructive = () => run(async () => {
    await exportBackupJson(repo);
    setBackedUp(true);
  });

  const confirmFlow = () => {
    const current = flow;
    if (!current) return;
    run(async () => {
      if (current.kind === 'import') await repo.replaceAll(current.data);
      else await repo.clearAllData();
      await refreshSettings();
      setMonth(currentMonth());
      bump();
      setFlow(null);
    }, current.kind === 'import' ? 'Backup importado. Seus dados foram substituídos.' : 'Todos os dados foram apagados.');
  };

  const canConfirm = flow?.kind === 'clear' ? confirmText.trim() === 'APAGAR' : !!flow;

  const lastBackup = backup.data ? formatDateBR(toLocalDateString(new Date(backup.data))) : null;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: 48 }}>
        <Txt variant="title" accessibilityRole="header">Configurações</Txt>

        <Card>
          <Txt variant="label">Tema</Txt>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {THEMES.map((t) => (
              <Chip key={t.value} label={t.label} selected={settings.theme === t.value}
                onPress={() => { updateSettings({ ...settings, theme: t.value }).catch(() => setError('Não foi possível salvar o tema.')); }} />
            ))}
          </View>
        </Card>

        <Card>
          <Txt variant="label">Orçamento mensal de referência</Txt>
          <MoneyInput label="Valor" cents={budget} onChange={(c) => { setBudget(c); setSaved(false); }} />
          <Txt variant="muted">Vale para todos os meses e não conta a categoria Investimentos. Deixe R$ 0,00 para remover.</Txt>
          {error ? <Txt variant="muted" color={p.danger}>{error}</Txt> : null}
          <Button label={saved ? 'Salvo' : 'Salvar orçamento'} onPress={saveBudget} disabled={budget === settings.monthlyBudgetCents} />
        </Card>

        {auth.supported && (
          <Card>
            <Txt variant="label">Segurança</Txt>
            <Txt>Perfil: {auth.name}</Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
              <Txt style={{ flex: 1 }}>Entrar com biometria</Txt>
              <Switch accessibilityLabel="Entrar com biometria" value={auth.biometricEnabled} onValueChange={toggleBio} disabled={!bioOk} />
            </View>
            {!bioOk && <Txt variant="muted">Biometria indisponível ou não cadastrada neste aparelho.</Txt>}
            <Button label="Alterar PIN" kind="secondary" onPress={() => setChangePin(true)} />
            <Button label="Bloquear agora" kind="secondary" onPress={auth.lock} />
            <Txt variant="muted">O PIN e a biometria protegem a abertura do app. Eles não criptografam o banco de dados do aparelho.</Txt>
          </Card>
        )}

        <Card>
          <Txt variant="label">Backup e dados</Txt>
          <Txt>{lastBackup ? `Último backup exportado: ${lastBackup}` : 'Nunca exportado'}</Txt>
          <Txt variant="muted">O backup em JSON é a única forma de recuperar seus dados se você trocar de aparelho ou desinstalar o app. Ele contém todo o seu histórico financeiro; compartilhe com cuidado.</Txt>
          {isWeb && <Txt variant="muted" color={p.warn}>Exportar e importar funcionam apenas no app nativo.</Txt>}
          {notice ? <Txt color={p.accent}>{notice}</Txt> : null}
          <Button label="Exportar backup (JSON)" onPress={() => run(async () => { await exportBackupJson(repo); }, 'Backup exportado.')} disabled={busy || isWeb} />
          <Button label="Exportar lançamentos (CSV)" kind="secondary" onPress={() => run(() => exportTransactionsCsv(repo))} disabled={busy || isWeb} />
          <Button label="Importar backup" kind="secondary" onPress={startImport} disabled={busy || isWeb} />
          <Button label="Apagar todos os dados" kind="danger" onPress={startClear} disabled={busy} />
        </Card>

        <Card>
          <Txt variant="label">Privacidade</Txt>
          <Txt>Seus dados ficam só neste aparelho. O app não os criptografa nem os envia a servidores. O PIN não é incluído no backup: ao restaurar em outro aparelho você cria um novo perfil.</Txt>
          {Platform.OS === 'web' && <Txt variant="muted" color={p.warn}>Na Web, os dados podem não persistir. Use o app nativo.</Txt>}
        </Card>

        <Txt variant="muted" style={{ textAlign: 'center' }}>Finanze {Constants.expoConfig?.version ?? ''}</Txt>
      </ScrollView>

      <ChangePinModal visible={changePin} onClose={() => setChangePin(false)} onChanged={() => { setChangePin(false); setNotice('PIN alterado.'); }} />

      <Modal transparent visible={!!importIssues} animationType="fade" onRequestClose={() => setImportIssues(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: space.xl }}>
          <View style={{ backgroundColor: p.surface, borderRadius: radius.lg, padding: space.xl, gap: space.sm, borderWidth: 1, borderColor: p.border }}>
            <Txt variant="heading">Não foi possível importar</Txt>
            <Txt variant="muted">Nada foi alterado. O arquivo tem problemas:</Txt>
            {importIssues?.map((i) => <Txt key={i} variant="muted">• {i}</Txt>)}
            <Button label="Entendi" onPress={() => setImportIssues(null)} />
          </View>
        </View>
      </Modal>

      <Modal transparent visible={!!flow} animationType="fade" onRequestClose={() => !busy && setFlow(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: space.xl }}>
          <View style={{ backgroundColor: p.surface, borderRadius: radius.lg, padding: space.xl, gap: space.md, borderWidth: 1, borderColor: p.border }} accessibilityViewIsModal>
            <Txt variant="heading">{flow?.kind === 'import' ? 'Substituir todos os dados?' : 'Apagar todos os dados?'}</Txt>
            {flow?.kind === 'import' ? (
              <Txt variant="muted">
                Serão removidos {counts?.tx ?? 0} lançamentos e {counts?.inv ?? 0} ativos atuais e importados {flow.summary.transactionCount} lançamentos e {flow.summary.investmentCount} ativos (backup de {formatDateBR(toLocalDateString(new Date(flow.summary.exportedAt)))}).
              </Txt>
            ) : (
              <Txt variant="muted">Serão removidos {counts?.tx ?? 0} lançamentos, {counts?.inv ?? 0} ativos e as configurações. Esta ação não pode ser desfeita.</Txt>
            )}
            <Button label={backedUp ? 'Backup atual exportado ✓' : 'Exportar backup atual antes'} kind="secondary" onPress={exportBeforeDestructive} disabled={busy || backedUp || isWeb} />
            {flow?.kind === 'clear' && (
              <Field label="Digite APAGAR para confirmar" value={confirmText} onChangeText={setConfirmText} autoCapitalize="characters" autoCorrect={false} />
            )}
            {notice ? <Txt variant="muted" color={p.danger}>{notice}</Txt> : null}
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button label="Cancelar" kind="secondary" onPress={() => setFlow(null)} disabled={busy} style={{ flex: 1 }} />
              <Button
                label={backedUp ? (flow?.kind === 'import' ? 'Substituir tudo' : 'Apagar tudo') : (flow?.kind === 'import' ? 'Substituir sem backup' : 'Apagar sem backup')}
                kind="danger" onPress={confirmFlow} disabled={busy || !canConfirm} style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
