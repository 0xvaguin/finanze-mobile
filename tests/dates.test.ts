import {
  addDays, addMonths, clampDayToMonth, maskDateBR, parseDateBR, currentMonth, formatDateBR, formatMonthLabel, isFutureDate,
  isValidDateString, isValidMonth, monthOf, monthRange, todayLocal, toLocalDateString,
} from '../src/domain/dates';

describe('fuso horario do teste', () => {
  test('roda em America/Sao_Paulo (UTC-3)', () => {
    expect(new Date(2026, 0, 15, 12).getTimezoneOffset()).toBe(180);
  });
});

describe('todayLocal (regra do fim do dia)', () => {
  test('22h30 local: "hoje" NAO vira o dia seguinte (toISOString viraria)', () => {
    const now = new Date('2026-09-30T01:30:00.000Z'); // = 29/09/2026 22:30 em -03:00
    expect(now.toISOString().slice(0, 10)).toBe('2026-09-30'); // o erro que evitamos
    expect(todayLocal(now)).toBe('2026-09-29');
  });

  test('ultimo dia do mes as 22h30 continua no mes certo', () => {
    const now = new Date('2026-10-01T01:30:00.000Z'); // 30/09 22:30 local
    expect(todayLocal(now)).toBe('2026-09-30');
    expect(currentMonth(now)).toBe('2026-09');
  });

  test('virada de ano', () => {
    const now = new Date('2027-01-01T02:00:00.000Z'); // 31/12/2026 23:00 local
    expect(todayLocal(now)).toBe('2026-12-31');
  });

  test('meia-noite local ja e o dia novo', () => {
    expect(toLocalDateString(new Date(2026, 8, 30, 0, 0, 0))).toBe('2026-09-30');
  });
});

describe('isValidDateString', () => {
  test.each(['2026-09-29', '2024-02-29', '2026-12-31', '2026-01-01'])('aceita %s', (d) => {
    expect(isValidDateString(d)).toBe(true);
  });
  test.each(['2026-02-30', '2025-02-29', '2026-13-01', '2026-00-10', '2026-09-00', '26-09-29', '2026/09/29', '', '2026-9-9', 20260929, null])(
    'rejeita %j',
    (d) => {
      expect(isValidDateString(d)).toBe(false);
    },
  );
});

describe('meses', () => {
  test('isValidMonth', () => {
    expect(isValidMonth('2026-09')).toBe(true);
    expect(isValidMonth('2026-13')).toBe(false);
    expect(isValidMonth('2026-9')).toBe(false);
  });
  test('addMonths cruza anos nos dois sentidos', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-09', 0)).toBe('2026-09');
    expect(addMonths('2026-03', -15)).toBe('2024-12');
    expect(addMonths('2026-03', 25)).toBe('2028-04');
  });
  test('monthRange e semiaberto e inclui o ultimo dia', () => {
    expect(monthRange('2026-09')).toEqual({ start: '2026-09-01', endExclusive: '2026-10-01' });
    expect(monthRange('2026-12')).toEqual({ start: '2026-12-01', endExclusive: '2027-01-01' });
    const { start, endExclusive } = monthRange('2026-09');
    expect('2026-09-30' >= start && '2026-09-30' < endExclusive).toBe(true);
    expect('2026-10-01' < endExclusive).toBe(false);
  });
  test('monthOf, isFutureDate e formatacao', () => {
    expect(monthOf('2026-09-29')).toBe('2026-09');
    expect(isFutureDate('2026-09-30', '2026-09-29')).toBe(true);
    expect(isFutureDate('2026-09-29', '2026-09-29')).toBe(false);
    expect(formatMonthLabel('2026-03')).toBe('março de 2026');
    expect(formatDateBR('2026-09-05')).toBe('05/09/2026');
  });
});

describe('clampDayToMonth', () => {
  test('mantem o dia ou limita ao ultimo dia do mes', () => {
    expect(clampDayToMonth('2026-08-15', '2026-09')).toBe('2026-09-15');
    expect(clampDayToMonth('2026-08-31', '2026-09')).toBe('2026-09-30');
    expect(clampDayToMonth('2026-01-31', '2026-02')).toBe('2026-02-28');
    expect(clampDayToMonth('2027-01-31', '2028-02')).toBe('2028-02-29');
  });
});

describe('data BR', () => {
  test('mascara', () => {
    expect(maskDateBR('2')).toBe('2');
    expect(maskDateBR('2909')).toBe('29/09');
    expect(maskDateBR('29092026')).toBe('29/09/2026');
    expect(maskDateBR('29/09/2026999')).toBe('29/09/2026');
    expect(maskDateBR('ab')).toBe('');
  });
  test('parse', () => {
    expect(parseDateBR('29/09/2026')).toBe('2026-09-29');
    expect(parseDateBR('30/02/2026')).toBeNull();
    expect(parseDateBR('29/09/26')).toBeNull();
    expect(parseDateBR('')).toBeNull();
  });
  test('addDays cruza mes e ano', () => {
    expect(addDays('2026-09-29', -1)).toBe('2026-09-28');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});
