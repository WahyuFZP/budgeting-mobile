// Empty sections are one line of text, not the 3D EmptyState: two GL scenes on one screen cost battery for nothing.
// Bills first (money that leaves on a date), soonest due on top; templates below. Each row has its one action
// (Lunas / Catat) on the right; tapping the rest of the row opens the form.
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { billState, formatRupiah } from '../domain';
import type { Rule } from '../db/repo';
import { recordRule, useCategories, useRules } from '../hooks';
import { useTheme } from '../theme';
import { Button, Card, H, ItemIcon, Muted, Row, Screen } from '../ui';

export default function RecurringScreen() {
  const t = useTheme();
  const { bills, templates } = useRules();
  const categories = useCategories();
  const cat = new Map(categories.map((c) => [c.id, c]));
  const now = new Date();

  const due = (rule: Rule) => {
    const { state, days } = billState(rule.nextRunAt, now);
    if (state === 'late') return { text: `Terlambat ${-days} hari`, color: t.expense };
    if (state === 'today') return { text: 'Jatuh tempo hari ini', color: t.warn };
    if (state === 'soon') return { text: `${days} hari lagi`, color: t.warn };
    return { text: rule.nextRunAt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }), color: t.muted };
  };

  const row = (rule: Rule, name: string, amount: number, categoryId: string | null, sub: { text: string; color: string }, action: string, i: number) => (
    <Animated.View key={rule.id} entering={FadeInDown.delay(i * 40).duration(220)}>
      <Row style={{ gap: 12, paddingVertical: 6 }}>
        <Pressable
          onPress={() => router.push({ pathname: '/rule', params: { id: rule.id } })}
          accessibilityRole="button"
          accessibilityLabel={`${name}, ${formatRupiah(amount)}, ${sub.text}. Ketuk untuk mengubah.`}
          testID={`rule-${rule.id}`}
          style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, opacity: pressed ? 0.6 : 1 })}
        >
          <ItemIcon icon={cat.get(categoryId ?? '')?.icon ?? 'swap-horizontal'} color={cat.get(categoryId ?? '')?.color ?? t.muted} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontWeight: '700' }} numberOfLines={1}>
              {name}
            </Text>
            <Text style={{ color: t.muted, fontVariant: ['tabular-nums'] }} numberOfLines={1}>
              {formatRupiah(amount)} · <Text style={{ color: sub.color, fontWeight: '600' }}>{sub.text}</Text>
            </Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => recordRule(rule, action === 'Lunas' ? 'Tagihan dicatat lunas' : 'Transaksi dicatat')}
          accessibilityRole="button"
          accessibilityLabel={`${action}: ${name}`}
          testID={`run-${rule.id}`}
          style={({ pressed }) => ({ minHeight: 44, minWidth: 72, paddingHorizontal: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: t.primary, opacity: pressed ? 0.8 : 1 })}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>{action}</Text>
        </Pressable>
      </Row>
    </Animated.View>
  );

  return (
    <Screen>
      <Card>
        <H>Tagihan bulanan</H>
        {bills.length === 0 ? (
          <Muted>Belum ada tagihan. Tambahkan kos, listrik, wifi, atau cicilan supaya Kas mengingatkan sebelum jatuh tempo.</Muted>
        ) : (
          bills.map((b, i) => row(b.rule, b.tpl.name, b.tpl.amount, b.tpl.categoryId, due(b.rule), 'Lunas', i))
        )}
        <Button kind="ghost" icon="plus" title="Tambah tagihan" onPress={() => router.push({ pathname: '/rule', params: { kind: 'bill' } })} testID="add-bill" />
      </Card>

      <Card>
        <H>Template cepat</H>
        <Muted>Transaksi yang sering berulang, dicatat dengan satu ketukan dari Beranda.</Muted>
        {templates.length === 0 ? (
          <Muted>Belum ada template. Contoh: kopi pagi, bensin, parkir, atau sisihkan ke tabungan.</Muted>
        ) : (
          templates.map((x, i) => row(x.rule, x.tpl.name, x.tpl.amount, x.tpl.categoryId, { text: x.tpl.type === 'income' ? 'Pemasukan' : x.tpl.type === 'transfer' ? 'Transfer' : 'Pengeluaran', color: t.muted }, 'Catat', i))
        )}
        <Button kind="ghost" icon="plus" title="Tambah template" onPress={() => router.push({ pathname: '/rule', params: { kind: 'template' } })} testID="add-template" />
      </Card>
    </Screen>
  );
}
