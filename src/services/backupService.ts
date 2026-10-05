import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { FinanceRepository } from '../data/repository';
import { parseBackup, serializeBackup, type ParseBackupResult } from '../domain/backup';
import { transactionsToCsv } from '../domain/csv';
import { todayLocal } from '../domain/dates';

const PREFIX = 'finanze-';

/** Remove arquivos temporarios de exportacoes anteriores (o app nao apaga na hora: no Android o destino le o arquivo depois). */
export function cleanupExportCache(): void {
  try {
    for (const entry of new Directory(Paths.cache).list()) {
      if (entry instanceof File && entry.name?.startsWith(PREFIX)) entry.delete();
    }
  } catch {
    // limpeza e best-effort
  }
}

async function shareText(fileName: string, content: string, mimeType: string, dialogTitle: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('O compartilhamento não está disponível neste dispositivo.');
  cleanupExportCache();
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(content);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle });
}

/** Exporta o backup completo (JSON) e registra a data do ultimo backup. */
export async function exportBackupJson(repo: FinanceRepository): Promise<void> {
  const data = await repo.exportAll();
  const text = serializeBackup(data, new Date().toISOString());
  await shareText(`${PREFIX}backup-${todayLocal()}.json`, text, 'application/json', 'Salvar backup do Finanze');
  await repo.setLastBackupAt(new Date().toISOString());
}

/** Exporta os lancamentos em CSV (planilha). Nao conta como backup restauravel. */
export async function exportTransactionsCsv(repo: FinanceRepository): Promise<void> {
  const text = transactionsToCsv(await repo.listAllTransactions());
  await shareText(`${PREFIX}lancamentos-${todayLocal()}.csv`, text, 'text/csv', 'Exportar lançamentos');
}

/** Abre o seletor, le e valida o arquivo INTEIRO. Retorna null se a pessoa cancelou. */
export async function pickAndParseBackup(): Promise<ParseBackupResult | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled) return null;
  const asset = res.assets[0];
  if (!asset) return null;
  const file = new File(asset.uri);
  try {
    return parseBackup(await file.text());
  } finally {
    try { file.delete(); } catch { /* copia temporaria */ }
  }
}
