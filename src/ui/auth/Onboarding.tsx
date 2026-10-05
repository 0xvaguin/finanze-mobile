import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PIN_LENGTH, validateName, validatePin } from '../../domain/pin';
import { authenticateBiometric, authService, biometricAvailable } from '../../services/authRuntime';
import { Button, Field, Txt } from '../components';
import { space } from '../theme';
import { useTheme } from '../ThemeProvider';
import { PinDots, PinPad } from './PinPad';

type Step = 'name' | 'pin' | 'confirm' | 'bio';

export function Onboarding({ onDone }: { onDone: () => Promise<void> }) {
  const { p } = useTheme();
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { biometricAvailable().then(setBioAvailable); }, []);

  const finish = async (biometricEnabled: boolean) => {
    setBusy(true);
    const r = await authService.createProfile({ name, pin, biometricEnabled });
    if (!r.ok) { setError(r.message); setBusy(false); return; }
    await onDone();
  };

  const nextFromName = () => {
    const v = validateName(name);
    if (!v.ok) { setError(v.message); return; }
    setError(null); setStep('pin');
  };

  const onPin = (v: string) => {
    setPin(v); setError(null);
    if (v.length === PIN_LENGTH) {
      const c = validatePin(v);
      if (!c.ok) { setError(c.message); setPin(''); return; }
      setStep('confirm');
    }
  };

  const onConfirm = (v: string) => {
    setConfirm(v); setError(null);
    if (v.length === PIN_LENGTH) {
      if (v !== pin) { setError('Os PINs não conferem. Tente de novo.'); setConfirm(''); setPin(''); setStep('pin'); return; }
      if (bioAvailable) setStep('bio'); else finish(false);
    }
  };

  const enableBio = async () => {
    if (await authenticateBiometric('Confirme para ativar a biometria')) await finish(true);
    else setError('Não foi possível confirmar a biometria. Você pode ativá-la depois em Configurações.');
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: space.xl, gap: space.xl, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
          {step === 'name' && (
            <>
              <View style={{ alignItems: 'center', gap: space.md }}>
                <Ionicons name="wallet-outline" size={56} color={p.accent} />
                <Txt variant="title" accessibilityRole="header">Bem-vindo ao Finanze</Txt>
                <Txt variant="muted" style={{ textAlign: 'center' }}>
                  Suas finanças ficam só neste aparelho. Crie seu perfil e um PIN para proteger o acesso ao app.
                </Txt>
              </View>
              <Field label="Como podemos te chamar?" value={name} onChangeText={(t) => { setName(t); setError(null); }} maxLength={40} autoFocus autoCapitalize="words" returnKeyType="next" onSubmitEditing={nextFromName} error={error ?? undefined} />
              <Button label="Continuar" onPress={nextFromName} />
            </>
          )}

          {(step === 'pin' || step === 'confirm') && (
            <>
              <View style={{ alignItems: 'center', gap: space.sm }}>
                <Txt variant="title" accessibilityRole="header">{step === 'pin' ? 'Crie seu PIN' : 'Confirme seu PIN'}</Txt>
                <Txt variant="muted" style={{ textAlign: 'center' }}>
                  {step === 'pin' ? `${PIN_LENGTH} dígitos, sem repetir nem usar sequência.` : 'Digite o mesmo PIN novamente.'}
                </Txt>
              </View>
              <PinDots length={(step === 'pin' ? pin : confirm).length} error={!!error} />
              {error ? <Txt color={p.danger} style={{ textAlign: 'center' }} accessibilityLiveRegion="polite">{error}</Txt> : null}
              <PinPad value={step === 'pin' ? pin : confirm} onChange={step === 'pin' ? onPin : onConfirm} disabled={busy} />
            </>
          )}

          {step === 'bio' && (
            <>
              <View style={{ alignItems: 'center', gap: space.md }}>
                <Ionicons name="finger-print-outline" size={56} color={p.accent} />
                <Txt variant="title" accessibilityRole="header">Entrar com biometria?</Txt>
                <Txt variant="muted" style={{ textAlign: 'center' }}>Use sua digital ou rosto para abrir o app. O PIN continua como alternativa.</Txt>
              </View>
              {error ? <Txt color={p.danger} style={{ textAlign: 'center' }}>{error}</Txt> : null}
              <Button label="Ativar biometria" onPress={enableBio} disabled={busy} />
              <Button label="Agora não" kind="secondary" onPress={() => finish(false)} disabled={busy} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
