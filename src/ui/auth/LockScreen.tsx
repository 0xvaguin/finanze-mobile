import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { currentMonth } from '../../domain/dates';
import { PIN_LENGTH, isLocked } from '../../domain/pin';
import { authenticateBiometric, authService } from '../../services/authRuntime';
import { useApp } from '../../state/AppProvider';
import { Button, Field, Txt } from '../components';
import { MIN_TOUCH, radius, space } from '../theme';
import { useTheme } from '../ThemeProvider';
import { PinDots, PinPad } from './PinPad';

const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function LockScreen({
  name, biometricEnabled, onUnlocked, onReset,
}: { name: string; biometricEnabled: boolean; onUnlocked: () => void; onReset: () => void }) {
  const { p } = useTheme();
  const { repo, refreshSettings, bump, setMonth } = useApp();
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const triedBio = useRef(false);

  const locked = isLocked(lockedUntil, now);

  useEffect(() => {
    authService.getProfile().then((pr) => pr && pr.lockedUntil && setLockedUntil(pr.lockedUntil));
  }, []);

  useEffect(() => {
    if (!locked) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [locked]);

  const tryBiometric = useCallback(async () => {
    if (await authenticateBiometric('Desbloquear o Finanze')) onUnlocked();
  }, [onUnlocked]);

  useEffect(() => {
    if (biometricEnabled && !triedBio.current) { triedBio.current = true; tryBiometric(); }
  }, [biometricEnabled, tryBiometric]);

  const submit = async (value: string) => {
    setBusy(true);
    const r = await authService.verifyPin(value);
    setBusy(false);
    setPin('');
    if (r.ok) { onUnlocked(); return; }
    setNow(Date.now());
    if (r.reason === 'locked') { setLockedUntil(r.lockedUntil); setMessage(null); }
    else if (r.reason === 'wrong') {
      setLockedUntil(r.lockedUntil);
      setMessage(r.lockedUntil ? 'PIN incorreto.' : `PIN incorreto. ${r.attemptsBeforeLock} ${r.attemptsBeforeLock === 1 ? 'tentativa' : 'tentativas'} antes do bloqueio temporário.`);
    }
  };

  const onChange = (v: string) => {
    setPin(v); setMessage(null);
    if (v.length === PIN_LENGTH) submit(v);
  };

  const doReset = async () => {
    setResetError(null);
    try {
      await repo.clearAllData();
      await authService.reset();
      await refreshSettings();
      setMonth(currentMonth());
      bump();
      setForgot(false);
      onReset();
    } catch {
      setResetError('Não foi possível apagar os dados. Tente novamente.');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, padding: space.xl, justifyContent: 'center', gap: space.xl }}>
      <View style={{ alignItems: 'center', gap: space.sm }}>
        <Ionicons name="lock-closed-outline" size={44} color={p.accent} />
        <Txt variant="title" accessibilityRole="header">Olá, {name}</Txt>
        <Txt variant="muted">Digite seu PIN para entrar</Txt>
      </View>

      <PinDots length={pin.length} error={!!message} />
      <View style={{ minHeight: 40, alignItems: 'center' }} accessibilityLiveRegion="polite">
        {locked && lockedUntil ? (
          <Txt color={p.warn} style={{ textAlign: 'center' }}>Muitas tentativas. Tente novamente em {fmt(lockedUntil - now)}.</Txt>
        ) : message ? (
          <Txt color={p.danger} style={{ textAlign: 'center' }}>{message}</Txt>
        ) : null}
      </View>

      <PinPad
        value={pin}
        onChange={onChange}
        disabled={busy || locked}
        leftSlot={biometricEnabled ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Entrar com biometria" onPress={tryBiometric} style={{ width: MIN_TOUCH + 20, height: MIN_TOUCH + 20, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="finger-print-outline" size={32} color={p.accent} />
          </Pressable>
        ) : undefined}
      />

      <Pressable accessibilityRole="button" accessibilityLabel="Esqueci meu PIN" onPress={() => { setForgot(true); setConfirmText(''); setResetError(null); }} style={{ minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' }}>
        <Txt variant="muted" style={{ textDecorationLine: 'underline' }}>Esqueci meu PIN</Txt>
      </Pressable>

      <Modal transparent visible={forgot} animationType="fade" onRequestClose={() => setForgot(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: space.xl }}>
          <View style={{ backgroundColor: p.surface, borderRadius: radius.lg, padding: space.xl, gap: space.md, borderWidth: 1, borderColor: p.border }} accessibilityViewIsModal>
            <Txt variant="heading">Esqueci meu PIN</Txt>
            <Txt variant="muted">
              Não existe recuperação de PIN: os dados só ficam neste aparelho. Para voltar a usar o app, é preciso apagar todos os dados e criar um novo perfil. Depois, se você tiver um backup, use Configurações &gt; Importar backup.
            </Txt>
            <Field label="Digite APAGAR para confirmar" value={confirmText} onChangeText={setConfirmText} autoCapitalize="characters" autoCorrect={false} />
            {resetError ? <Txt variant="muted" color={p.danger}>{resetError}</Txt> : null}
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button label="Cancelar" kind="secondary" onPress={() => setForgot(false)} style={{ flex: 1 }} />
              <Button label="Apagar tudo" kind="danger" onPress={doReset} disabled={confirmText.trim() !== 'APAGAR'} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
