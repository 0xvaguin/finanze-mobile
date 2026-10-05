import React, { createContext, useContext, useMemo } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { useApp } from '../state/AppProvider';
import { darkPalette, lightPalette, type Palette } from './theme';

interface ThemeValue { p: Palette; scheme: 'dark' | 'light' }
const Ctx = createContext<ThemeValue>({ p: darkPalette, scheme: 'dark' });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useApp();
  const system = useColorScheme();
  const scheme: 'dark' | 'light' =
    settings.theme === 'system' ? (system === 'light' ? 'light' : 'dark') : settings.theme;
  const value = useMemo(() => ({ p: scheme === 'light' ? lightPalette : darkPalette, scheme }), [scheme]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);

/** StyleSheet dependente da paleta, recriado so quando o tema muda. */
export function useStyles<T extends StyleSheet.NamedStyles<T>>(factory: (p: Palette) => T): T {
  const { p } = useTheme();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => StyleSheet.create(factory(p)), [p]);
}
