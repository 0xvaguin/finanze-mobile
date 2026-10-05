import { runMigrations, LATEST_SCHEMA_VERSION } from '../src/data/migrations';
import { RepositoryError } from '../src/data/repository';
import { SqlFinanceRepository } from '../src/data/sqlRepository';
import { createTestDriver, type TestDriver } from './helpers/sqljsDriver';
import { txInput } from './helpers/factories';

// 29/09/2026 22:30 local (-03:00) = 30/09 01:30 UTC
const NOW = new Date('2026-09-30T01:30:00.000Z');

async function setup() {
  const driver = await createTestDriver();
  let n = 0;
  const repo = await SqlFinanceRepository.create(driver, { now: () => NOW, newId: () => `id-${++n}` });
  return { driver, repo };
}

async function expectRepoError(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toBeInstanceOf(RepositoryError);
  await p.catch((e: RepositoryError) => expect(e.code).toBe(code));
}

describe('migracoes', () => {
  test('aplica e e idempotente', async () => {
    const driver = await createTestDriver();
    await runMigrations(driver);
    await runMigrations(driver);
    const rows = await driver.all<{ user_version: number }>('PRAGMA user_version');
    expect(rows[0]?.user_version).toBe(LATEST_SCHEMA_VERSION);
  });

  test('recusa banco de versao mais nova', async () => {
    const driver = await createTestDriver();
    await driver.exec(`PRAGMA user_version = ${LATEST_SCHEMA_VERSION + 1}`);
    await expect(runMigrations(driver)).rejects.toThrow(/mais nova/);
  });
});

describe('transacoes', () => {
  test('criar, listar por mes (inclui dia 1 e ultimo dia, exclui vizinhos) e ordenar', async () => {
    const { repo } = await setup();
    await repo.createTransaction(txInput({ date: '2026-08-31' }));
    await repo.createTransaction(txInput({ date: '2026-09-01', description: 'primeiro' }));
    await repo.createTransaction(txInput({ date: '2026-09-30', description: 'ultimo' }));
    await repo.createTransaction(txInput({ date: '2026-10-01' }));
    const sep = await repo.listTransactions('2026-09');
    expect(sep.map((t) => t.description)).toEqual(['ultimo', 'primeiro']);
    expect(await repo.listAllTransactions()).toHaveLength(4);
  });

  test('createdAt usa o relogio injetado; valores ficam em centavos inteiros', async () => {
    const { repo } = await setup();
    const t = await repo.createTransaction(txInput({ amountCents: 1999 }));
    expect(t.createdAt).toBe(NOW.toISOString());
    expect((await repo.listAllTransactions())[0]?.amountCents).toBe(1999);
  });

  test('editar preserva createdAt e marca updatedAt', async () => {
    const { repo } = await setup();
    const t = await repo.createTransaction(txInput());
    const u = await repo.updateTransaction(t.id, txInput({ amountCents: 4200, description: 'Editado' }));
    expect(u.createdAt).toBe(t.createdAt);
    expect(u.updatedAt).toBe(NOW.toISOString());
    const [row] = await repo.listAllTransactions();
    expect(row).toMatchObject({ amountCents: 4200, description: 'Editado' });
  });

  test('editar/excluir inexistente -> not_found', async () => {
    const { repo } = await setup();
    await expectRepoError(repo.updateTransaction('x', txInput()), 'not_found');
    await expectRepoError(repo.deleteTransaction('x'), 'not_found');
  });

  test('excluir remove', async () => {
    const { repo } = await setup();
    const t = await repo.createTransaction(txInput());
    await repo.deleteTransaction(t.id);
    expect(await repo.listAllTransactions()).toEqual([]);
  });

  test('entrada invalida -> validation com erros por campo, nada gravado', async () => {
    const { repo } = await setup();
    const p = repo.createTransaction(txInput({ amountCents: 0, description: '' }));
    await expectRepoError(p, 'validation');
    await p.catch((e: RepositoryError) => expect(Object.keys(e.fieldErrors ?? {}).sort()).toEqual(['amount', 'description']));
    expect(await repo.listAllTransactions()).toEqual([]);
  });

  test('mes invalido -> validation', async () => {
    const { repo } = await setup();
    await expectRepoError(repo.listTransactions('2026-13'), 'validation');
  });

  test('createTransactions e atomico: um invalido ou falha no meio nao grava nada', async () => {
    const { repo, driver } = await setup();
    const many = await repo.createTransactions([txInput({ description: 'a' }), txInput({ description: 'b' })]);
    expect(many).toHaveLength(2);
    await expectRepoError(repo.createTransactions([txInput(), txInput({ amountCents: 0 })]), 'validation');
    driver.failRunIn(1);
    await expectRepoError(repo.createTransactions([txInput(), txInput()]), 'storage');
    expect(await repo.listAllTransactions()).toHaveLength(2);
  });

  test('sugestoes de conta', async () => {
    const { repo } = await setup();
    await repo.createTransaction(txInput({ account: 'Nubank' }));
    await repo.createTransaction(txInput({ account: 'nubank' }));
    await repo.createTransaction(txInput({ account: 'Dinheiro' }));
    expect(await repo.listAccountSuggestions()).toEqual(['Nubank', 'Dinheiro']);
  });

  test('falha do banco vira RepositoryError storage (sem vazar detalhes)', async () => {
    const { repo, driver } = await setup();
    driver.failRunIn(0);
    const p = repo.createTransaction(txInput());
    await expectRepoError(p, 'storage');
    await p.catch((e: RepositoryError) => expect(e.message).not.toMatch(/injetada/));
  });
});

