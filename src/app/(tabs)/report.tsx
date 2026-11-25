// Laporan: where did this period's money go? One question, one chart: expense per category, largest first.
// Single series, so one color (theme mark) and the category name written beside each bar; no legend needed.
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { formatRupiah, nextPeriod, periodFor, prevPeriod, spentByCategory, totals } from '../../domain';
import { exportPeriodXlsx } from '../../db/export';
import { q } from '../../db/repo';
import { fmtPeriod, useCategories, useSettings } from '../../hooks';
import { useTheme } from '../../theme';
import { Bar, Button, Card, EmptyState, H, Icon, PressScale, ItemIcon, Muted, Row, Screen } from '../../ui';

export default function ReportScreen() {
  const t = useTheme();
  const { payday } = useSettings();
  const categories = useCategories();
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);

  let period = periodFor(new Date(), payday);
  for (let i = 0; i < Math.abs(offset); i++) period = offset < 0 ? prevPeriod(period, payday) : nextPeriod(period, payday);
  const prev = prevPeriod(period, payday);

  const { data: flow } = useLiveQuery(q.flowTxs(period), [period.start.getTime()]);
  const { data: prevFlow } = useLiveQuery(q.flowTxs(prev), [prev.start.getTime()]);

  const { expense, income } = totals(flow, period);
  const prevExpense = totals(prevFlow, prev).expense;
  const diff = expense - prevExpense;
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const rows = [...spentByCategory(flow, period)].sort((a, b) => b[1] - a[1]);
  const max = rows[0]?.[1] ?? 0;

  const exportXlsx = async () => {
    setBusy(true);
    try {
      await exportPeriodXlsx(period);
    } catch (e) {
      Alert.alert('Belum bisa diekspor', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen tab>
      <Row style={{ justifyContent: 'space-between' }}>
        <Pressable onPress={() => setOffset((o) => o - 1)} accessibilityRole="button" accessibilityLabel="Periode sebelumnya" hitSlop={12} testID="report-prev">
          <Icon name="chevron-left" size={28} color={t.text} />
        </Pressable>
        <H>{fmtPeriod(period)}</H>
        <Pressable onPress={() => setOffset((o) => o + 1)} accessibilityRole="button" accessibilityLabel="Periode berikutnya" hitSlop={12} testID="report-next">
          <Icon name="chevron-right" size={28} color={t.text} />
        </Pressable>
      </Row>

      <Card>
        <Muted>Total pengeluaran</Muted>
        <Text style={{ color: t.expense, fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] }} testID="report-expense">
          {formatRupiah(expense)}
        </Text>
        {prevExpense > 0 && (
          <Row style={{ gap: 6 }}>
            <Icon name={diff > 0 ? 'trending-up' : 'trending-down'} size={18} color={diff > 0 ? t.expense : t.income} />
            <Text style={{ color: t.text }}>
              {diff === 0 ? 'Sama dengan periode lalu' : `${formatRupiah(Math.abs(diff))} ${diff > 0 ? 'lebih banyak' : 'lebih sedikit'} dari periode lalu`}
            </Text>
          </Row>
        )}
        <Muted>Pemasukan periode ini: {formatRupiah(income)}</Muted>
      </Card>

      <Card>
        <H>Pengeluaran per kategori</H>
        {rows.length === 0 ? (
          <EmptyState text="Belum ada pengeluaran di periode ini. Catat lewat tombol + di bawah, grafiknya muncul di sini." />
        ) : (
          rows.map(([id, amount], i) => {
            const c = catMap.get(id);
            const share = Math.round((amount / expense) * 100);
            return (
              // keyed by period: switching periods replays the cascade, so the new data visibly replaces the old
              <Animated.View key={`${period.start.getTime()}-${id}`} entering={FadeInDown.delay(i * 40).duration(240)}>
              <PressScale
                onPress={() =>
                  router.navigate({ pathname: '/history', params: { categoryId: id, from: String(period.start.getTime()), to: String(period.end.getTime()) } })
                }
                accessibilityRole="button"
                accessibilityLabel={`${c?.name ?? 'Tanpa kategori'}, ${formatRupiah(amount)}, ${share} persen dari pengeluaran. Ketuk untuk melihat transaksinya.`}
                style={{ gap: 6, paddingVertical: 8 }}
              >
                <Row style={{ gap: 10 }}>
                  <ItemIcon icon={c?.icon ?? 'tag'} color={c?.color ?? t.muted} size={28} />
                  <Text style={{ color: t.text, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                    {c?.name ?? 'Tanpa kategori'}
                  </Text>
                  <Text style={{ color: t.text, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{formatRupiah(amount)}</Text>
                  <Text style={{ color: t.muted, width: 40, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{share}%</Text>
                </Row>
                {/* bar length is relative to the largest category, so the top bar always fills the row */}
                <Bar pct={(amount / max) * 100} color={t.mark} />
              </PressScale>
              </Animated.View>
            );
          })
        )}
      </Card>

      {busy ? (
        <ActivityIndicator color={t.primary} accessibilityLabel="Menyiapkan file Excel" />
      ) : (
        <Button icon="microsoft-excel" title="Ekspor periode ini ke Excel" onPress={exportXlsx} testID="export-xlsx" />
      )}
      <View style={{ height: 4 }} />
      <Muted>File .xlsx berisi semua transaksi periode ini (tanggal, jenis, kategori, dompet, nominal, catatan), bisa dibuka di Excel atau Google Sheets.</Muted>
    </Screen>
  );
}
