import {
  LOCK_AFTER_FAILURES, constantTimeEqual, hashPin, isLocked, lockoutSeconds, validateName, validatePin, type Digest,
} from '../domain/pin';

export interface Profile {
  name: string;
  salt: string;
  pinHash: string;
  biometricEnabled: boolean;
  failedAttempts: number;
  /** epoch ms; null = sem bloqueio */
  lockedUntil: number | null;
  createdAt: string;
}

export interface ProfileStorage {
  get(): Promise<string | null>;
  set(value: string): Promise<void>;
  remove(): Promise<void>;
}

export interface AuthDeps {
  storage: ProfileStorage;
  digest: Digest;
  randomSalt: () => Promise<string>;
  now: () => number;
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: 'no_profile' }
  | { ok: false; reason: 'locked'; lockedUntil: number }
  | { ok: false; reason: 'wrong'; attemptsBeforeLock: number; lockedUntil: number | null };

export type ActionResult = { ok: true } | { ok: false; message: string };

export function createAuthService(deps: AuthDeps) {
  const read = async (): Promise<Profile | null> => {
    const raw = await deps.storage.get();
    if (!raw) return null;
    try {
      const p = JSON.parse(raw) as Profile;
      return typeof p.name === 'string' && typeof p.pinHash === 'string' && typeof p.salt === 'string' ? p : null;
    } catch {
      return null;
    }
  };
  const write = (p: Profile) => deps.storage.set(JSON.stringify(p));

  async function verifyPin(pin: string): Promise<VerifyResult> {
    const p = await read();
    if (!p) return { ok: false, reason: 'no_profile' };
    const now = deps.now();
    if (isLocked(p.lockedUntil, now)) return { ok: false, reason: 'locked', lockedUntil: p.lockedUntil as number };

    const matches = constantTimeEqual(await hashPin(pin, p.salt, deps.digest), p.pinHash);
    if (matches) {
      if (p.failedAttempts !== 0 || p.lockedUntil !== null) await write({ ...p, failedAttempts: 0, lockedUntil: null });
      return { ok: true };
    }
    const failed = p.failedAttempts + 1;
    const secs = lockoutSeconds(failed);
    const lockedUntil = secs > 0 ? now + secs * 1000 : null;
    await write({ ...p, failedAttempts: failed, lockedUntil });
    return { ok: false, reason: 'wrong', attemptsBeforeLock: Math.max(0, LOCK_AFTER_FAILURES - failed), lockedUntil };
  }

  return {
    getProfile: read,

    async createProfile(input: { name: string; pin: string; biometricEnabled: boolean }): Promise<ActionResult> {
      const n = validateName(input.name);
      if (!n.ok) return n;
      const v = validatePin(input.pin);
      if (!v.ok) return v;
      const salt = await deps.randomSalt();
      await write({
        name: input.name.trim().replace(/\s+/g, ' '),
        salt,
        pinHash: await hashPin(input.pin, salt, deps.digest),
        biometricEnabled: input.biometricEnabled,
        failedAttempts: 0,
        lockedUntil: null,
        createdAt: new Date(deps.now()).toISOString(),
      });
      return { ok: true };
    },

    verifyPin,

    /** Exige o PIN atual (que tambem conta tentativas e respeita o bloqueio). */
    async changePin(currentPin: string, newPin: string): Promise<ActionResult | VerifyResult> {
      const v = validatePin(newPin);
      if (!v.ok) return v;
      const check = await verifyPin(currentPin);
      if (!check.ok) return check;
      const p = (await read()) as Profile;
      const salt = await deps.randomSalt();
      await write({ ...p, salt, pinHash: await hashPin(newPin, salt, deps.digest) });
      return { ok: true };
    },

    async setBiometricEnabled(enabled: boolean): Promise<void> {
      const p = await read();
      if (p) await write({ ...p, biometricEnabled: enabled });
    },

    /** Apaga o perfil (usado em "Esqueci meu PIN", junto com a limpeza dos dados). */
    reset: () => deps.storage.remove(),
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
