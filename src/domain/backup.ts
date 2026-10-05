import { isValidDateString } from './dates';
import { isValidCents } from './money';
import type {
  AppSettings,
  Investment,
  InvestmentValueEntry,
  Transaction,
} from './types';
import {
  validateInvestmentInput,
  validateSettings,
  validateTransactionInput,
} from './validation';

export const BACKUP_APP = 'finanze';
export const BACKUP_SCHEMA_VERSION = 1;
export const MAX_BACKUP_CHARS = 25_000_000;
export const MAX_ITEMS = 200_000;
const MAX_ERRORS_REPORTED = 20;

export interface BackupData {
  settings: AppSettings;
  transactions: Transaction[];
  investments: Investment[];
  investmentValueEntries: InvestmentValueEntry[];
}

export interface BackupFile extends BackupData {
  app: typeof BACKUP_APP;
  schemaVersion: number;
  exportedAt: string;
}

export interface BackupSummary {
  exportedAt: string;
  transactionCount: number;
  investmentCount: number;
}

export interface BackupIssue {
  path: string;
  message: string;
}

export type ParseBackupResult =
  | { ok: true; data: BackupData; summary: BackupSummary }
  | { ok: false; issues: BackupIssue[] };

export function buildBackupFile(data: BackupData, exportedAtIso: string): BackupFile {
  return { app: BACKUP_APP, schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: exportedAtIso, ...data };
}

