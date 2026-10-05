import { MAX_BACKUP_CHARS, parseBackup, serializeBackup, type BackupData } from '../src/domain/backup';
import { SqlFinanceRepository } from '../src/data/sqlRepository';
import { createTestDriver } from './helpers/sqljsDriver';
import { txInput } from './helpers/factories';

const NOW = new Date('2026-09-30T01:30:00.000Z');

async function populatedRepo() {
  const driver = await createTestDriver();
  let n = 0;
  const repo = await SqlFinanceRepository.create(driver, { now: () => NOW, newId: () => `id-${++n}` });
  await repo.createTransaction(txInput({ amountCents: 123456, description: 'Aluguel; "com aspas"', categoryId: 'moradia' }));
  await repo.createTransaction(txInput({ type: 'income', categoryId: 'salario', amountCents: 500000, description: 'Salário' }));
  const inv = await repo.createInvestment({ name: 'CDB', type: 'cdb', investedAmountCents: 100000, marketValueCents: 105000, purchaseDate: '2026-06-01' });
  await repo.updateInvestment(inv.id, { name: 'CDB', type: 'cdb', investedAmountCents: 100000, marketValueCents: 107000, purchaseDate: '2026-06-01' });
  await repo.updateSettings({ theme: 'light', monthlyBudgetCents: 300000, currency: 'BRL' });
  return repo;
}

const valid = async (): Promise<Record<string, any>> => {
  const repo = await populatedRepo();
  return JSON.parse(serializeBackup(await repo.exportAll(), NOW.toISOString()));
};
const parse = (o: unknown) => parseBackup(JSON.stringify(o));
const paths = (r: ReturnType<typeof parseBackup>) => (r.ok ? [] : r.issues.map((i) => i.path));

describe('exportar -> importar', () => {
  test('ida e volta preserva tudo, inclusive o historico', async () => {
    const repo = await populatedRepo();
    const original: BackupData = await repo.exportAll();
    const text = serializeBackup(original, NOW.toISOString());
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.summary).toEqual({ exportedAt: NOW.toISOString(), transactionCount: 2, investmentCount: 1 });

    const fresh = await createTestDriver();
    const target = await SqlFinanceRepository.create(fresh);
    await target.replaceAll(parsed.data);
    const restored = await target.exportAll();
    expect(restored.transactions).toEqual(original.transactions);
    expect(restored.investments).toEqual(original.investments);
    expect(restored.investmentValueEntries).toEqual(original.investmentValueEntries);
    expect(restored.settings).toEqual(original.settings);
    expect(restored.investments[0]?.marketValueCents).toBe(107000);
    expect(restored.investmentValueEntries).toHaveLength(3);
  });

  test('tolera BOM no inicio do arquivo', async () => {
    const text = '\uFEFF' + JSON.stringify(await valid());
    expect(parseBackup(text).ok).toBe(true);
  });
});

describe('arquivos invalidos sao recusados por inteiro', () => {
  test('vazio, nao-JSON, outro app, versao nova/desconhecida, grande demais', async () => {
    expect(parseBackup('').ok).toBe(false);
    expect(parseBackup('{nao e json').ok).toBe(false);
    expect(parse({ app: 'outro', schemaVersion: 1 }).ok).toBe(false);
    expect(parse([1, 2]).ok).toBe(false);
    const newer = parse({ ...(await valid()), schemaVersion: 2 });
    expect(newer.ok).toBe(false);
    if (!newer.ok) expect(newer.issues[0]?.message).toMatch(/versão mais nova/);
    expect(parse({ ...(await valid()), schemaVersion: 'x' }).ok).toBe(false);
    expect(parseBackup('x'.repeat(MAX_BACKUP_CHARS + 1)).ok).toBe(false);
  });

  test('valor invalido, categoria do tipo errado e data impossivel apontam o item', async () => {
    const f = await valid();
    const expense = f.transactions.find((t: any) => t.type === 'expense');
    const income = f.transactions.find((t: any) => t.type === 'income');
    expense.amountCents = 0;
    income.categoryId = 'alimentacao'; // categoria de despesa numa receita
    income.date = '2026-02-30';
    const r = paths(parse(f));
    expect(r.some((p) => /^transactions\[\d+\]\.amount$/.test(p))).toBe(true);
    expect(r.some((p) => /^transactions\[\d+\]\.category$/.test(p))).toBe(true);
    expect(r.some((p) => /^transactions\[\d+\]\.date$/.test(p))).toBe(true);
  });

  test('centavos fracionarios / acima do teto', async () => {
    const f = await valid();
    f.transactions[0].amountCents = 10.5;
    f.transactions[1].amountCents = 100_000_000_001;
    expect(paths(parse(f))).toEqual(expect.arrayContaining(['transactions[0].amount', 'transactions[1].amount']));
  });

  test('ids repetidos', async () => {
    const f = await valid();
    f.transactions[1].id = f.transactions[0].id;
    expect(paths(parse(f))).toContain('transactions[1].id');
  });

  test('entrada apontando para ativo inexistente', async () => {
    const f = await valid();
    f.investmentValueEntries[0].investmentId = 'fantasma';
    expect(paths(parse(f))).toContain('investmentValueEntries[0].investmentId');
  });

  test('ativo sem historico', async () => {
    const f = await valid();
    f.investmentValueEntries = [];
    expect(parse(f).ok).toBe(false);
  });

  test('listas ausentes e configuracoes invalidas', async () => {
    const f = await valid();
    delete f.transactions;
    f.settings.theme = 'roxo';
    expect(paths(parse(f))).toEqual(expect.arrayContaining(['transactions', 'settings.theme']));
  });

  test('valor de mercado atual e recalculado do historico, nao confiado do arquivo', async () => {
    const f = await valid();
    f.investments[0].marketValueCents = 999_999;
    const r = parse(f);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.investments[0]?.marketValueCents).toBe(107000);
  });

  test('limita a quantidade de erros reportados', async () => {
    const f = await valid();
    f.transactions = Array.from({ length: 100 }, (_, i) => ({ ...f.transactions[0], id: `x${i}`, amountCents: 0 }));
    const r = parse(f);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.length).toBeLessThanOrEqual(20);
  });
});
