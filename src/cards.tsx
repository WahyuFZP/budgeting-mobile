// Interactive cards for Beranda. Each motion carries information:
//   WalletCarousel  swipe through wallets like bank cards; the card in focus grows, so you always know which one you read
//   FlipCard        two related numbers in one spot (what you may spend per day / what you did spend per day)
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import type { Wallet } from './db/schema';
import { formatRupiah } from './domain';
import { useTheme } from './theme';
import { Icon, ItemIcon, PressScale } from './ui';

const TYPE_LABEL = { cash: 'Tunai', bank: 'Rekening bank', ewallet: 'E-wallet' } as const;
const GAP = 12;
const SCREEN_PAD = 16; // Screen's horizontal padding; the carousel bleeds through it to the screen edge

function WalletSlide({ i, x, step, children }: { i: number; x: SharedValue<number>; step: number; children: ReactNode }) {
  const style = useAnimatedStyle(() => {
    const d = [(i - 1) * step, i * step, (i + 1) * step];
    return { opacity: interpolate(x.value, d, [0.55, 1, 0.55], 'clamp'), transform: [{ scale: interpolate(x.value, d, [0.9, 1, 0.9], 'clamp') }] };
  });
  return <Animated.View style={style}>{children}</Animated.View>;
}

export function WalletCarousel({ wallets, balances, txCount }: { wallets: Wallet[]; balances: Map<string, number>; txCount: Map<string, number> }) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const cardW = Math.min(320, width * 0.74);
  const step = cardW + GAP;
  const x = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    x.value = e.contentOffset.x;
  });
  const side = (width - cardW) / 2;

  return (
    <Animated.ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={step}
      decelerationRate="fast"
      onScroll={onScroll}
      scrollEventThrottle={16}
      style={{ marginHorizontal: -SCREEN_PAD }}
      contentContainerStyle={{ paddingHorizontal: side, gap: GAP }}
      accessibilityLabel="Dompet, geser untuk melihat dompet lain"
    >
      {wallets.map((w, i) => (
        <WalletSlide key={w.id} i={i} x={x} step={step}>
          <PressScale
            onPress={() => router.navigate({ pathname: '/history', params: { walletId: w.id } })}
            accessibilityRole="button"
            accessibilityLabel={`${w.name}, saldo ${formatRupiah(balances.get(w.id) ?? 0)}. Ketuk untuk melihat transaksinya.`}
            testID={`wallet-card-${w.id}`}
            style={{ width: cardW, height: 150, borderRadius: 20, padding: 18, backgroundColor: w.color, justifyContent: 'space-between' }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <ItemIcon icon={w.icon} color="rgba(255,255,255,0.18)" size={34} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }} numberOfLines={1}>
                  {w.name}
                </Text>
                <Text style={{ color: '#FFFFFF', opacity: 0.85 }}>{TYPE_LABEL[w.type]}</Text>
              </View>
            </View>
            <View>
              <Text style={{ color: '#FFFFFF', fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'] }} numberOfLines={1} adjustsFontSizeToFit>
                {formatRupiah(balances.get(w.id) ?? 0)}
              </Text>
              <Text style={{ color: '#FFFFFF', opacity: 0.85 }}>{txCount.get(w.id) ?? 0} transaksi periode ini</Text>
            </View>
          </PressScale>
        </WalletSlide>
      ))}
      <WalletSlide i={wallets.length} x={x} step={step}>
        <Pressable
          onPress={() => router.push('/wallet')}
          accessibilityRole="button"
          accessibilityLabel="Tambah dompet"
          testID="wallet-card-add"
          style={({ pressed }) => ({
            width: cardW,
            height: 150,
            borderRadius: 20,
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: t.line,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Icon name="plus" size={28} color={t.text} />
          <Text style={{ color: t.text, fontWeight: '600' }}>Tambah dompet</Text>
          <Text style={{ color: t.muted }}>Rekening atau e-wallet lain</Text>
        </Pressable>
      </WalletSlide>
    </Animated.ScrollView>
  );
}

/** Card with a front and a back; tap turns it over with a 3D rotation (instant when the phone asks for reduced motion). */
export function FlipCard({ front, back, label, height = 150 }: { front: ReactNode; back: ReactNode; label: [string, string]; height?: number }) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const [flipped, setFlipped] = useState(false);
  const rot = useSharedValue(0);
  const toggle = () => {
    setFlipped((f) => !f);
    rot.value = withTiming(flipped ? 0 : 180, { duration: reduced ? 0 : 450 });
  };
  // each face is visible only while it points toward the viewer (cos > 0), so no backface flicker on Android
  const frontStyle = useAnimatedStyle(() => ({
    opacity: Math.cos((rot.value * Math.PI) / 180) > 0 ? 1 : 0,
    transform: [{ perspective: 900 }, { rotateY: `${rot.value}deg` }],
  }));
  const backStyle = useAnimatedStyle(() => ({
    opacity: Math.cos(((rot.value + 180) * Math.PI) / 180) > 0 ? 1 : 0,
    transform: [{ perspective: 900 }, { rotateY: `${rot.value + 180}deg` }],
  }));
  const faceBase = { position: 'absolute' as const, inset: 0, borderRadius: 16, padding: 16, backgroundColor: t.card, justifyContent: 'space-between' as const, backfaceVisibility: 'hidden' as const };
  return (
    <PressScale onPress={toggle} accessibilityRole="button" accessibilityLabel={flipped ? label[1] : label[0]} accessibilityHint="Ketuk untuk membalik kartu" style={{ height }}>
      <Animated.View style={[faceBase, frontStyle]}>{front}</Animated.View>
      <Animated.View style={[faceBase, backStyle]}>{back}</Animated.View>
    </PressScale>
  );
}