export function serializeBackup(data: BackupData, exportedAtIso: string): string {
  return JSON.stringify(buildBackupFile(data, exportedAtIso), null, 2);
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isIso = (v: unknown): v is string =>
  typeof v === 'string' && v.length <= 40 && !Number.isNaN(Date.parse(v));

const nonEmptyId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 100;

/**
 * Valida o arquivo INTEIRO antes de qualquer gravacao. Entrada externa nao
 * confiavel: nada e aproveitado sem passar pelas mesmas regras do formulario.
 * Valores derivados (valor de mercado atual) sao recalculados a partir do historico.
 */
export function parseBackup(text: string): ParseBackupResult {
  const issues: BackupIssue[] = [];
  const add = (path: string, message: string) => {
    if (issues.length < MAX_ERRORS_REPORTED) issues.push({ path, message });
  };
  const fail = (): ParseBackupResult => ({ ok: false, issues });

  if (typeof text !== 'string' || text.length === 0) {
    add('arquivo', 'O arquivo está vazio.');
    return fail();
  }
  if (text.length > MAX_BACKUP_CHARS) {
    add('arquivo', 'O arquivo é grande demais para ser importado.');
    return fail();
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    add('arquivo', 'O arquivo não é um JSON válido.');
    return fail();
  }
  if (!isRecord(raw) || raw.app !== BACKUP_APP) {
    add('arquivo', 'Este arquivo não parece ser um backup do Finanze.');
    return fail();
  }
  if (raw.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    add(
      'schemaVersion',
      typeof raw.schemaVersion === 'number' && raw.schemaVersion > BACKUP_SCHEMA_VERSION
        ? 'Este backup foi criado por uma versão mais nova do app. Atualize o Finanze para importá-lo.'
        : 'Versão do backup não reconhecida.',
    );
    return fail();
  }
  if (!isIso(raw.exportedAt)) add('exportedAt', 'Data de exportação inválida.');

  const settingsResult = isRecord(raw.settings) ? validateSettings(raw.settings) : null;
  if (!settingsResult) add('settings', 'Configurações ausentes.');
  else if (!settingsResult.ok) {
    for (const [k, m] of Object.entries(settingsResult.errors)) add(`settings.${k}`, m as string);
  }

  for (const key of ['transactions', 'investments', 'investmentValueEntries'] as const) {
    const v = raw[key];
    if (!Array.isArray(v)) add(key, 'Lista ausente ou inválida.');
    else if (v.length > MAX_ITEMS) add(key, 'Itens demais no arquivo.');
  }
  if (issues.length > 0) return fail();

  const transactions: Transaction[] = [];
  const seenTx = new Set<string>();
  (raw.transactions as unknown[]).forEach((item, idx) => {
    const path = `transactions[${idx}]`;
    if (!isRecord(item)) return add(path, 'Item inválido.');
    if (!nonEmptyId(item.id)) add(`${path}.id`, 'Identificador inválido.');
    else if (seenTx.has(item.id)) add(`${path}.id`, 'Identificador repetido.');
    else seenTx.add(item.id);
    if (!isIso(item.createdAt)) add(`${path}.createdAt`, 'Data de criação inválida.');
    if (item.updatedAt !== undefined && !isIso(item.updatedAt)) add(`${path}.updatedAt`, 'Data de atualização inválida.');
    const v = validateTransactionInput(item);
    if (!v.ok) {
      for (const [k, m] of Object.entries(v.errors)) add(`${path}.${k}`, m as string);
      return;
    }
    if (issues.length === 0) {
      const t: Transaction = { id: item.id as string, ...v.value, createdAt: item.createdAt as string };
      if (typeof item.updatedAt === 'string') t.updatedAt = item.updatedAt;
      transactions.push(t);
    }
  });

  const investmentsBase: Omit<Investment, 'marketValueCents' | 'marketValueUpdatedAt'>[] = [];
  const seenInv = new Set<string>();
  (raw.investments as unknown[]).forEach((item, idx) => {
    const path = `investments[${idx}]`;
    if (!isRecord(item)) return add(path, 'Item inválido.');
    if (!nonEmptyId(item.id)) add(`${path}.id`, 'Identificador inválido.');
    else if (seenInv.has(item.id)) add(`${path}.id`, 'Identificador repetido.');
    else seenInv.add(item.id);
    if (!isIso(item.createdAt)) add(`${path}.createdAt`, 'Data de criação inválida.');
    const v = validateInvestmentInput({ ...item, marketValueCents: undefined });
    if (!v.ok) {
      for (const [k, m] of Object.entries(v.errors)) add(`${path}.${k}`, m as string);
      return;
    }
    if (issues.length === 0) {
      const { marketValueCents: _ignored, ...rest } = v.value;
      investmentsBase.push({
        id: item.id as string,
        ...rest,
        quoteStatus: 'manual',
        createdAt: item.createdAt as string,
      });
    }
  });

  const entries: InvestmentValueEntry[] = [];
  const seenEntry = new Set<string>();
  (raw.investmentValueEntries as unknown[]).forEach((item, idx) => {
    const path = `investmentValueEntries[${idx}]`;
    if (!isRecord(item)) return add(path, 'Item inválido.');
    if (!nonEmptyId(item.id)) add(`${path}.id`, 'Identificador inválido.');
    else if (seenEntry.has(item.id)) add(`${path}.id`, 'Identificador repetido.');
    else seenEntry.add(item.id);
    if (!nonEmptyId(item.investmentId) || !seenInv.has(item.investmentId)) {
      add(`${path}.investmentId`, 'Referencia um ativo que não existe no arquivo.');
    }
    if (!isValidCents(item.marketValueCents, { allowZero: true })) add(`${path}.marketValueCents`, 'Valor inválido.');
    if (!isValidDateString(item.recordedAt)) add(`${path}.recordedAt`, 'Data inválida.');
    if (!isIso(item.createdAt)) add(`${path}.createdAt`, 'Data de criação inválida.');
    if (issues.length === 0) {
      entries.push({
        id: item.id as string,
        investmentId: item.investmentId as string,
        marketValueCents: item.marketValueCents as number,
        recordedAt: item.recordedAt as string,
        createdAt: item.createdAt as string,
      });
    }
  });

  if (issues.length > 0) return fail();

  const investments: Investment[] = [];
  for (const base of investmentsBase) {
    const mine = entries
      .filter((e) => e.investmentId === base.id)
      .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.createdAt.localeCompare(b.createdAt));
    const last = mine[mine.length - 1];
    if (!last) {
      add(`investments(${base.name})`, 'Ativo sem nenhum valor no histórico.');
      continue;
    }
    investments.push({ ...base, marketValueCents: last.marketValueCents, marketValueUpdatedAt: last.recordedAt });
  }
  if (issues.length > 0) return fail();

  const settings = (settingsResult as { ok: true; value: AppSettings }).value;
  return {
    ok: true,
    data: { settings, transactions, investments, investmentValueEntries: entries },
    summary: {
      exportedAt: raw.exportedAt as string,
      transactionCount: transactions.length,
      investmentCount: investments.length,
    },
  };
}
