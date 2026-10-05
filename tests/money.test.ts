import { MAX_CENTS, formatBRL, formatDecimalBR, isValidCents, parseBRL, parsePercentBR } from '../src/domain/money';

describe('parseBRL', () => {
  test.each([
    ['1.234,56', 123456],
    ['1234,56', 123456],
    ['1234,5', 123450],
    ['0,99', 99],
    ['10', 1000],
    ['R$ 10', 1000],
    ['R$ 1.000,00', 100000],
    ['1.234', 123400],
    ['12.50', 1250],
    ['1.234.567,89', 123456789],
    ['  7,05  ', 705],
    ['0', 0],
    ['000,10', 10],
  ])('interpreta %j como %d centavos', (text, cents) => {
    expect(parseBRL(text)).toBe(cents);
  });

  test.each(['', '   ', 'abc', '-5', '1,234', '1,2,3', '1..2', '12,', ',50', '1.23.456', 'R$', '1e5', '99999999999999999999'])(
    'rejeita %j',
    (text) => {
      expect(parseBRL(text)).toBeNull();
    },
  );

  test('nao sofre erro de ponto flutuante', () => {
    // 0,10 + 0,20 em float dá 0.30000000000000004; em centavos é exato.
    expect((parseBRL('0,10') as number) + (parseBRL('0,20') as number)).toBe(30);
    expect(parseBRL('19,99')).toBe(1999);
    expect(parseBRL('1.005,15')).toBe(100515);
  });
});

describe('formatBRL', () => {
  test.each([
    [0, 'R$ 0,00'],
    [5, 'R$ 0,05'],
    [123456, 'R$ 1.234,56'],
    [100000000000, 'R$ 1.000.000.000,00'],
    [-2550, '-R$ 25,50'],
  ])('%d -> %s', (cents, text) => {
    expect(formatBRL(cents)).toBe(text);
  });

  test('formatDecimalBR (CSV)', () => {
    expect(formatDecimalBR(123456)).toBe('1234,56');
    expect(formatDecimalBR(7)).toBe('0,07');
  });

  test('ida e volta', () => {
    for (const cents of [1, 99, 100, 123456, 100000000000]) {
      expect(parseBRL(formatBRL(cents))).toBe(cents);
    }
  });
});

describe('isValidCents', () => {
  test('limites', () => {
    expect(isValidCents(1)).toBe(true);
    expect(isValidCents(MAX_CENTS)).toBe(true);
    expect(isValidCents(MAX_CENTS + 1)).toBe(false);
    expect(isValidCents(0)).toBe(false);
    expect(isValidCents(0, { allowZero: true })).toBe(true);
    expect(isValidCents(-1)).toBe(false);
    expect(isValidCents(1.5)).toBe(false);
    expect(isValidCents(NaN)).toBe(false);
    expect(isValidCents(Infinity)).toBe(false);
    expect(isValidCents('10')).toBe(false);
  });
});

describe('parsePercentBR', () => {
  test.each([['12', 12], ['12,5', 12.5], ['12.5', 12.5], ['0', 0], [' 8,75 % ', 8.75]])('%j -> %d', (t, n) => {
    expect(parsePercentBR(t)).toBe(n);
  });
  test.each(['', 'abc', '-1', '1,2,3', '1e3', '12,12345'])('rejeita %j', (t) => {
    expect(parsePercentBR(t)).toBeNull();
  });
});