describe('investimentos e historico', () => {
  const input = { name: 'CDB Banco X', type: 'cdb' as const, investedAmountCents: 100000, purchaseDate: '2026-06-15' };

  test('criar sem valor de mercado: 1 entrada na data da aplicacao', async () => {
    const { repo } = await setup();
    const inv = await repo.createInvestment(input);
    expect(inv).toMatchObject({ marketValueCents: 100000, marketValueUpdatedAt: '2026-06-15', quoteStatus: 'manual' });
    const entries = await repo.listInvestmentValueEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ investmentId: inv.id, marketValueCents: 100000, recordedAt: '2026-06-15' });
  });

  test('criar com valor de mercado diferente: 2 entradas (aplicacao e hoje local)', async () => {
    const { repo } = await setup();
    const inv = await repo.createInvestment({ ...input, marketValueCents: 108000 });
    expect(inv.marketValueUpdatedAt).toBe('2026-09-29'); // dia local, nao o UTC (30/09)
    const entries = await repo.listInvestmentValueEntries();
    expect(entries.map((e) => [e.recordedAt, e.marketValueCents])).toEqual([
      ['2026-06-15', 100000],
      ['2026-09-29', 108000],
    ]);
  });

  test('atualizar valor de mercado: nova entrada e marketValueUpdatedAt; sem mudanca, sem entrada', async () => {
    const { repo } = await setup();
    const inv = await repo.createInvestment(input);
    const same = await repo.updateInvestment(inv.id, { ...input, name: 'CDB Renomeado', marketValueCents: 100000 });
    expect(same.name).toBe('CDB Renomeado');
    expect(await repo.listInvestmentValueEntries()).toHaveLength(1);

    const up = await repo.updateInvestment(inv.id, { ...input, marketValueCents: 110000 });
    expect(up).toMatchObject({ marketValueCents: 110000, marketValueUpdatedAt: '2026-09-29' });
    expect(await repo.listInvestmentValueEntries()).toHaveLength(2);
    expect((await repo.listInvestments())[0]?.marketValueCents).toBe(110000);
  });

  test('excluir ativo apaga suas entradas; inexistente -> not_found', async () => {
    const { repo } = await setup();
    const a = await repo.createInvestment(input);
    const b = await repo.createInvestment({ ...input, name: 'Outro' });
    await repo.deleteInvestment(a.id);
    expect((await repo.listInvestments()).map((i) => i.id)).toEqual([b.id]);
    expect((await repo.listInvestmentValueEntries()).every((e) => e.investmentId === b.id)).toBe(true);
    await expectRepoError(repo.deleteInvestment('x'), 'not_found');
    await expectRepoError(repo.updateInvestment('x', { ...input, marketValueCents: 1 }), 'not_found');
  });

  test('falha no meio da criacao nao deixa ativo pela metade', async () => {
    const { repo, driver } = await setup();
    driver.failRunIn(1); // INSERT do ativo passa, INSERT da entrada falha
    await expectRepoError(repo.createInvestment(input), 'storage');
    expect(await repo.listInvestments()).toEqual([]);
    expect(await repo.listInvestmentValueEntries()).toEqual([]);
  });
});

describe('configuracoes e backup', () => {
  test('padroes, atualizacao e validacao', async () => {
    const { repo } = await setup();
    expect(await repo.getSettings()).toEqual({ theme: 'dark', monthlyBudgetCents: 0, currency: 'BRL' });
    await repo.updateSettings({ theme: 'light', monthlyBudgetCents: 350000, currency: 'BRL' });
    expect(await repo.getSettings()).toMatchObject({ theme: 'light', monthlyBudgetCents: 350000 });
    await expectRepoError(repo.updateSettings({ theme: 'dark', monthlyBudgetCents: -5, currency: 'BRL' }), 'validation');
  });

  test('ultimo backup: nunca -> data', async () => {
    const { repo } = await setup();
    expect(await repo.getLastBackupAt()).toBeNull();
    await repo.setLastBackupAt('2026-09-12T10:00:00.000Z');
    expect(await repo.getLastBackupAt()).toBe('2026-09-12T10:00:00.000Z');
  });

  test('limpar tudo apaga dados e configuracoes', async () => {
    const { repo } = await setup();
    await repo.createTransaction(txInput());
    await repo.createInvestment({ name: 'X', type: 'cdb', investedAmountCents: 100, purchaseDate: '2026-01-01' });
    await repo.updateSettings({ theme: 'light', monthlyBudgetCents: 100, currency: 'BRL' });
    await repo.clearAllData();
    expect(await repo.listAllTransactions()).toEqual([]);
    expect(await repo.listInvestments()).toEqual([]);
    expect(await repo.listInvestmentValueEntries()).toEqual([]);
    expect(await repo.getSettings()).toMatchObject({ theme: 'dark', monthlyBudgetCents: 0 });
  });

  test('replaceAll e atomico: falha no meio preserva os dados atuais', async () => {
    const source = await setup();
    await source.repo.createTransaction(txInput({ description: 'do backup 1' }));
    await source.repo.createTransaction(txInput({ description: 'do backup 2' }));
    const data = await source.repo.exportAll();

    const target = await setup();
    await target.repo.createTransaction(txInput({ description: 'dado atual' }));
    target.driver.failRunIn(5); // falha depois de apagar e inserir parte
    await expectRepoError(target.repo.replaceAll(data), 'storage');
    const after = await target.repo.listAllTransactions();
    expect(after.map((t) => t.description)).toEqual(['dado atual']);
  });
});
