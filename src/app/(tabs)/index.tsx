import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { lazy, Suspense, useEffect, useMemo, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { FlipCard, WalletCarousel } from '../../cards';
import { budgetStatus, formatRupiah, pace, spentByCategory, totals } from '../../domain';
import { q } from '../../db/repo';
import { fmtPeriod, useCategories, useCurrentPeriod, useSettings, useWallets } from '../../hooks';
import { useTheme } from '../../theme';
import { Bar, Card, EmptyState, H, Icon, Muted, PressScale, PiggyBoundary, PiggyFallback, RollingAmount, Row, Screen, TiltCard, TxRow, levelColor } from '../../ui';

const Piggy3D = lazy(() => import('../../Piggy3D'));
const DAY = 86_400_000;
const PIGGY = 124;
const amountSize = (n: number) => (formatRupiah(n).length > 13 ? 22 : formatRupiah(n).length > 10 ? 28 : 34);
const MOOD_TEXT = { ok: 'Budget masih aman', warn: 'Budget hampir habis', over: 'Ada budget yang terlampaui' } as const;
const endLabel = (end: Date) => new Date(end.getTime() - 1).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

export default function Dashboard() {
  const t = useTheme();
  const { wallets, active, balances, total } = useWallets();
  const categories = useCategories();
  const { lastBackup } = useSettings();
  const { period } = useCurrentPeriod();
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

  // which way did the balance move? the piggy drops a coin in or takes one out
  const prevTotal = useRef(total);
  const coin = total >= prevTotal.current ? 'in' : 'out';
  useEffect(() => {
    prevTotal.current = total;
  }, [total]);

  const catMap = new Map(categories.map((c) => [c.id, c]));
  const walletMap = new Map(wallets.map((w) => [w.id, w]));
  const txCount = new Map(counts.map((c) => [c.walletId, c.n]));
  const since = lastBackup ?? Math.min(...wallets.map((w) => w.createdAt.getTime()), Date.now());
  const needBackup = Date.now() - since > 30 * DAY;

  return (
    <Screen tab>
      {needBackup && (
        <Pressable onPress={() => router.push('/backup')} testID="backup-reminder" accessibilityRole="button">
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: t.warn }}>
            <Icon name="backup-restore" size={26} color={t.warn} />
            <Text style={{ color: t.text, flex: 1 }}>
              <Text style={{ fontWeight: '700' }}>Sudah 30 hari tanpa backup.</Text> Ketuk untuk menyimpan salinan data.
            </Text>
          </Card>
        </Pressable>
      )}

      {/* Focal point of the app: total balance, the one figure the user opens Kas for. */}
      <TiltCard style={{ backgroundColor: t.primary, borderRadius: 24, padding: 20 }}>
        <Row style={{ alignItems: 'center' }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: t.onPrimaryMuted, fontWeight: '600' }}>Total saldo</Text>
            {/* shrink long figures instead of clipping them next to the mascot */}
            <RollingAmount value={total} testID="total-balance" style={{ color: t.accent, fontSize: amountSize(total), fontWeight: '800' }} />
            {budget.limit > 0 && <Text style={{ color: t.onPrimary }}>{MOOD_TEXT[budget.level]}</Text>}
          </View>
          {/* mascot: brows show the budget mood, a coin drops in or out when the balance changes */}
          <PiggyBoundary size={PIGGY}>
            <Suspense fallback={<PiggyFallback size={PIGGY} />}>
              <Piggy3D size={PIGGY} mood={budget.limit > 0 ? budget.level : 'ok'} hopKey={total} coin={coin} />
            </Suspense>
          </PiggyBoundary>
        </Row>
      </TiltCard>

      <WalletCarousel wallets={active} balances={balances} txCount={txCount} />

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
              onPress={() => router.push({ pathname: '/tx', params: { id: tx.id } })}
            />
          </Animated.View>
        ))}
      </Card>
    </Screen>
  );
}
