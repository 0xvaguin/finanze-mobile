import * as SQLite from 'expo-sqlite';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { createExpoSqliteDriver } from '../data/expoSqliteDriver';
import type { FinanceRepository } from '../data/repository';
import { SqlFinanceRepository } from '../data/sqlRepository';
import { currentMonth } from '../domain/dates';
import { cleanupExportCache } from '../services/backupService';
import { DEFAULT_SETTINGS, type AppSettings } from '../domain/types';

interface AppState {
  repo: FinanceRepository;
  settings: AppSettings;
  updateSettings: (next: AppSettings) => Promise<void>;
  /** Recarrega as configuracoes do banco (apos importar ou limpar). */
  refreshSettings: () => Promise<void>;
  /** Mes selecionado (YYYY-MM), compartilhado entre Inicio e Extrato. */
  month: string;
  setMonth: (m: string) => void;
  /** Incrementa apos qualquer escrita; telas recarregam quando muda. */
  revision: number;
  bump: () => void;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp fora do AppProvider');
  return v;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [repo, setRepo] = useState<FinanceRepository | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [month, setMonth] = useState(() => currentMonth());
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    (async () => {
      try {
        const db = await SQLite.openDatabaseAsync('finanze.db');
        const r = await SqlFinanceRepository.create(createExpoSqliteDriver(db));
        const s = await r.getSettings();
        if (cancelled) return;
        if (Platform.OS !== 'web') cleanupExportCache();
        setRepo(r);
        setSettings(s);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro ao abrir o banco de dados.');
      }
    })();
    return () => { cancelled = true; };
  }, [attempt]);

  const bump = useCallback(() => setRevision((n) => n + 1), []);
  const updateSettings = useCallback(async (next: AppSettings) => {
    if (!repo) return;
    setSettings(await repo.updateSettings(next));
  }, [repo]);

  const refreshSettings = useCallback(async () => {
    if (!repo) return;
    setSettings(await repo.getSettings());
  }, [repo]);

  const value = useMemo<AppState | null>(
    () => (repo ? { repo, settings, updateSettings, refreshSettings, month, setMonth, revision, bump } : null),
    [repo, settings, updateSettings, refreshSettings, month, revision, bump],
  );

  if (error) {
    return (
      <View style={boot.box}>
        <Text style={boot.title}>Não foi possível abrir seus dados</Text>
        <Text style={boot.msg}>{error}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Tentar novamente" onPress={() => setAttempt((n) => n + 1)} style={boot.btn}>
          <Text style={boot.btnText}>Tentar novamente</Text>
        </Pressable>
        {Platform.OS === 'web' && <Text style={boot.msg}>Na Web o armazenamento local é experimental; use o app nativo.</Text>}
      </View>
    );
  }
  if (!value) {
    return (
      <View style={boot.box}>
        <ActivityIndicator accessibilityLabel="Carregando" />
      </View>
    );
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

const boot = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, backgroundColor: '#0B0F14' },
  title: { color: '#E8EEF4', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  msg: { color: '#8FA0B3', textAlign: 'center' },
  btn: { minHeight: 44, paddingHorizontal: 20, justifyContent: 'center', borderRadius: 12, backgroundColor: '#4ADE9A' },
  btnText: { color: '#06261A', fontWeight: '700' },
});
