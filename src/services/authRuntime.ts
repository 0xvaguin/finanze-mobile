import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { createAuthService } from './authService';

const KEY = 'finanze_profile_v1';
// Fica no chaveiro do aparelho, so acessivel com o aparelho desbloqueado e fora de backups/migracoes.
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export const authService = createAuthService({
  storage: {
    get: () => SecureStore.getItemAsync(KEY, OPTIONS),
    set: (v) => SecureStore.setItemAsync(KEY, v, OPTIONS),
    remove: () => SecureStore.deleteItemAsync(KEY, OPTIONS),
  },
  digest: (s) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, s),
  randomSalt: async () => {
    const bytes = await Crypto.getRandomBytesAsync(16);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  },
  now: () => Date.now(),
});

export async function biometricAvailable(): Promise<boolean> {
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

/** true = autenticou. O PIN do aparelho NAO substitui a biometria aqui; o fallback e o PIN do Finanze. */
export async function authenticateBiometric(promptMessage: string): Promise<boolean> {
  try {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage, cancelLabel: 'Usar PIN', disableDeviceFallback: true });
    return r.success;
  } catch {
    return false;
  }
}
