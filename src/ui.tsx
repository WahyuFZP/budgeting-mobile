// Shared UI. Colors always come from useTheme() (light/dark follow the phone); `s` holds layout only.
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Component, lazy, Suspense, useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type PressableProps, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import Animated, {
  makeMutable,
  useAnimatedScrollHandler,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Category, Transaction, Wallet } from './db/schema';
import { formatRupiah, HIDDEN_AMOUNT, type BudgetLevel } from './domain';
import { PALETTE, useTheme, type Palette } from './theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
export const Icon = (p: { name: IconName; size?: number; color: string }) => (
  <MaterialCommunityIcons name={p.name} size={p.size ?? 22} color={p.color} accessibilityElementsHidden importantForAccessibility="no" />
);

const isGlyph = (n: string): n is IconName => n in MaterialCommunityIcons.glyphMap;

/** Category/wallet mark: white glyph on the item's own color. Older rows may still hold an emoji; show it as text. */
export function ItemIcon({ icon, color, size = 40 }: { icon: string; color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      {isGlyph(icon) ? <Icon name={icon} size={size * 0.55} color="#FFFFFF" /> : <Text style={{ fontSize: size * 0.5 }}>{icon}</Text>}
    </View>
  );
}

export const levelColor = (l: BudgetLevel, t: Palette) => (l === 'over' ? t.expense : l === 'warn' ? t.warnBar : t.income);

/** Bottom space a tab screen needs so its last item can scroll fully above the floating tab bar
 *  (bar 64 + its 12 gap + the phone's gesture/nav area + 24 breathing room). */
export function useTabBarSpace() {
  return 68 + 12 + useSafeAreaInsets().bottom + 32; // bar 68 + gap 12 + raised fab clearance
}

/** 1 while the floating tab bar is slid away. Written by scrolling tab screens, read by TabBar. */
export const navHidden = makeMutable(0);

/** Scroll handler for tab screens: hide the tab bar while scrolling down (so the last items are not covered),
 *  bring it back when scrolling up or near the top. Runs on the UI thread. */
export function useNavScroll() {
  const last = useSharedValue(0);
  return useAnimatedScrollHandler({
    onScroll: (e) => {
      const y = e.contentOffset.y;
      const dy = y - last.value;
      if (y < 40 || dy < -6) navHidden.value = 0;
      else if (dy > 6) navHidden.value = 1;
      last.value = y;
    },
  });
}

