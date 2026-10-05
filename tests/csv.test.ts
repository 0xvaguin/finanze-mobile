import { CSV_BOM, escapeCsvField, neutralizeFormula, transactionsToCsv } from '../src/domain/csv';
import { tx } from './helpers/factories';

describe('CSV', () => {
  test('BOM, cabecalho, separador ; e valor com virgula', () => {
    const csv = transactionsToCsv([
      tx({ date: '2026-09-10', amountCents: 123456, description: 'Almoço', account: 'Nubank', categoryId: 'alimentacao' }),
    ]);
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    const lines = csv.replace(CSV_BOM, '').split('\r\n');
    expect(lines[0]).toBe('data;tipo;valor;categoria;conta;descrição');
    expect(lines[1]).toBe('2026-09-10;Despesa;1234,56;Alimentação;Nubank;Almoço');
    expect(lines[2]).toBe('');
  });

  test('receita, ordem cronologica', () => {
    const csv = transactionsToCsv([
      tx({ date: '2026-09-20', type: 'income', categoryId: 'salario', amountCents: 500000 }),
      tx({ date: '2026-09-02' }),
    ]);
    const lines = csv.replace(CSV_BOM, '').split('\r\n');
    expect(lines[1]?.startsWith('2026-09-02')).toBe(true);
    expect(lines[2]).toContain('Receita;5000,00;Salário');
  });

  test.each(['=1+1', '+SOMA(A1)', '-2+3', '@cmd', '\tx'])('neutraliza formula %j', (v) => {
    expect(neutralizeFormula(v)).toBe(`'${v}`);
    const csv = transactionsToCsv([tx({ description: v })]);
    expect(csv).toContain(`'${v.replace(/"/g, '""')}`);
  });

  test('texto normal nao e alterado', () => {
    expect(neutralizeFormula('Mercado')).toBe('Mercado');
    expect(neutralizeFormula('10% de desconto')).toBe('10% de desconto');
  });

  test('escapa ponto e virgula, aspas e quebra de linha', () => {
    expect(escapeCsvField('a;b')).toBe('"a;b"');
    expect(escapeCsvField('diz "oi"')).toBe('"diz ""oi"""');
    expect(escapeCsvField('l1\nl2')).toBe('"l1\nl2"');
    expect(escapeCsvField('simples')).toBe('simples');
  });

  test('sem lancamentos: so cabecalho', () => {
    expect(transactionsToCsv([]).replace(CSV_BOM, '')).toBe('data;tipo;valor;categoria;conta;descrição\r\n');
  });
});
