import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Modal, Pressable, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { addMonths, formatMonthLabel } from '../domain/dates';
import { MAX_CENTS, formatBRL } from '../domain/money';
import { MIN_TOUCH, radius, space } from './theme';
import { useStyles, useTheme } from './ThemeProvider';

export function Screen({ children, edges = ['top'] }: { children: React.ReactNode; edges?: Edge[] }) {
  const s = useStyles((p) => ({ root: { flex: 1, backgroundColor: p.bg } }));
  return <SafeAreaView style={s.root} edges={edges}>{children}</SafeAreaView>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const s = useStyles((p) => ({
    card: { backgroundColor: p.surface, borderRadius: radius.lg, padding: space.lg, gap: space.sm, borderWidth: 1, borderColor: p.border },
  }));
  return <View style={[s.card, style]}>{children}</View>;
}

type Variant = 'title' | 'heading' | 'body' | 'muted' | 'label' | 'big';
export function Txt({ variant = 'body', color, style, ...rest }: React.ComponentProps<typeof Text> & { variant?: Variant; color?: string }) {
  const { p } = useTheme();
  const base: Record<Variant, TextStyle> = {
    title: { fontSize: 22, fontWeight: '700', color: p.text },
    heading: { fontSize: 16, fontWeight: '700', color: p.text },
    body: { fontSize: 15, color: p.text },
    muted: { fontSize: 13, color: p.muted },
    label: { fontSize: 12, fontWeight: '600', color: p.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
    big: { fontSize: 32, fontWeight: '800', color: p.text, fontVariant: ['tabular-nums'] },
  };
  return <Text {...rest} style={[base[variant], color ? { color } : null, style]} />;
}

export function Button({
  label, onPress, kind = 'primary', disabled, style,
}: { label: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'danger'; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  const { p } = useTheme();
  const bg = kind === 'primary' ? p.accent : kind === 'danger' ? p.danger : p.surface2;
  const fg = kind === 'secondary' ? p.text : kind === 'danger' ? '#FFFFFF' : p.onAccent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[{ minHeight: MIN_TOUCH, borderRadius: radius.md, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg, opacity: disabled ? 0.5 : 1 }, style]}
    >
      <Text style={{ color: fg, fontWeight: '700', fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

export function Chip({
  label, selected, onPress, color,
}: { label: string; selected?: boolean; onPress: () => void; color?: string }) {
  const { p } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={{
        minHeight: MIN_TOUCH, paddingHorizontal: space.md, borderRadius: radius.pill, justifyContent: 'center',
        borderWidth: 1, borderColor: selected ? (color ?? p.accent) : p.border,
        backgroundColor: selected ? p.surface2 : 'transparent', flexDirection: 'row', alignItems: 'center', gap: 6,
      }}
    >
      {color ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} /> : null}
      <Text style={{ color: selected ? p.text : p.muted, fontWeight: selected ? '700' : '500' }}>{label}</Text>
    </Pressable>
  );
}

export function Pill({ label, tone = 'muted' }: { label: string; tone?: 'muted' | 'warn' }) {
  const { p } = useTheme();
  const c = tone === 'warn' ? p.warn : p.muted;
  return (
    <View style={{ borderWidth: 1, borderColor: c, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 1 }}>
      <Text style={{ color: c, fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function IconButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  const { p } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={4}
      style={{ width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={22} color={p.text} />
    </Pressable>
  );
}

export function Fab({ onPress, label = 'Novo lançamento' }: { onPress: () => void; label?: string }) {
  const { p } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={{ position: 'absolute', right: space.lg, bottom: space.lg, width: 56, height: 56, borderRadius: 28, backgroundColor: p.accent, alignItems: 'center', justifyContent: 'center', elevation: 4 }}>
      <Ionicons name="add" size={28} color={p.onAccent} />
    </Pressable>
  );
}

export function MonthSwitcher({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const label = formatMonthLabel(month);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <IconButton icon="chevron-back" label="Mês anterior" onPress={() => onChange(addMonths(month, -1))} />
      <Txt variant="heading" accessibilityRole="header">{label.charAt(0).toUpperCase() + label.slice(1)}</Txt>
      <IconButton icon="chevron-forward" label="Próximo mês" onPress={() => onChange(addMonths(month, 1))} />
    </View>
  );
}

export function EmptyState({ title, message, action }: { title: string; message?: string; action?: React.ReactNode }) {
  return (
    <View style={{ alignItems: 'center', gap: space.sm, padding: space.xl }}>
      <Txt variant="heading" style={{ textAlign: 'center' }}>{title}</Txt>
      {message ? <Txt variant="muted" style={{ textAlign: 'center' }}>{message}</Txt> : null}
      {action}
    </View>
  );
}

export function Field({ label, error, style, ...rest }: TextInputProps & { label: string; error?: string }) {
  const { p } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Txt variant="label">{label}</Txt>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={p.muted}
        {...rest}
        style={[{ minHeight: MIN_TOUCH, borderRadius: radius.md, borderWidth: 1, borderColor: error ? p.danger : p.border, backgroundColor: p.surface, color: p.text, paddingHorizontal: space.md, fontSize: 16 }, style]}
      />
      {error ? <Txt variant="muted" color={p.danger}>{error}</Txt> : null}
    </View>
  );
}

/** Campo monetario "estilo caixa": so digitos; o texto exibido e sempre R$ 0,00 -> centavos. */
export function MoneyInput({
  label, cents, onChange, error, autoFocus,
}: { label: string; cents: number; onChange: (c: number) => void; error?: string; autoFocus?: boolean }) {
  const { p } = useTheme();
  return (
    <Field
      label={label}
      error={error}
      autoFocus={autoFocus}
      keyboardType="number-pad"
      value={formatBRL(cents)}
      onChangeText={(text) => {
        const digits = text.replace(/\D/g, '').replace(/^0+/, '');
        const next = digits === '' ? 0 : Number(digits);
        if (digits.length <= 12 && next <= MAX_CENTS) onChange(next);
      }}
      style={{ fontSize: 24, fontWeight: '700', color: p.text }}
    />
  );
}

export function ConfirmDialog({
  visible, title, message, confirmLabel, destructive, onConfirm, onCancel,
}: { visible: boolean; title: string; message: string; confirmLabel: string; destructive?: boolean; onConfirm: () => void; onCancel: () => void }) {
  const s = useStyles((p) => ({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: space.xl },
    box: { backgroundColor: p.surface, borderRadius: radius.lg, padding: space.xl, gap: space.md, borderWidth: 1, borderColor: p.border },
    row: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  }));
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <View style={s.backdrop}>
        <View style={s.box} accessibilityViewIsModal>
          <Txt variant="heading">{title}</Txt>
          <Txt variant="muted">{message}</Txt>
          <View style={s.row}>
            <Button label="Cancelar" kind="secondary" onPress={onCancel} style={{ flex: 1 }} />
            <Button label={confirmLabel} kind={destructive ? 'danger' : 'primary'} onPress={onConfirm} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
