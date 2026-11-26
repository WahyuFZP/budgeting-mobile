// Interactive cards for Beranda. Each motion carries information:
//   WalletStack     wallets as stacked bank cards: closed shows every balance, open fans the cards out
//   FlipCard        two related numbers in one spot (what you may spend per day / what you did spend per day)
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import type { Wallet } from './db/schema';
import { formatRupiah, goalProgress, HIDDEN_AMOUNT } from './domain';
import { useTheme } from './theme';
import { Icon, ItemIcon, PressScale, Row } from './ui';

const TYPE_LABEL = { cash: 'Tunai', bank: 'Rekening bank', ewallet: 'E-wallet' } as const;
const STRIP = 58; // visible top of each card while the stack is closed: icon, name, balance
const CARD = 158;
const OPEN_STEP = CARD + 10;
const ADD = 64; // compact "add wallet" strip under the stack

/** One card in the stack; its offset moves from `closed` to `opened` with the progress (0..1), on the UI thread. */
function StackCard({ z, closed, opened, open, children }: { z: number; closed: number; opened: number; open: SharedValue<number>; children: ReactNode }) {
  // transform, not top: moves on the GPU without re-running layout every frame
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: closed + (opened - closed) * open.value }] }));
  return <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: z }, style]}>{children}</Animated.View>;
}

/** Wallets as a stack of bank-style cards. Closed: every balance readable at a glance in little space.
 *  Tap to fan the stack open; tap an open card to see that wallet's transactions. */
export function WalletStack({ wallets, balances, txCount, hidden }: { wallets: Wallet[]; balances: Map<string, number>; txCount: Map<string, number>; hidden: boolean }) {
  const money = (id: string) => (hidden ? HIDDEN_AMOUNT : formatRupiah(balances.get(id) ?? 0));
  const t = useTheme();
  const reduced = useReducedMotion();
  const [isOpen, setIsOpen] = useState(false);
  const open = useSharedValue(0);
  const W = wallets.length;
  // closed: every card shows its top strip and the last one is shown whole; the add strip sits under the stack
  const addClosed = Math.max(0, W - 1) * STRIP + (W ? CARD + 10 : 0);
  const addOpened = W * OPEN_STEP;
  const toggle = () => {
    setIsOpen((o) => !o);
    // short and decisive: fast start, soft landing, no spring wobble to wait for
    open.value = withTiming(isOpen ? 0 : 1, { duration: reduced ? 0 : 280, easing: Easing.out(Easing.cubic) });
  };
  const box = useAnimatedStyle(() => ({ height: addClosed + (addOpened - addClosed) * open.value + ADD }));
  const cardStyle = (bg: string) => ({ height: CARD, borderRadius: 20, padding: 16, backgroundColor: bg, justifyContent: 'space-between' as const });

  return (
    <View style={{ gap: 8 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ color: t.text, fontWeight: '700', fontSize: 16 }}>Dompet ({wallets.length})</Text>
        {W > 1 && (
        <Pressable onPress={toggle} accessibilityRole="button" accessibilityState={{ expanded: isOpen }} hitSlop={10} testID="wallet-stack-toggle" style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36 }}>
          <Text style={{ color: t.mark, fontWeight: '600' }}>{isOpen ? 'Tutup' : 'Lihat semua'}</Text>
          <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={20} color={t.mark} />
        </Pressable>
        )}
      </Row>
      <Animated.View style={box}>
        {wallets.map((w, i) => (
          <StackCard key={w.id} z={i} closed={i * STRIP} opened={i * OPEN_STEP} open={open}>
            <PressScale
              onPress={isOpen || i === W - 1 ? () => router.navigate({ pathname: '/history', params: { walletId: w.id } }) : toggle}
              accessibilityRole="button"
              accessibilityLabel={`${w.name}, saldo ${hidden ? 'disembunyikan' : money(w.id)}. ${isOpen || i === W - 1 ? 'Ketuk untuk melihat transaksinya.' : 'Ketuk untuk membuka tumpukan dompet.'}`}
              testID={`wallet-card-${w.id}`}
              style={[cardStyle(w.color), { borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' }]}
            >
              <Row style={{ gap: 10 }}>
                <ItemIcon icon={w.icon} color="rgba(255,255,255,0.18)" size={30} />
                <Text style={{ color: '#FFFFFF', fontWeight: '700', flex: 1 }} numberOfLines={1}>
                  {w.name}
                </Text>
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontVariant: ['tabular-nums'] }}>{money(w.id)}</Text>
              </Row>
              <View>
                <Text style={{ color: '#FFFFFF', opacity: 0.85 }}>{w.targetAmount ? `Target ${hidden ? HIDDEN_AMOUNT : formatRupiah(w.targetAmount)}` : TYPE_LABEL[w.type]}</Text>
                <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] }} numberOfLines={1} adjustsFontSizeToFit>
                  {money(w.id)}
                </Text>
                {w.targetAmount ? <GoalLine w={w} balance={balances.get(w.id) ?? 0} hidden={hidden} /> : <Text style={{ color: '#FFFFFF', opacity: 0.85 }}>{txCount.get(w.id) ?? 0} transaksi periode ini</Text>}
              </View>
            </PressScale>
          </StackCard>
        ))}
        <StackCard z={W} closed={addClosed} opened={addOpened} open={open}>
          <PressScale
            onPress={() => router.push('/wallet')}
            accessibilityRole="button"
            accessibilityLabel="Tambah dompet"
            testID="wallet-card-add"
            style={{ height: ADD - 8, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: t.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <Icon name="plus-circle" size={22} color={t.mark} />
            <Text style={{ color: t.text, fontWeight: '700' }}>Tambah dompet</Text>
          </PressScale>
        </StackCard>
      </Animated.View>
    </View>
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

/** Savings-goal progress on a wallet card: white bar on the wallet's own color, then what is left (and per month). */
function GoalLine({ w, balance, hidden }: { w: Wallet; balance: number; hidden: boolean }) {
  const g = goalProgress(balance, w.targetAmount!, w.targetDate, new Date());
  const rest = g.done ? 'Target tercapai!' : hidden ? `${Math.floor(g.pct)}% tercapai` : `Kurang ${formatRupiah(g.remaining)}${g.perMonth ? `, ${formatRupiah(g.perMonth)}/bulan` : ''}`;
  return (
    <View style={{ gap: 4, marginTop: 2 }} accessible accessibilityLabel={`${Math.floor(g.pct)} persen dari target. ${rest}`}>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
        <View style={{ width: `${g.pct}%`, height: '100%', borderRadius: 3, backgroundColor: '#FFFFFF' }} />
      </View>
      <Text style={{ color: '#FFFFFF', opacity: 0.9, fontVariant: ['tabular-nums'] }} numberOfLines={1}>
        {rest}
      </Text>
    </View>
  );
}
