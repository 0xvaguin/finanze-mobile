import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { PIN_LENGTH } from '../../domain/pin';
import { space } from '../theme';
import { useTheme } from '../ThemeProvider';

export function PinDots({ length, error }: { length: number; error?: boolean }) {
  const { p } = useTheme();
  return (
    <View accessible accessibilityLabel={`${length} de ${PIN_LENGTH} dígitos informados`} style={{ flexDirection: 'row', gap: space.md, justifyContent: 'center' }}>
      {Array.from({ length: PIN_LENGTH }, (_, i) => (
        <View key={i} style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: error ? p.danger : p.accent, backgroundColor: i < length ? (error ? p.danger : p.accent) : 'transparent' }} />
      ))}
    </View>
  );
}

/** Teclado numerico proprio (PIN nunca passa por campo de texto/autocorrecao). */
export function PinPad({
  value, onChange, disabled, leftSlot,
}: { value: string; onChange: (v: string) => void; disabled?: boolean; leftSlot?: React.ReactNode }) {
  const { p } = useTheme();
  const press = (d: string) => { if (!disabled && value.length < PIN_LENGTH) onChange(value + d); };
  const keyStyle = { width: 76, height: 76, borderRadius: 38, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, opacity: disabled ? 0.4 : 1 };
  const digit = (d: string) => (
    <Pressable key={d} accessibilityRole="button" accessibilityLabel={d} disabled={disabled} onPress={() => press(d)} style={keyStyle}>
      <Text style={{ color: p.text, fontSize: 26, fontWeight: '600' }}>{d}</Text>
    </Pressable>
  );
  const blank = <View style={{ width: 76, height: 76, alignItems: 'center', justifyContent: 'center' }}>{leftSlot}</View>;
  return (
    <View style={{ gap: space.md, alignItems: 'center' }}>
      {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']].map((row) => (
        <View key={row.join('')} style={{ flexDirection: 'row', gap: space.lg }}>{row.map(digit)}</View>
      ))}
      <View style={{ flexDirection: 'row', gap: space.lg }}>
        {blank}
        {digit('0')}
        <Pressable accessibilityRole="button" accessibilityLabel="Apagar último dígito" disabled={disabled || value.length === 0} onPress={() => onChange(value.slice(0, -1))}
          style={{ ...keyStyle, backgroundColor: 'transparent', borderWidth: 0, opacity: disabled || value.length === 0 ? 0.3 : 1 }}>
          <Ionicons name="backspace-outline" size={28} color={p.text} />
        </Pressable>
      </View>
    </View>
  );
}
