import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { budgetStatus, formatRupiah, spentByCategory, totals } from '../../domain';
import { q } from '../../db/repo';
import { fmtPeriod, useCategories, useCurrentPeriod, useSettings, useWallets } from '../../hooks';
import { Bar, C, Card, H, Muted, Row, Screen, TxRow, levelColor, s } from '../../ui';

const DAY = 86_400_000;

export default function Dashboard() {
  const { wallets, active, balances, total } = useWallets();
  const categories = useCategories();
  const { lastBackup } = useSettings();
  const { period } = useCurrentPeriod();
  const { data: flow } = useLiveQuery(q.flowTxs(period), [period.start.getTime()]);
  const { data: budgets } = useLiveQuery(q.budgets(period), [period.start.getTime()]);
  const { data: recent } = useLiveQuery(q.history({}, 5));

  const { income, expense } = totals(flow, period);
  const budget = useMemo(() => {
    const spent = spentByCategory(flow, period);
    const limit = budgets.reduce((a, b) => a + b.limitAmount, 0);
    const used = budgets.reduce((a, b) => a + (spent.get(b.categoryId) ?? 0), 0);
    return budgetStatus(limit, used);
  }, [flow, budgets, period]);

  const catMap = new Map(categories.map((c) => [c.id, c]));
  const walletMap = new Map(wallets.map((w) => [w.id, w]));
  const since = lastBackup ?? Math.min(...wallets.map((w) => w.createdAt.getTime()), Date.now());
  const needBackup = Date.now() - since > 30 * DAY;

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        {needBackup && (
          <Pressable onPress={() => router.push('/backup')} testID="backup-reminder">
            <Card style={{ backgroundColor: '#FFF4E0' }}>
              <Text style={{ color: C.warn, fontWeight: '700' }}>Sudah 30 hari tanpa backup. Ketuk untuk backup sekarang.</Text>
            </Card>
          </Pressable>
        )}
        <Card>
          <Muted>Total saldo</Muted>
          <Text style={s.big} testID="total-balance">
            {formatRupiah(total)}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {active.map((w) => (
              <View key={w.id} style={{ padding: 10, borderRadius: 12, backgroundColor: C.bg, borderLeftWidth: 4, borderLeftColor: w.color }}>
                <Text style={s.muted}>
                  {w.icon} {w.name}
                </Text>
                <Text style={{ fontWeight: '700', color: C.text }}>{formatRupiah(balances.get(w.id) ?? 0)}</Text>
              </View>
            ))}
          </ScrollView>
        </Card>

        <Row>
          <Card style={{ flex: 1 }}>
            <Muted>Pengeluaran</Muted>
            <Text style={{ fontWeight: '800', fontSize: 18, color: C.expense }} testID="period-expense">
              {formatRupiah(expense)}
            </Text>
          </Card>
          <Card style={{ flex: 1 }}>
            <Muted>Pemasukan</Muted>
            <Text style={{ fontWeight: '800', fontSize: 18, color: C.income }}>{formatRupiah(income)}</Text>
          </Card>
        </Row>

        <Pressable onPress={() => router.navigate('/budget')}>
          <Card>
            <Muted>Sisa budget · {fmtPeriod(period)}</Muted>
            {budget.limit > 0 ? (
              <>
                <Text style={{ fontWeight: '800', fontSize: 22, color: levelColor(budget.level) }} testID="budget-remaining">
                  {formatRupiah(budget.remaining)}
                </Text>
                <Bar pct={budget.pct} color={levelColor(budget.level)} />
                <Muted>
                  {Math.round(budget.pct)}% dari {formatRupiah(budget.limit)} terpakai
                </Muted>
              </>
            ) : (
              <Text style={{ color: C.accent, fontWeight: '600' }}>Belum ada budget. Ketuk untuk mengatur.</Text>
            )}
          </Card>
        </Pressable>

        <Card>
          <H>Transaksi terakhir</H>
          {recent.length === 0 && <Muted>Belum ada transaksi. Ketuk + untuk mencatat.</Muted>}
          {recent.map((t) => (
            <TxRow
              key={t.id}
              t={t}
              cat={catMap.get(t.categoryId ?? '')}
              wallet={walletMap.get(t.walletId)}
              toWallet={walletMap.get(t.toWalletId ?? '')}
              onPress={() => router.push({ pathname: '/tx', params: { id: t.id } })}
            />
          ))}
        </Card>
      </Screen>
      <Pressable
        testID="fab-add"
        accessibilityLabel="Catat transaksi"
        accessibilityRole="button"
        onPress={() => router.push('/tx')}
        style={({ pressed }) => ({
          position: 'absolute',
          right: 20,
          bottom: 20,
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: C.accent,
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 4,
          shadowColor: '#000',
          shadowOpacity: 0.2,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          transform: [{ scale: pressed ? 0.94 : 1 }],
        })}
      >
        <Text style={{ color: '#fff', fontSize: 34, lineHeight: 38 }}>+</Text>
      </Pressable>
    </View>
  );
}
