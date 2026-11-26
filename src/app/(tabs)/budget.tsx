import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { budgetStatus, formatRupiah, nextPeriod, pace, parseRupiah, periodFor, prevPeriod, spentByCategory, totals } from '../../domain';
import { copyBudgets, q, setBudget } from '../../db/repo';
import { fmtPeriod, useCategories, useSettings } from '../../hooks';
import { useTheme } from '../../theme';
import { Bar, Button, Card, H, Icon, ItemIcon, Muted, PressScale, Row, Screen, levelColor } from '../../ui';
import { toast } from '../../feedback';

// Status in words too, so it never depends on seeing the bar color.
const LEVEL_TEXT = { ok: 'Aman', warn: 'Hampir habis', over: 'Terlampaui' } as const;

export default function BudgetScreen() {
  const t = useTheme();
  const { payday } = useSettings();
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  let period = periodFor(new Date(), payday);
  for (let i = 0; i < Math.abs(offset); i++) period = offset < 0 ? prevPeriod(period, payday) : nextPeriod(period, payday);

  const deps = [period.start.getTime()];
  const prev = prevPeriod(period, payday);
  const { data: budgets } = useLiveQuery(q.budgets(period), deps);
  const { data: prevBudgets } = useLiveQuery(q.budgets(prev), [prev.start.getTime()]);
  const { data: flow } = useLiveQuery(q.flowTxs(period), deps);
  const categories = useCategories().filter((c) => c.kind === 'expense' && !c.hidden);
  const spent = spentByCategory(flow, period);
  const limits = new Map(budgets.map((b) => [b.categoryId, b.limitAmount]));
  const prevLimits = new Map(prevBudgets.map((b) => [b.categoryId, b.limitAmount]));
  const draftTotal = categories.reduce((a, c) => a + (parseRupiah(draft[c.id] ?? '') ?? 0), 0);
  const { income } = totals(flow, period);

  const startEdit = () => {
    setDraft(Object.fromEntries(categories.map((c) => [c.id, limits.get(c.id) ? String(limits.get(c.id)) : ''])));
    setEditing(true);
  };
  const saveAll = () => {
    for (const c of categories) setBudget(c.id, period, parseRupiah(draft[c.id] ?? '') ?? 0);
    setEditing(false);
    toast('Budget disimpan', 'success', `Total ${formatRupiah(draftTotal)} untuk ${fmtPeriod(period)}`);
  };
  const copyLast = () => {
    const n = copyBudgets(prevPeriod(period, payday), period);
    toast(n ? `${n} budget disalin dari periode lalu` : 'Tidak ada budget baru untuk disalin', n ? 'success' : 'info');
  };

  return (
    <Screen tab>
      <Row style={{ justifyContent: 'space-between' }}>
        <Pressable onPress={() => setOffset((o) => o - 1)} accessibilityRole="button" accessibilityLabel="Periode sebelumnya" hitSlop={12} testID="period-prev">
          <Icon name="chevron-left" size={28} color={t.text} />
        </Pressable>
        <H>{fmtPeriod(period)}</H>
        <Pressable onPress={() => setOffset((o) => o + 1)} accessibilityRole="button" accessibilityLabel="Periode berikutnya" hitSlop={12} testID="period-next">
          <Icon name="chevron-right" size={28} color={t.text} />
        </Pressable>
      </Row>

      {editing ? (
        <>
          {/* live total, so the user sees the plan add up while typing */}
          <Card style={{ backgroundColor: t.primary }}>
            <Text style={{ color: t.onPrimaryMuted, fontWeight: '600' }}>Total budget periode ini</Text>
            <Text style={{ color: t.accent, fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'] }} testID="budget-total">
              {formatRupiah(draftTotal)}
            </Text>
            {income > 0 && (
              <Text style={{ color: t.onPrimary }}>
                {draftTotal > income ? `Lebih besar ${formatRupiah(draftTotal - income)} dari pemasukan periode ini` : `Pemasukan periode ini ${formatRupiah(income)}`}
              </Text>
            )}
          </Card>
          {categories.map((c, i) => {
            const was = prevLimits.get(c.id);
            const value = draft[c.id] ? formatRupiah(parseRupiah(draft[c.id]) ?? 0) : '';
            return (
              <Animated.View key={c.id} entering={FadeInDown.delay(i * 35).duration(220)}>
                <Card style={{ gap: 10 }}>
                  <Row style={{ gap: 12 }}>
                    <ItemIcon icon={c.icon} color={c.color} size={38} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: t.text, fontWeight: '700' }} numberOfLines={1}>
                        {c.name}
                      </Text>
                      <Text style={{ color: t.muted, fontSize: 13 }}>Terpakai {formatRupiah(spent.get(c.id) ?? 0)}</Text>
                    </View>
                    <TextInput
                      value={value}
                      onChangeText={(v) => setDraft((d) => ({ ...d, [c.id]: v }))}
                      placeholder="Tanpa batas"
                      placeholderTextColor={t.muted}
                      keyboardType="number-pad"
                      accessibilityLabel={`Batas ${c.name}`}
                      testID={`limit-${c.id}`}
                      style={{ width: 140, textAlign: 'right', fontSize: 16, fontWeight: '700', color: t.text, backgroundColor: t.bg, borderWidth: 1, borderColor: t.line, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontVariant: ['tabular-nums'] }}
                    />
                  </Row>
                  {was && !draft[c.id] && (
                    <Pressable
                      onPress={() => setDraft((d) => ({ ...d, [c.id]: String(was) }))}
                      accessibilityRole="button"
                      accessibilityLabel={`Pakai batas periode lalu ${formatRupiah(was)}`}
                      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 36, opacity: pressed ? 0.6 : 1 })}
                    >
                      <Icon name="history" size={18} color={t.mark} />
                      <Text style={{ color: t.mark, fontWeight: '600' }}>Pakai periode lalu: {formatRupiah(was)}</Text>
                    </Pressable>
                  )}
                </Card>
              </Animated.View>
            );
          })}
          <Button title="Simpan budget" icon="check" onPress={saveAll} testID="save-budget" />
          <Button kind="ghost" title="Batal" onPress={() => setEditing(false)} testID="cancel-budget" />
        </>
      ) : (
        <>
          <Button title={budgets.length ? 'Ubah budget' : 'Atur budget periode ini'} onPress={startEdit} testID="edit-budget" />
          <Button kind="ghost" title="Salin dari periode lalu" onPress={copyLast} testID="copy-budget" />
          {budgets.length === 0 && <Muted>Belum ada budget di periode ini.</Muted>}
          {categories
            .filter((c) => limits.has(c.id))
            .map((c) => {
              const st = budgetStatus(limits.get(c.id)!, spent.get(c.id) ?? 0);
              const color = levelColor(st.level, t);
              const textColor = st.level === 'over' ? t.expense : st.level === 'warn' ? t.warn : t.income;
              const expanded = open === c.id;
              const daily = offset === 0 ? pace(st.remaining, st.spent, period, new Date()) : null;
              return (
                // tap to expand: the card grows in place (layout transition) to show the daily allowance for this category
                <Animated.View key={c.id} layout={LinearTransition.duration(220)}>
                <PressScale
                  onPress={() => setOpen(expanded ? null : c.id)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  accessibilityLabel={`${c.name}, ${LEVEL_TEXT[st.level]}, ${Math.round(st.pct)} persen terpakai`}
                  testID={`budget-card-${c.id}`}
                >
                <Card>
                  <Row style={{ gap: 12 }}>
                    <ItemIcon icon={c.icon} color={c.color} size={36} />
                    <Text style={{ fontWeight: '700', color: t.text, flex: 1 }} numberOfLines={1}>
                      {c.name}
                    </Text>
                    <Text style={{ fontWeight: '700', color: textColor }}>
                      {LEVEL_TEXT[st.level]}, {Math.round(st.pct)}%
                    </Text>
                  </Row>
                  <Bar pct={st.pct} color={color} />
                  <Muted>
                    {formatRupiah(st.spent)} dari {formatRupiah(st.limit)}, {st.remaining >= 0 ? `sisa ${formatRupiah(st.remaining)}` : `lewat ${formatRupiah(-st.remaining)}`}
                  </Muted>
                  {expanded && (
                    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(120)} style={{ gap: 8, paddingTop: 8, borderTopWidth: 1, borderColor: t.line }}>
                      {daily && (
                        <Row style={{ justifyContent: 'space-between' }}>
                          <Muted>Jatah per hari ({daily.daysLeft} hari lagi)</Muted>
                          <Text style={{ color: t.text, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{formatRupiah(daily.perDay)}</Text>
                        </Row>
                      )}
                      {daily && (
                        <Row style={{ justifyContent: 'space-between' }}>
                          <Muted>Rata-rata terpakai per hari</Muted>
                          <Text style={{ color: t.text, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{formatRupiah(daily.avgPerDay)}</Text>
                        </Row>
                      )}
                      <Button
                        kind="ghost"
                        icon="format-list-bulleted"
                        title="Lihat transaksinya"
                        onPress={() =>
                          router.navigate({ pathname: '/history', params: { categoryId: c.id, from: String(period.start.getTime()), to: String(period.end.getTime()) } })
                        }
                      />
                    </Animated.View>
                  )}
                </Card>
                </PressScale>
                </Animated.View>
              );
            })}
        </>
      )}
    </Screen>
  );
}