export function Screen({ children, scroll = true, tab = false }: { children: ReactNode; scroll?: boolean; tab?: boolean }) {
  const t = useTheme();
  const onScroll = useNavScroll();
  const space = useTabBarSpace();
  if (!scroll) return <View style={[s.screen, { flex: 1, backgroundColor: t.bg }]}>{children}</View>;
  return (
    <Animated.ScrollView
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={[s.screen, tab && { paddingBottom: space }]}
      keyboardShouldPersistTaps="handled"
      onScroll={tab ? onScroll : undefined}
      scrollEventThrottle={16}
    >
      {children}
    </Animated.ScrollView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return <View style={[s.card, { backgroundColor: t.card }, style]}>{children}</View>;
}

export function H({ children }: { children: ReactNode }) {
  return <Text style={[s.h, { color: useTheme().text }]}>{children}</Text>;
}
export function Muted({ children }: { children: ReactNode }) {
  return <Text style={{ color: useTheme().muted }}>{children}</Text>;
}
export function T({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[{ color: useTheme().text }, style]}>{children}</Text>;
}

export function Button({
  title,
  onPress,
  kind = 'primary',
  icon,
  testID,
  disabled,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'ghost' | 'danger';
  icon?: IconName;
  testID?: string;
  disabled?: boolean;
}) {
  const t = useTheme();
  const fg = kind === 'primary' ? t.onPrimary : kind === 'danger' ? t.expense : t.text;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.btn,
        kind === 'primary' ? { backgroundColor: t.primary } : { borderWidth: 1, borderColor: kind === 'danger' ? t.expense : t.line },
        (pressed || disabled) && { opacity: 0.6 },
      ]}
    >
      {icon && <Icon name={icon} size={20} color={fg} />}
      <Text style={[s.btnText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

/** Selected state always uses the theme mark color plus a check, never the item's own color:
 *  a dark wallet color on a dark card made the selected wallet invisible (bug report, 25 Nov). */
export function Chip({ label, active, onPress, color, icon, testID }: { label: string; active: boolean; onPress: () => void; color?: string; icon?: IconName; testID?: string }) {
  const t = useTheme();
  const bg = active ? t.mark : t.card;
  const fg = active ? t.onMark : t.text;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[s.chip, { backgroundColor: bg, borderColor: active ? bg : t.line }]}
    >
      {active ? <Icon name="check" size={18} color={fg} /> : icon && <Icon name={icon} size={18} color={color ?? fg} />}
      <Text style={{ color: fg, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export const Row = ({ children, style }: { children: ReactNode; style?: ViewStyle }) => <View style={[s.row, style]}>{children}</View>;

export function Field(p: TextInputProps & { label?: string }) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 4 }}>
      {p.label && <Text style={[s.label, { color: t.muted }]}>{p.label}</Text>}
      <TextInput
        placeholderTextColor={t.muted}
        accessibilityLabel={p.label}
        {...p}
        onFocus={(e) => (setFocused(true), p.onFocus?.(e))}
        onBlur={(e) => (setFocused(false), p.onBlur?.(e))}
        style={[s.input, { backgroundColor: t.card, color: t.text, borderColor: focused ? t.mark : t.line, borderWidth: focused ? 2 : 1 }, p.style]}
      />
    </View>
  );
}

/** Spring-animated progress bar (UI thread). Reanimated skips the spring when the phone asks for reduced motion. */
export function Bar({ pct, color }: { pct: number; color: string }) {
  const t = useTheme();
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withSpring(Math.min(pct, 100), { damping: 18 });
  }, [pct, w]);
  const style = useAnimatedStyle(() => ({ width: `${w.value}%` }));
  return (
    <View style={[s.barBg, { backgroundColor: t.line }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(Math.min(pct, 100)) }}>
      <Animated.View style={[s.barFg, { backgroundColor: color }, style]} />
    </View>
  );
}

const AnimatedInput = Animated.createAnimatedComponent(TextInput);

/** Money figure that rolls to its new value, so the user sees a balance change instead of a jump. */
export function RollingAmount({ value, style, testID, hidden }: { value: number; style?: object; testID?: string; hidden?: boolean }) {
  const reduced = useReducedMotion();
  const v = useSharedValue(value);
  useEffect(() => {
    v.value = reduced ? value : withTiming(value, { duration: 600 });
  }, [value, reduced, v]);
  const props = useAnimatedProps(() => ({ text: formatRupiah(Math.round(v.value)), defaultValue: formatRupiah(Math.round(v.value)) }) as object);
  if (hidden) return <Text testID={testID} accessibilityLabel="Nominal disembunyikan" numberOfLines={1} style={[{ fontVariant: ['tabular-nums'] }, style]}>{HIDDEN_AMOUNT}</Text>;
  return (
    <AnimatedInput
      testID={testID}
      editable={false}
      animatedProps={props}
      accessibilityLabel={formatRupiah(value)}
      style={[{ padding: 0, fontVariant: ['tabular-nums'] }, style]}
    />
  );
}

