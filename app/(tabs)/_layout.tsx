import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import type { ColorValue } from 'react-native';
import { useTheme } from '../../src/ui/ThemeProvider';

export default function TabsLayout() {
  const { p } = useTheme();
  const icon = (name: keyof typeof Ionicons.glyphMap) =>
    ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} color={color} size={size} />;
  return (
    <Tabs screenOptions={{
      headerShown: false, tabBarActiveTintColor: p.accent, tabBarInactiveTintColor: p.muted,
      tabBarStyle: { backgroundColor: p.surface, borderTopColor: p.border, minHeight: 56 },
      tabBarLabelStyle: { fontSize: 12 },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen name="extrato" options={{ title: 'Extrato', tabBarIcon: icon('list-outline') }} />
      <Tabs.Screen name="investimentos" options={{ title: 'Investimentos', tabBarIcon: icon('trending-up-outline') }} />
      <Tabs.Screen name="settings" options={{ title: 'Configurações', tabBarIcon: icon('settings-outline') }} />
    </Tabs>
  );
}
