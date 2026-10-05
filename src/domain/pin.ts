export const PIN_LENGTH = 6;
export const LOCK_AFTER_FAILURES = 5;
export const NAME_MAX = 40;

export type Check = { ok: true } | { ok: false; message: string };

/** PIN de exatamente 6 digitos, sem repeticao total (000000) nem sequencia (123456 / 654321). */
export function validatePin(pin: string): Check {
  if (!new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin)) return { ok: false, message: `O PIN deve ter ${PIN_LENGTH} dígitos.` };
  const d = pin.split('').map(Number);
  if (d.every((x) => x === d[0])) return { ok: false, message: 'Evite repetir o mesmo dígito.' };
  const step = (d[1] as number) - (d[0] as number);
  if ((step === 1 || step === -1) && d.every((x, i) => i === 0 || x - (d[i - 1] as number) === step)) {
    return { ok: false, message: 'Evite sequências como 123456.' };
  }
  return { ok: true };
}

export function validateName(name: string): Check {
  const t = name.trim();
  if (t.length === 0) return { ok: false, message: 'Informe seu nome.' };
  if (t.length > NAME_MAX) return { ok: false, message: `Use até ${NAME_MAX} caracteres.` };
  return { ok: true };
}

/** Segundos de bloqueio apos N falhas seguidas: 5->30s, 6->60s, 7->5min, 8+->15min. */
export function lockoutSeconds(failedAttempts: number): number {
  if (failedAttempts < LOCK_AFTER_FAILURES) return 0;
  if (failedAttempts === 5) return 30;
  if (failedAttempts === 6) return 60;
  if (failedAttempts === 7) return 300;
  return 900;
}

export function isLocked(lockedUntilMs: number | null, nowMs: number): boolean {
  return lockedUntilMs !== null && lockedUntilMs > nowMs;
}

/** Comparacao em tempo constante (evita vazar, pelo tempo, quantos caracteres batem). */
export function constantTimeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export type Digest = (input: string) => Promise<string>;

export async function hashPin(pin: string, salt: string, digest: Digest): Promise<string> {
  return digest(`finanze:v1:${salt}:${pin}`);
}
