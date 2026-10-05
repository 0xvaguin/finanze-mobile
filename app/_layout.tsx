import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { AppProvider } from '../src/state/AppProvider';
import { AuthProvider } from '../src/state/AuthProvider';
import { ThemeProvider, useTheme } from '../src/ui/ThemeProvider';

function Shell() {
  const { p, scheme } = useTheme();
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerStyle: { backgroundColor: p.surface }, headerTintColor: p.text, contentStyle: { backgroundColor: p.bg } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="transaction" options={{ presentation: 'modal', title: 'Lançamento' }} />
        <Stack.Screen name="investment" options={{ presentation: 'modal', title: 'Ativo' }} />
        <Stack.Screen name="simulator" options={{ title: 'Simulador' }} />
        <Stack.Screen name="copy-previous" options={{ presentation: 'modal', title: 'Copiar do mês anterior' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AppProvider>
      <ThemeProvider>
        <AuthProvider>
          <Shell />
        </AuthProvider>
      </ThemeProvider>
    </AppProvider>
  );
}
