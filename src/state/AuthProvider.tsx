import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Platform, View } from 'react-native';
import { authService } from '../services/authRuntime';
import type { Profile } from '../services/authService';
import { LockScreen } from '../ui/auth/LockScreen';
import { Onboarding } from '../ui/auth/Onboarding';
import { useTheme } from '../ui/ThemeProvider';

type Phase = 'loading' | 'onboarding' | 'locked' | 'unlocked';
/** Tempo em segundo plano ate o app voltar bloqueado. */
export const RELOCK_AFTER_MS = 60_000;

interface AuthState {
  /** false na Web: sem chaveiro/biometria, o app abre direto. */
  supported: boolean;
  name: string;
  biometricEnabled: boolean;
  lock: () => void;
  reloadProfile: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);
export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth fora do AuthProvider');
  return v;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supported = Platform.OS !== 'web';
  const { p } = useTheme();
  const [phase, setPhase] = useState<Phase>(supported ? 'loading' : 'unlocked');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [obscured, setObscured] = useState(false);
  const backgroundAt = useRef<number | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const reloadProfile = useCallback(async () => setProfile(await authService.getProfile()), []);

  useEffect(() => {
    if (!supported) return;
    let alive = true;
    authService.getProfile().then((pr) => {
      if (!alive) return;
      setProfile(pr);
      setPhase(pr ? 'locked' : 'onboarding');
    }).catch(() => alive && setPhase('onboarding'));
    return () => { alive = false; };
  }, [supported]);

  // Esconde o conteudo no seletor de apps e bloqueia depois de 1 min em segundo plano.
  useEffect(() => {
    if (!supported) return;
    const sub = AppState.addEventListener('change', (state) => {
      setObscured(state !== 'active');
      if (state === 'background') backgroundAt.current = Date.now();
      if (state === 'active') {
        if (backgroundAt.current !== null && Date.now() - backgroundAt.current >= RELOCK_AFTER_MS && phaseRef.current === 'unlocked') {
          setPhase('locked');
        }
        backgroundAt.current = null;
      }
    });
    return () => sub.remove();
  }, [supported]);

  const value = useMemo<AuthState>(() => ({
    supported,
    name: profile?.name ?? '',
    biometricEnabled: profile?.biometricEnabled ?? false,
    lock: () => { if (profile) setPhase('locked'); },
    reloadProfile,
  }), [supported, profile, reloadProfile]);

  const gated = phase !== 'unlocked';
  return (
    <Ctx.Provider value={value}>
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1 }} importantForAccessibility={gated ? 'no-hide-descendants' : 'auto'} accessibilityElementsHidden={gated}>
          {children}
        </View>
        {phase === 'onboarding' && (
          <Overlay><Onboarding onDone={async () => { await reloadProfile(); setPhase('unlocked'); }} /></Overlay>
        )}
        {phase === 'locked' && profile && (
          <Overlay>
            <LockScreen
              name={profile.name}
              biometricEnabled={profile.biometricEnabled}
              onUnlocked={() => setPhase('unlocked')}
              onReset={() => { setProfile(null); setPhase('onboarding'); AccessibilityInfo.announceForAccessibility('Dados apagados. Crie um novo perfil.'); }}
            />
          </Overlay>
        )}
        {(phase === 'loading' || obscured) && <Overlay><View style={{ flex: 1, backgroundColor: p.bg }} /></Overlay>}
      </View>
    </Ctx.Provider>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  const { p } = useTheme();
  return <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: p.bg, zIndex: 1000 }}>{children}</View>;
}
