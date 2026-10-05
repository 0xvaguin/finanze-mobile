import { createHash } from 'crypto';
import { constantTimeEqual, hashPin, isLocked, lockoutSeconds, validateName, validatePin } from '../src/domain/pin';
import { createAuthService, type ProfileStorage } from '../src/services/authService';

describe('validatePin', () => {
  test.each(['482915', '102938', '135790', '909090'])('aceita %s', (p) => expect(validatePin(p).ok).toBe(true));
  test.each(['', '1234', '1234567', '12345a', '000000', '111111', '123456', '654321', '234567', '987654', ' 482915'])('recusa %j', (p) =>
    expect(validatePin(p).ok).toBe(false));
});

test('validateName', () => {
  expect(validateName('  Marina ').ok).toBe(true);
  expect(validateName('   ').ok).toBe(false);
  expect(validateName('a'.repeat(41)).ok).toBe(false);
});

test('bloqueio escalonado por falhas', () => {
  expect([0, 4, 5, 6, 7, 8, 20].map(lockoutSeconds)).toEqual([0, 0, 30, 60, 300, 900, 900]);
  expect(isLocked(null, 1000)).toBe(false);
  expect(isLocked(2000, 1000)).toBe(true);
  expect(isLocked(1000, 1000)).toBe(false);
});

test('constantTimeEqual', () => {
  expect(constantTimeEqual('abc', 'abc')).toBe(true);
  expect(constantTimeEqual('abc', 'abd')).toBe(false);
  expect(constantTimeEqual('abc', 'abcd')).toBe(false);
  expect(constantTimeEqual('', '')).toBe(true);
});

// ---- servico, com armazenamento em memoria e SHA-256 real do Node ----
const digest = async (s: string) => createHash('sha256').update(s).digest('hex');

function setup(startMs = 1_000_000) {
  let stored: string | null = null;
  let now = startMs;
  let n = 0;
  const storage: ProfileStorage = {
    get: async () => stored,
    set: async (v) => { stored = v; },
    remove: async () => { stored = null; },
  };
  const svc = createAuthService({ storage, digest, randomSalt: async () => `salt${++n}`, now: () => now });
  return { svc, advance: (ms: number) => { now += ms; }, raw: () => stored };
}

describe('authService', () => {
  test('cria perfil sem guardar o PIN em texto puro', async () => {
    const { svc, raw } = setup();
    expect(await svc.createProfile({ name: ' Marina  Souza ', pin: '482915', biometricEnabled: true })).toEqual({ ok: true });
    expect(raw()).not.toContain('482915');
    const p = await svc.getProfile();
    expect(p).toMatchObject({ name: 'Marina Souza', biometricEnabled: true, failedAttempts: 0, lockedUntil: null });
    expect(p?.pinHash).toBe(await hashPin('482915', p?.salt as string, digest));
  });

  test('recusa PIN fraco e nome vazio ao cadastrar', async () => {
    const { svc } = setup();
    expect((await svc.createProfile({ name: 'A', pin: '123456', biometricEnabled: false })).ok).toBe(false);
    expect((await svc.createProfile({ name: ' ', pin: '482915', biometricEnabled: false })).ok).toBe(false);
    expect(await svc.getProfile()).toBeNull();
  });

  test('PIN certo desbloqueia; sem perfil -> no_profile', async () => {
    const { svc } = setup();
    expect(await svc.verifyPin('482915')).toEqual({ ok: false, reason: 'no_profile' });
    await svc.createProfile({ name: 'M', pin: '482915', biometricEnabled: false });
    expect(await svc.verifyPin('482915')).toEqual({ ok: true });
  });

  test('5 erros bloqueiam por 30s, mesmo com o PIN certo; depois libera e zera', async () => {
    const { svc, advance } = setup();
    await svc.createProfile({ name: 'M', pin: '482915', biometricEnabled: false });
    for (let i = 1; i <= 4; i++) {
      expect(await svc.verifyPin('000001')).toMatchObject({ ok: false, reason: 'wrong', attemptsBeforeLock: 5 - i, lockedUntil: null });
    }
    const fifth = await svc.verifyPin('000001');
    expect(fifth).toMatchObject({ ok: false, reason: 'wrong', attemptsBeforeLock: 0 });
    expect(await svc.verifyPin('482915')).toMatchObject({ ok: false, reason: 'locked' });
    advance(29_000);
    expect(await svc.verifyPin('482915')).toMatchObject({ ok: false, reason: 'locked' });
    advance(2_000);
    expect(await svc.verifyPin('482915')).toEqual({ ok: true });
    expect((await svc.getProfile())?.failedAttempts).toBe(0);
  });

  test('a contagem de falhas persiste entre sessoes e o bloqueio escala', async () => {
    const { svc, advance } = setup();
    await svc.createProfile({ name: 'M', pin: '482915', biometricEnabled: false });
    for (let i = 0; i < 5; i++) await svc.verifyPin('111112');
    advance(31_000);
    const sixth = await svc.verifyPin('111112');
    expect(sixth).toMatchObject({ reason: 'wrong' });
    expect((await svc.getProfile())?.lockedUntil).toBe(1_000_000 + 31_000 + 60_000);
  });

  test('trocar PIN exige o atual; novo PIN fraco e recusado; antigo deixa de valer', async () => {
    const { svc } = setup();
    await svc.createProfile({ name: 'M', pin: '482915', biometricEnabled: false });
    expect(await svc.changePin('000001', '739104')).toMatchObject({ ok: false, reason: 'wrong' });
    expect(await svc.changePin('482915', '123456')).toMatchObject({ ok: false });
    expect(await svc.changePin('482915', '739104')).toEqual({ ok: true });
    expect(await svc.verifyPin('482915')).toMatchObject({ ok: false, reason: 'wrong' });
    expect(await svc.verifyPin('739104')).toEqual({ ok: true });
  });

  test('biometria liga/desliga; reset apaga o perfil; armazenamento corrompido = sem perfil', async () => {
    const { svc } = setup();
    await svc.createProfile({ name: 'M', pin: '482915', biometricEnabled: false });
    await svc.setBiometricEnabled(true);
    expect((await svc.getProfile())?.biometricEnabled).toBe(true);
    await svc.reset();
    expect(await svc.getProfile()).toBeNull();

    let junk: string | null = '{nao-json';
    const bad = createAuthService({
      storage: { get: async () => junk, set: async (v) => { junk = v; }, remove: async () => { junk = null; } },
      digest, randomSalt: async () => 's', now: () => 0,
    });
    expect(await bad.getProfile()).toBeNull();
  });
});
