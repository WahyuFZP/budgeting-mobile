import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useState } from 'react';
import { Alert, Pressable, Text } from 'react-native';
import { budgetStatus, formatRupiah, nextPeriod, parseRupiah, periodFor, prevPeriod, spentByCategory } from '../../domain';
import { copyBudgets, q, setBudget } from '../../db/repo';
import { fmtPeriod, useCategories, useSettings } from '../../hooks';
import { Bar, Button, C, Card, Field, H, Muted, Row, Screen, levelColor } from '../../ui';

export default function BudgetScreen() {
  const { payday } = useSettings();
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  let period = periodFor(new Date(), payday);
  for (let i = 0; i < Math.abs(offset); i++) period = offset < 0 ? prevPeriod(period, payday) : nextPeriod(period, payday);

  const deps = [period.start.getTime()];
  const { data: budgets } = useLiveQuery(q.budgets(period), deps);
  const { data: flow } = useLiveQuery(q.flowTxs(period), deps);
  const categories = useCategories().filter((c) => c.kind === 'expense' && !c.hidden);
  const spent = spentByCategory(flow, period);
  const limits = new Map(budgets.map((b) => [b.categoryId, b.limitAmount]));

  const startEdit = () => {
    setDraft(Object.fromEntries(categories.map((c) => [c.id, limits.get(c.id) ? String(limits.get(c.id)) : ''])));
    setEditing(true);
  };
  const saveAll = () => {
    for (const c of categories) setBudget(c.id, period, parseRupiah(draft[c.id] ?? '') ?? 0);
    setEditing(false);
  };
  const copyLast = () => {
    const n = copyBudgets(prevPeriod(period, payday), period);
    Alert.alert(n ? `${n} budget disalin dari periode lalu` : 'Tidak ada budget baru untuk disalin');
  };

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <Pressable onPress={() => setOffset((o) => o - 1)} accessibilityLabel="Periode sebelumnya" hitSlop={12} testID="period-prev">
          <Text style={{ fontSize: 22 }}>‹</Text>
        </Pressable>
        <H>{fmtPeriod(period)}</H>
        <Pressable onPress={() => setOffset((o) => o + 1)} accessibilityLabel="Periode berikutnya" hitSlop={12} testID="period-next">
          <Text style={{ fontSize: 22 }}>›</Text>
        </Pressable>
      </Row>

      {editing ? (
        <>
          {categories.map((c) => (
            <Field
              key={c.id}
              label={`${c.icon} ${c.name}`}
              placeholder="Tanpa batas"
              keyboardType="number-pad"
              value={draft[c.id] ? formatRupiah(parseRupiah(draft[c.id]) ?? 0) : ''}
              onChangeText={(v) => setDraft((d) => ({ ...d, [c.id]: v }))}
              testID={`limit-${c.id}`}
            />
          ))}
          <Button title="Simpan budget" onPress={saveAll} testID="save-budget" />
          <Button kind="ghost" title="Batal" onPress={() => setEditing(false)} />
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
              const color = levelColor(st.level);
              return (
                <Card key={c.id}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Text style={{ fontWeight: '700', color: C.text }}>
                      {c.icon} {c.name}
                    </Text>
                    <Text style={{ fontWeight: '700', color }}>{Math.round(st.pct)}%</Text>
                  </Row>
                  <Bar pct={st.pct} color={color} />
                  <Muted>
                    {formatRupiah(st.spent)} / {formatRupiah(st.limit)} · {st.remaining >= 0 ? `sisa ${formatRupiah(st.remaining)}` : `lewat ${formatRupiah(-st.remaining)}`}
                  </Muted>
                </Card>
              );
            })}
        </>
      )}
    </Screen>
  );
}
