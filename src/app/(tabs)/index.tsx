import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, ZoomIn } from 'react-native-reanimated';
import { FlipCard, WalletStack } from '../../cards';
import * as Haptics from 'expo-haptics';
import { budgetStatus, formatRupiah, HIDDEN_AMOUNT, pace, spentByCategory, squirrelLines, totals } from '../../domain';
import { q, setSetting } from '../../db/repo';
import { fmtPeriod, useCategories, useCurrentPeriod, useReminders, useSettings, useWallets } from '../../hooks';
import { useTheme } from '../../theme';
import { Bar, Card, EmptyState, H, Icon, Muted, Forest, PressScale, RollingAmount, Row, Screen, TiltCard, TxRow, levelColor } from '../../ui';

const HERO = 190;
const amountSize = (n: number) => (formatRupiah(n).length > 13 ? 22 : formatRupiah(n).length > 10 ? 26 : 32);
const MOOD_TEXT = { ok: 'Budget masih aman', warn: 'Budget hampir habis', over: 'Ada budget yang terlampaui' } as const;
const endLabel = (end: Date) => new Date(end.getTime() - 1).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

export default function Dashboard() {
  const t = useTheme();
  const { wallets, active, balances, total } = useWallets();
  const categories = useCategories();
  const { period } = useCurrentPeriod();
  const { hideBalance } = useSettings();
  const toggleHidden = () => {
    Haptics.selectionAsync();
    setSetting('hide_balance', hideBalance ? '0' : '1');
  };
  const deps = [period.start.getTime()];
  const { data: flow } = useLiveQuery(q.flowTxs(period), deps);
  const { data: budgets } = useLiveQuery(q.budgets(period), deps);
  const { data: counts } = useLiveQuery(q.walletTxCount(period), deps);
  const { data: recent } = useLiveQuery(q.history({}, 5));

  const { income, expense } = totals(flow, period);
  const budget = useMemo(() => {
    const spent = spentByCategory(flow, period);
    const limit = budgets.reduce((a, b) => a + b.limitAmount, 0);
    const used = budgets.reduce((a, b) => a + (spent.get(b.categoryId) ?? 0), 0);
    return budgetStatus(limit, used);
  }, [flow, budgets, period]);
  const speed = pace(budget.remaining, expense, period, new Date());

  // Speech bubble: each tap on the squirrel shows the next line; it hides itself after a few seconds.
  const reminderList = useReminders();
  const today = new Date(new Date().setHours(0, 0, 0, 0));
  const lines = squirrelLines({
    budget,
    perDay: speed.perDay,
    daysLeft: speed.daysLeft,
    spentToday: flow.filter((f) => f.type === 'expense' && f.occurredAt >= today).reduce((a, f) => a + f.amount, 0),
    hasAnyTx: recent.length > 0,
    reminderTitles: reminderList.map((r) => r.title),
    hidden: hideBalance,
  });
  const [say, setSay] = useState<{ n: number; on: boolean }>({ n: -1, on: false });
  // a bubble taller than two lines would touch the squirrel's ears: the forest eases down to make room
  const sceneDrop = -1.9; // fixed: the bubble is capped at 3 lines so it never reaches the squirrel
  // The squirrel talks on its own: a line for ~5 s, a quiet pause, then the next line. A tap skips to the next one.
  // Runs only while Beranda is the visible tab.
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const SHOW_MS = 5000;
  const PAUSE_MS = 3500;
  const speak = () => {
    clearTimeout(timer.current);
    setSay((s) => ({ n: s.n + 1, on: true }));
    timer.current = setTimeout(() => {
      setSay((s) => ({ ...s, on: false }));
      timer.current = setTimeout(speak, PAUSE_MS);
    }, SHOW_MS);
  };
  useFocusEffect(
    useCallback(() => {
      timer.current = setTimeout(speak, 1200);
      return () => {
        clearTimeout(timer.current);
        setSay((s) => ({ ...s, on: false }));
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  // which way did the balance move? the piggy drops a coin in or takes one out
  const [heroW, setHeroW] = useState(0);
  const prevTotal = useRef(total);
  const coin = total >= prevTotal.current ? 'in' : 'out';
  useEffect(() => {
    prevTotal.current = total;
  }, [total]);

  const catMap = new Map(categories.map((c) => [c.id, c]));
  const walletMap = new Map(wallets.map((w) => [w.id, w]));
  const txCount = new Map(counts.map((c) => [c.walletId, c.n]));

  return (
    <Screen tab>

      {/* Focal point of the app: total balance, the one figure the user opens Kas for. */}
      {/* The forest fills the whole card (clipped by its rounded corners); the text sits on the plain sky on the left. */}
      <TiltCard style={{ backgroundColor: t.primary, borderRadius: 24, height: HERO, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', inset: 0 }} onLayout={(e) => setHeroW(e.nativeEvent.layout.width)}>
          {heroW > 0 && (
            // mascot: brows show the budget mood, an acorn drops in or out when the balance changes
            <Forest width={heroW} height={HERO} shift={2.8} distance={6.2} drop={sceneDrop} mood={budget.limit > 0 ? budget.level : 'ok'} hopKey={total} acorn={coin} onTap={speak} />
          )}
        </View>
        <View pointerEvents="box-none" style={{ padding: 20, gap: 4, width: '58%' }}>
          <Row style={{ gap: 4 }}>
            <Text style={{ color: t.onPrimaryMuted, fontWeight: '600' }}>Total saldo</Text>
            {/* eye: hide every balance on screen, e.g. when opening Kas in public; remembered across launches */}
            <Pressable
              onPress={toggleHidden}
              accessibilityRole="switch"
              accessibilityState={{ checked: hideBalance }}
              accessibilityLabel={hideBalance ? 'Tampilkan saldo' : 'Sembunyikan saldo'}
              testID="toggle-balance"
              hitSlop={10}
              style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? 'rgba(255,255,255,0.15)' : 'transparent' })}
            >
              <Icon name={hideBalance ? 'eye-off-outline' : 'eye-outline'} size={20} color={t.onPrimaryMuted} />
            </Pressable>
          </Row>
          {/* shrink long figures instead of clipping them next to the mascot */}
          {hideBalance ? (
            <Text testID="total-balance" numberOfLines={1} adjustsFontSizeToFit style={{ color: t.accent, fontSize: 28, fontWeight: '800' }} accessibilityLabel="Saldo disembunyikan">
              {HIDDEN_AMOUNT}
            </Text>
          ) : (
            <RollingAmount value={total} testID="total-balance" style={{ color: t.accent, fontSize: amountSize(total), fontWeight: '800' }} />
          )}
          {budget.limit > 0 && <Text style={{ color: t.onPrimary }}>{MOOD_TEXT[budget.level]}</Text>}
        </View>
        {say.on && lines.length > 0 && (
          <Animated.View
            key={say.n}
            entering={ZoomIn.duration(220)} // no spring overshoot: a bubble that grows past its size looks clipped by the card
            exiting={FadeOut.duration(150)}
            // above the squirrel's head (it stands at ~80% of the card width), clear of the balance text on the left
            style={{ position: 'absolute', top: 10, right: '5%', width: '40%' }}
          >
            <Pressable onPress={speak} accessibilityRole="button" accessibilityLabel={`Tupai berkata: ${lines[say.n % lines.length]}. Ketuk untuk pesan berikutnya.`} accessibilityLiveRegion="polite">
              <View style={{ backgroundColor: t.card, borderRadius: 14, paddingVertical: 7, paddingHorizontal: 10, boxShadow: '0px 4px 12px rgba(0,0,0,0.2)' }}>
                <Text numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color: t.text, fontSize: 12, lineHeight: 16 }}>{lines[say.n % lines.length]}</Text>
              </View>
              {/* tail pointing down to the squirrel's head */}
              <View style={{ position: 'absolute', bottom: -5, right: '32%', width: 12, height: 12, backgroundColor: t.card, transform: [{ rotate: '45deg' }] }} />
            </Pressable>
          </Animated.View>
        )}
      </TiltCard>

      <WalletStack wallets={active} balances={balances} txCount={txCount} hidden={hideBalance} />

      {/* Spending pace: the front answers "how much may I spend today?", the back "how much do I usually spend?" */}
      <FlipCard
        label={
          budget.limit > 0
            ? [`Jatah harian ${formatRupiah(speed.perDay)} sampai ${endLabel(period.end)}`, `Rata-rata pengeluaran ${formatRupiah(speed.avgPerDay)} per hari`]
            : [`Rata-rata pengeluaran ${formatRupiah(speed.avgPerDay)} per hari`, 'Atur budget untuk melihat jatah harian']
        }
        front={
          budget.limit > 0 ? (
            <>
              <Row style={{ justifyContent: 'space-between' }}>
                <Muted>Jatah harian sampai {endLabel(period.end)}</Muted>
                <Icon name="rotate-3d-variant" size={20} color={t.muted} />
              </Row>
              <Text style={{ color: levelColor(budget.level, t), fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'] }} testID="per-day">
                {formatRupiah(speed.perDay)}
              </Text>
              <Muted>
                {speed.perDay > 0 ? `${speed.daysLeft} hari lagi, dari sisa ${formatRupiah(budget.remaining)}` : 'Budget periode ini sudah habis'}
              </Muted>
            </>
          ) : (
            <>
              <Row style={{ justifyContent: 'space-between' }}>
                <Muted>Rata-rata pengeluaran per hari</Muted>
                <Icon name="rotate-3d-variant" size={20} color={t.muted} />
              </Row>
              <Text style={{ color: t.text, fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{formatRupiah(speed.avgPerDay)}</Text>
              <Muted>Periode {fmtPeriod(period)}</Muted>
            </>
          )
        }
        back={
          budget.limit > 0 ? (
            <>
              <Muted>Rata-rata pengeluaran per hari sejauh ini</Muted>
              <Text style={{ color: t.text, fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{formatRupiah(speed.avgPerDay)}</Text>
              <Muted>{speed.avgPerDay > speed.perDay ? 'Lebih besar dari jatah harian: kurangi sedikit tiap hari.' : 'Masih di bawah jatah harian.'}</Muted>
            </>
          ) : (
            <>
              <Muted>Jatah harian</Muted>
              <Text style={{ color: t.text, fontWeight: '700' }}>Atur batas per kategori di tab Budget, lalu Kas menghitung berapa yang aman dibelanjakan tiap hari.</Text>
            </>
          )
        }
      />

      <PressScale onPress={() => router.navigate('/report')} accessibilityRole="button" accessibilityLabel={`Pemasukan ${hideBalance ? 'disembunyikan' : formatRupiah(income)}, pengeluaran ${hideBalance ? 'disembunyikan' : formatRupiah(expense)}. Buka laporan.`}>
      <Card style={{ flexDirection: 'row', gap: 0, padding: 0 }}>
        {[
          { label: 'Pemasukan', value: income, color: t.income, icon: 'arrow-down-circle' as const },
          { label: 'Pengeluaran', value: expense, color: t.expense, icon: 'arrow-up-circle' as const },
        ].map((x, i) => (
          <View key={x.label} style={{ flex: 1, padding: 16, gap: 4, borderLeftWidth: i ? 1 : 0, borderColor: t.line }}>
            <Row style={{ gap: 6 }}>
              <Icon name={x.icon} size={18} color={x.color} />
              <Muted>{x.label}</Muted>
            </Row>
            <RollingAmount value={x.value} testID={i ? 'period-expense' : 'period-income'} style={{ fontWeight: '800', fontSize: 18, color: x.color }} />
          </View>
        ))}
      </Card>
      </PressScale>

      <PressScale onPress={() => router.navigate('/budget')} accessibilityRole="button" accessibilityLabel="Buka budget">
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <Muted>Sisa budget, {fmtPeriod(period)}</Muted>
            <Icon name="chevron-right" size={22} color={t.muted} />
          </Row>
          {budget.limit > 0 ? (
            <>
              <RollingAmount value={budget.remaining} testID="budget-remaining" style={{ fontWeight: '800', fontSize: 22, color: levelColor(budget.level, t) }} />
              <Bar pct={budget.pct} color={levelColor(budget.level, t)} />
              <Muted>
                {Math.round(budget.pct)}% dari {formatRupiah(budget.limit)} terpakai
              </Muted>
            </>
          ) : (
            <Text style={{ color: t.text, fontWeight: '600' }}>Belum ada budget periode ini. Ketuk untuk mengatur batas per kategori.</Text>
          )}
        </Card>
      </PressScale>

      <Card>
        <H>Transaksi terakhir</H>
        {recent.length === 0 && <EmptyState text="Belum ada transaksi. Tekan tombol + di bawah untuk mencatat yang pertama." />}
        {recent.map((tx, i) => (
          // rows arrive one after another, so a newly saved transaction is noticed at the top of the list
          <Animated.View key={tx.id} entering={FadeInDown.delay(i * 50).duration(250)}>
            <TxRow
              t={tx}
              cat={catMap.get(tx.categoryId ?? '')}
              wallet={walletMap.get(tx.walletId)}
              toWallet={walletMap.get(tx.toWalletId ?? '')}
              onPress={() => router.push({ pathname: '/detail', params: { id: tx.id } })}
            />
          </Animated.View>
        ))}
      </Card>
    </Screen>
  );
}