/** Card that tilts toward the finger (parallax). Raw touch events, so it never steals the ScrollView's drag. */
export function TiltCard({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const reduced = useReducedMotion();
  const rx = useSharedValue(0);
  const ry = useSharedValue(0);
  const [size, setSize] = useState({ w: 1, h: 1 });
  const tilt = (x: number, y: number) => {
    if (reduced) return;
    ry.value = withSpring(((x / size.w) * 2 - 1) * 8);
    rx.value = withSpring(-((y / size.h) * 2 - 1) * 8);
  };
  const reset = () => {
    rx.value = withSpring(0);
    ry.value = withSpring(0);
  };
  const anim = useAnimatedStyle(() => ({ transform: [{ perspective: 800 }, { rotateX: `${rx.value}deg` }, { rotateY: `${ry.value}deg` }] }));
  return (
    <Animated.View
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      onTouchStart={(e) => tilt(e.nativeEvent.locationX, e.nativeEvent.locationY)}
      onTouchMove={(e) => tilt(e.nativeEvent.locationX, e.nativeEvent.locationY)}
      onTouchEnd={reset}
      onTouchCancel={reset}
      style={[style, anim]}
    >
      {children}
    </Animated.View>
  );
}

/** 6-digit PIN pad used by onboarding, lock screen and PIN change. */
/** 6-digit pad. `onBio` puts a fingerprint key in the empty bottom-left slot, where banking apps keep it. */
export function PinPad({ title, error, onComplete, onBio }: { title: string; error?: string; onComplete: (pin: string) => void; onBio?: () => void }) {
  const t = useTheme();
  const [pin, setPin] = useState('');
  const press = (k: string) => {
    if (k === 'del') return setPin((p) => p.slice(0, -1));
    const next = (pin + k).slice(0, 6);
    setPin(next);
    if (next.length === 6) {
      setPin('');
      onComplete(next);
    }
  };
  return (
    <View style={{ alignItems: 'center', gap: 20 }}>
      <Text style={[s.h, { color: t.text }]}>{title}</Text>
      <Row style={{ gap: 14 }}>
        {Array.from({ length: 6 }, (_, i) => (
          <View key={i} style={[s.dot, { borderColor: t.mark }, i < pin.length && { backgroundColor: t.mark }]} />
        ))}
      </Row>
      <Text style={{ color: t.expense, minHeight: 20 }} accessibilityLiveRegion="polite">
        {error ?? ''}
      </Text>
      <View style={{ width: 270, flexDirection: 'row', flexWrap: 'wrap', gap: 15 }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', onBio ? 'bio' : '', '0', 'del'].map((k, i) =>
          k ? (
            <Pressable
              key={i}
              testID={`pin-${k}`}
              accessibilityRole="button"
              accessibilityLabel={k === 'del' ? 'Hapus angka' : k === 'bio' ? 'Buka dengan sidik jari atau wajah' : k}
              onPress={() => (k === 'bio' ? onBio!() : press(k))}
              style={({ pressed }) => [s.key, { backgroundColor: pressed ? t.line : t.card }]}
            >
              {k === 'bio' ? <Icon name="fingerprint" size={30} color={t.mark} /> : k === 'del' ? <Icon name="backspace-outline" size={26} color={t.text} /> : <Text style={{ fontSize: 26, fontWeight: '600', color: t.text }}>{k}</Text>}
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
export function TxRow({ t: tx, cat, wallet, toWallet, onPress, hidden }: { t: Transaction; cat?: Category; wallet?: Wallet; toWallet?: Wallet; onPress: () => void; hidden?: boolean }) {
  const t = useTheme();
  const transfer = tx.type === 'transfer';
  const sign = tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : '';
  const amount = hidden ? HIDDEN_AMOUNT : `${sign}${formatRupiah(tx.amount)}`;
  const title = transfer ? `Transfer ke ${toWallet?.name ?? '?'}` : (cat?.name ?? 'Tanpa kategori');
  return (
    <Pressable
      onPress={onPress}
      testID={`tx-${tx.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${hidden ? 'nominal disembunyikan' : amount}`}
      style={({ pressed }) => [s.row, { paddingVertical: 10, gap: 12 }, pressed && { opacity: 0.6 }]}
    >
      <ItemIcon icon={transfer ? 'swap-horizontal' : (cat?.icon ?? 'tag')} color={transfer ? t.muted : (cat?.color ?? t.muted)} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontWeight: '600' }} numberOfLines={1}>
          {title}
        </Text>
        <Text style={{ color: t.muted }} numberOfLines={1}>
          {wallet?.name}
          {tx.note ? `, ${tx.note}` : ''}
        </Text>
      </View>
      <Text style={{ fontWeight: '700', fontVariant: ['tabular-nums'], color: tx.type === 'income' ? t.income : tx.type === 'expense' ? t.expense : t.text }}>
        {amount}
      </Text>
    </Pressable>
  );
}

export const s = StyleSheet.create({
  screen: { padding: 16, gap: 12, paddingBottom: 32 },
  card: { borderRadius: 16, padding: 16, gap: 8 },
  h: { fontSize: 18, fontWeight: '700' },
  label: { fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btn: { minHeight: 48, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  btnText: { fontWeight: '700', fontSize: 16 },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  input: { borderRadius: 12, padding: 12, fontSize: 16 },
  barBg: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFg: { height: 8, borderRadius: 4 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  key: { width: 80, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
});

const COLOR_NAMES = ['hijau hutan', 'hijau lumut', 'biru danau', 'cokelat tanah', 'merah beri', 'ungu', 'merah', 'abu batu'];

/** Color swatches for wallets and categories (colors from theme PALETTE, all pass 4.5:1 with a white icon). */
export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={[s.label, { color: t.muted }]}>Warna</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {PALETTE.map((c, i) => (
          <Pressable
            key={c}
            onPress={() => onChange(c)}
            accessibilityRole="radio"
            accessibilityLabel={COLOR_NAMES[i]}
            accessibilityState={{ checked: value === c }}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c, alignItems: 'center', justifyContent: 'center', borderWidth: value === c ? 3 : 0, borderColor: t.text }}
          >
            {value === c && <Icon name="check" size={22} color="#FFFFFF" />}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

type ForestProps = ComponentProps<typeof import('./Forest3D').default>;
const LazyForest = lazy(() => import('./Forest3D'));

/** Static stand-in: shown while three.js loads, and instead of the 3D scene if the GPU path fails. */
function ForestFallback({ width, height }: { width: number; height: number }) {
  const t = useTheme();
  return (
    <View style={{ width, height, alignItems: 'center', justifyContent: 'flex-end' }}>
      <View style={{ position: 'absolute', top: height * 0.12, right: width * 0.12, width: height * 0.2, height: height * 0.2, borderRadius: height * 0.1, backgroundColor: t.accent }} />
      <View style={{ width: width * 0.9, height: height * 0.35, borderTopLeftRadius: width * 0.45, borderTopRightRadius: width * 0.45, backgroundColor: '#3E7A57' }} />
    </View>
  );
}

class ForestBoundary extends Component<{ children: ReactNode; width: number; height: number }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <ForestFallback width={this.props.width} height={this.props.height} /> : this.props.children;
  }
}

/** The squirrel-in-the-forest scene, loaded lazily so three.js never delays the first screen. */
export function Forest(p: ForestProps & { width: number; height: number }) {
  return (
    <ForestBoundary width={p.width} height={p.height}>
      <Suspense fallback={<ForestFallback width={p.width} height={p.height} />}>
        <LazyForest {...p} />
      </Suspense>
    </ForestBoundary>
  );
}

/** Empty screen with the mascot above the message, so "nothing here yet" still points to the next step. */
export function EmptyState({ text }: { text: string }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 6, paddingVertical: 8 }}>
      <Forest width={200} height={150} />
      <Text style={{ color: t.muted, textAlign: 'center' }}>{text}</Text>
    </View>
  );
}

const APressable = Animated.createAnimatedComponent(Pressable);

/** Pressable card that sinks slightly under the finger and springs back: tactile feedback that the card is tappable. */
export function PressScale({ style, children, ...p }: Omit<PressableProps, 'style' | 'children'> & { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const sc = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));
  return (
    <APressable
      {...p}
      onPressIn={(e) => {
        sc.value = withSpring(0.97, { damping: 20, stiffness: 400 });
        p.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        sc.value = withSpring(1, { damping: 14, stiffness: 260 });
        p.onPressOut?.(e);
      }}
      style={[style, anim]}
    >
      {children}
    </APressable>
  );
}
