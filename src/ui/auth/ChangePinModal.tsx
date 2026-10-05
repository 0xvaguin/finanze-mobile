import React, { useState } from 'react';
import { Modal, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PIN_LENGTH, validatePin } from '../../domain/pin';
import { authService } from '../../services/authRuntime';
import { Button, Txt } from '../components';
import { space } from '../theme';
import { useTheme } from '../ThemeProvider';
import { PinDots, PinPad } from './PinPad';

type Step = 'current' | 'new' | 'confirm';
const TITLES: Record<Step, string> = { current: 'Digite o PIN atual', new: 'Digite o novo PIN', confirm: 'Confirme o novo PIN' };

export function ChangePinModal({ visible, onClose, onChanged }: { visible: boolean; onClose: () => void; onChanged: () => void }) {
  const { p } = useTheme();
  const [step, setStep] = useState<Step>('current');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => { setStep('current'); setCurrent(''); setNext(''); setValue(''); setError(null); setBusy(false); };
  const close = () => { reset(); onClose(); };

  const onChange = async (v: string) => {
    setValue(v); setError(null);
    if (v.length !== PIN_LENGTH) return;
    if (step === 'current') { setCurrent(v); setValue(''); setStep('new'); return; }
    if (step === 'new') {
      const c = validatePin(v);
      if (!c.ok) { setError(c.message); setValue(''); return; }
      setNext(v); setValue(''); setStep('confirm'); return;
    }
    if (v !== next) { setError('Os PINs não conferem.'); setValue(''); setNext(''); setStep('new'); return; }
    setBusy(true);
    const r = await authService.changePin(current, next);
    setBusy(false);
    if (r.ok) { reset(); onChanged(); return; }
    setValue(''); setNext(''); setCurrent(''); setStep('current');
    if ('reason' in r && r.reason === 'locked') setError('Muitas tentativas. Aguarde alguns instantes e tente de novo.');
    else if ('reason' in r && r.reason === 'wrong') setError('PIN atual incorreto.');
    else setError('message' in r ? r.message : 'Não foi possível alterar o PIN.');
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={{ flex: 1, backgroundColor: p.bg, padding: space.xl, justifyContent: 'center', gap: space.xl }}>
        <Txt variant="title" accessibilityRole="header" style={{ textAlign: 'center' }}>{TITLES[step]}</Txt>
        <PinDots length={value.length} error={!!error} />
        <View style={{ minHeight: 24 }} accessibilityLiveRegion="polite">
          {error ? <Txt color={p.danger} style={{ textAlign: 'center' }}>{error}</Txt> : null}
        </View>
        <PinPad value={value} onChange={onChange} disabled={busy} />
        <Button label="Cancelar" kind="secondary" onPress={close} />
      </SafeAreaView>
    </Modal>
  );
}
