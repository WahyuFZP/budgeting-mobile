// Shared UI bits. Light theme only in v1.0 (dark mode is P1).
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import type { Category, Transaction, Wallet } from './db/schema';
import { formatRupiah, type BudgetLevel } from './domain';

export const C = {
  bg: '#F6F7F9',
  card: '#FFFFFF',
  text: '#14161A',
  muted: '#5C6370', // 5.9:1 on white
  line: '#E3E6EA',
  accent: '#0B7A5C', // 5.4:1 on white
  danger: '#C62828',
  warn: '#B26A00',
  income: '#0B7A5C',
  expense: '#C62828',
};
export const PALETTE = ['#E4572E', '#2E86AB', '#F2A541', '#A23B72', '#6C5CE7', '#00A878', '#3D5A80', '#7A7A7A'];
export const levelColor = (l: BudgetLevel) => (l === 'over' ? C.danger : l === 'warn' ? '#E0A100' : C.accent);

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  if (!scroll) return <View style={[s.screen, { flex: 1 }]}>{children}</View>;
  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={s.screen} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export const Card = ({ children, style }: { children: ReactNode; style?: ViewStyle }) => <View style={[s.card, style]}>{children}</View>;
export const H = ({ children }: { children: ReactNode }) => <Text style={s.h}>{children}</Text>;
export const Muted = ({ children }: { children: ReactNode }) => <Text style={s.muted}>{children}</Text>;

export function Button({ title, onPress, kind = 'primary', testID, disabled }: { title: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'danger'; testID?: string; disabled?: boolean }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [s.btn, kind === 'primary' ? { backgroundColor: C.accent } : { borderWidth: 1, borderColor: kind === 'danger' ? C.danger : C.line }, (pressed || disabled) && { opacity: 0.6 }]}
    >
      <Text style={[s.btnText, { color: kind === 'primary' ? '#fff' : kind === 'danger' ? C.danger : C.text }]}>{title}</Text>
    </Pressable>
  );
}

export function Chip({ label, active, onPress, color, testID }: { label: string; active: boolean; onPress: () => void; color?: string; testID?: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[s.chip, active && { backgroundColor: color ?? C.accent, borderColor: color ?? C.accent }]}>
      <Text style={{ color: active ? '#fff' : C.text, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export const Row = ({ children, style }: { children: ReactNode; style?: ViewStyle }) => <View style={[s.row, style]}>{children}</View>;

export const Field = (p: TextInputProps & { label?: string }) => (
  <View style={{ gap: 4 }}>
    {p.label && <Text style={s.label}>{p.label}</Text>}
    <TextInput placeholderTextColor={C.muted} {...p} style={[s.input, p.style]} />
  </View>
);

/** Spring-animated progress bar (Reanimated, UI thread; honours system "reduce motion" by default). */
export function Bar({ pct, color }: { pct: number; color: string }) {
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withSpring(Math.min(pct, 100), { damping: 18 });
  }, [pct, w]);
  const style = useAnimatedStyle(() => ({ width: `${w.value}%` }));
  return (
    <View style={s.barBg}>
      <Animated.View style={[s.barFg, { backgroundColor: color }, style]} />
    </View>
  );
}

/** 6-digit PIN pad used by onboarding, lock screen and PIN change. */
export function PinPad({ title, error, onComplete }: { title: string; error?: string; onComplete: (pin: string) => void }) {
  const [pin, setPin] = useState('');
  const press = (k: string) => {
    if (k === '⌫') return setPin((p) => p.slice(0, -1));
    const next = (pin + k).slice(0, 6);
    setPin(next);
    if (next.length === 6) {
      setPin('');
      onComplete(next);
    }
  };
  return (
    <View style={{ alignItems: 'center', gap: 20 }}>
      <Text style={s.h}>{title}</Text>
      <Row style={{ gap: 14 }}>
        {Array.from({ length: 6 }, (_, i) => (
          <View key={i} style={[s.dot, i < pin.length && { backgroundColor: C.accent }]} />
        ))}
      </Row>
      <Text style={{ color: C.danger, minHeight: 20 }}>{error ?? ''}</Text>
      <View style={{ width: 270, flexDirection: 'row', flexWrap: 'wrap', gap: 15 }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, i) =>
          k ? (
            <Pressable key={i} testID={`pin-${k === '⌫' ? 'del' : k}`} accessibilityLabel={k === '⌫' ? 'Hapus' : k} onPress={() => press(k)} style={({ pressed }) => [s.key, pressed && { backgroundColor: C.line }]}>
              <Text style={{ fontSize: 26, fontWeight: '600', color: C.text }}>{k}</Text>
            </Pressable>
          ) : (
            <View key={i} style={{ width: 80, height: 64 }} />
          ),
        )}
      </View>
    </View>
  );
}

/** One transaction line; tap opens it for edit. */
export function TxRow({ t, cat, wallet, toWallet, onPress }: { t: Transaction; cat?: Category; wallet?: Wallet; toWallet?: Wallet; onPress: () => void }) {
  const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '-' : '';
  const title = t.type === 'transfer' ? `Transfer → ${toWallet?.name ?? '?'}` : (cat?.name ?? 'Tanpa kategori');
  return (
    <Pressable onPress={onPress} testID={`tx-${t.id}`} accessibilityRole="button" style={({ pressed }) => [s.row, { paddingVertical: 10 }, pressed && { opacity: 0.6 }]}>
      <Text style={{ fontSize: 22, width: 32 }}>{t.type === 'transfer' ? '🔁' : (cat?.icon ?? '🏷️')}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.text, fontWeight: '600' }}>{title}</Text>
        <Text style={s.muted} numberOfLines={1}>
          {wallet?.name}
          {t.note ? ` · ${t.note}` : ''}
        </Text>
      </View>
      <Text style={{ fontWeight: '700', color: t.type === 'income' ? C.income : t.type === 'expense' ? C.expense : C.text }}>
        {sign}
        {formatRupiah(t.amount)}
      </Text>
    </Pressable>
  );
}

export const s = StyleSheet.create({
  screen: { padding: 16, gap: 12, backgroundColor: C.bg, paddingBottom: 100 },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 8 },
  h: { fontSize: 18, fontWeight: '700', color: C.text },
  big: { fontSize: 32, fontWeight: '800', color: C.text },
  muted: { color: C.muted },
  label: { color: C.muted, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btn: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center' },
  btnText: { fontWeight: '700', fontSize: 16 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: C.line, backgroundColor: C.card },
  input: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12, fontSize: 16, color: C.text },
  barBg: { height: 8, backgroundColor: C.line, borderRadius: 4, overflow: 'hidden' },
  barFg: { height: 8, borderRadius: 4 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: C.accent },
  key: { width: 80, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card },
});
