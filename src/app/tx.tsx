import DateTimePicker from '@react-native-community/datetimepicker';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { crossedLevel, formatRupiah, parseRupiah, periodFor, type TxType } from '../domain';
import { deleteTx, getTx, q, saveTx, spentInCategory } from '../db/repo';
import { fmtDate, useCategories, useSettings, useWallets } from '../hooks';
import { Button, C, Chip, Field, Muted, Row, Screen, s } from '../ui';

const TYPES: [TxType, string][] = [
  ['expense', 'Pengeluaran'],
  ['income', 'Pemasukan'],
  ['transfer', 'Transfer'],
];

export default function TxScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useMemo(() => (id ? getTx(id) : undefined), [id]);
  const { active } = useWallets();
  const categories = useCategories();
  const { lastWallet, payday } = useSettings();
  const { data: usage } = useLiveQuery(q.categoryUsage());

  const [type, setType] = useState<TxType>(existing?.type ?? 'expense');
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '');
  const [walletId, setWalletId] = useState<string | null>(existing?.walletId ?? null);
  const [toWalletId, setToWalletId] = useState<string | null>(existing?.toWalletId ?? null);
  const [categoryId, setCategoryId] = useState<string | null>(existing?.categoryId ?? null);
  const [date, setDate] = useState(existing?.occurredAt ?? new Date());
  const [note, setNote] = useState(existing?.note ?? '');
  const [picking, setPicking] = useState(false);

  // default wallet = last used, else first
  const wallet = walletId ?? (active.find((w) => w.id === lastWallet) ?? active[0])?.id ?? null;
  const used = new Map(usage.map((u) => [u.categoryId, u.n]));
  const cats = categories
    .filter((c) => c.kind === (type === 'income' ? 'income' : 'expense') && (!c.hidden || c.id === categoryId))
    .sort((a, b) => (used.get(b.id) ?? 0) - (used.get(a.id) ?? 0)); // most used first

  const n = parseRupiah(amount) ?? 0;

  const save = () => {
    const p = periodFor(date, payday);
    // budget threshold check: compare spending without vs with this transaction
    const budget = type === 'expense' && categoryId ? q.budgets(p).all().find((b) => b.categoryId === categoryId) : undefined;
    const before = budget ? spentInCategory(categoryId!, p, existing?.id) : 0;
    try {
      saveTx({ id: existing?.id, type, amount: n, walletId: wallet, toWalletId, categoryId, occurredAt: date, note });
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return Alert.alert('Belum bisa disimpan', (e as Error).message);
    }
    const crossed = budget ? crossedLevel(budget.limitAmount, before, before + n) : null;
    router.back();
    if (crossed) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      const name = categories.find((c) => c.id === categoryId)?.name;
      Alert.alert(
        crossed === 'over' ? 'Budget terlampaui' : 'Budget hampir habis',
        `${name}: ${formatRupiah(before + n)} dari ${formatRupiah(budget!.limitAmount)} (${Math.round(((before + n) / budget!.limitAmount) * 100)}%)`,
      );
    } else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const remove = () =>
    Alert.alert('Hapus transaksi?', undefined, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: () => {
          deleteTx(existing!.id);
          router.back();
        },
      },
    ]);

  return (
    <Screen>
      <Row style={{ flexWrap: 'wrap' }}>
        {TYPES.map(([t, label]) => (
          <Chip key={t} label={label} active={type === t} onPress={() => (setType(t), setCategoryId(null))} testID={`type-${t}`} />
        ))}
      </Row>

      <TextInput
        testID="amount"
        autoFocus={!existing}
        value={n ? formatRupiah(n) : ''}
        onChangeText={setAmount}
        keyboardType="number-pad"
        placeholder="Rp0"
        placeholderTextColor={C.muted}
        style={{ fontSize: 44, fontWeight: '800', color: type === 'income' ? C.income : type === 'expense' ? C.expense : C.text, paddingVertical: 8 }}
        accessibilityLabel="Nominal"
      />

      <Muted>{type === 'transfer' ? 'Dari dompet' : 'Dompet'}</Muted>
      <Row style={{ flexWrap: 'wrap' }}>
        {active.map((w) => (
          <Chip key={w.id} label={`${w.icon} ${w.name}`} active={wallet === w.id} color={w.color} onPress={() => setWalletId(w.id)} testID={`wallet-${w.id}`} />
        ))}
      </Row>

      {type === 'transfer' ? (
        <>
          <Muted>Ke dompet</Muted>
          <Row style={{ flexWrap: 'wrap' }}>
            {active
              .filter((w) => w.id !== wallet)
              .map((w) => (
                <Chip key={w.id} label={`${w.icon} ${w.name}`} active={toWalletId === w.id} color={w.color} onPress={() => setToWalletId(w.id)} testID={`to-wallet-${w.id}`} />
              ))}
          </Row>
        </>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {cats.map((c) => (
            <Pressable
              key={c.id}
              testID={`cat-${c.id}`}
              accessibilityRole="button"
              accessibilityState={{ selected: categoryId === c.id }}
              onPress={() => setCategoryId(c.id)}
              style={{ width: '23%', alignItems: 'center', padding: 8, borderRadius: 12, borderWidth: 2, borderColor: categoryId === c.id ? c.color : 'transparent', backgroundColor: C.card }}
            >
              <Text style={{ fontSize: 26 }}>{c.icon}</Text>
              <Text style={{ fontSize: 12, color: C.text, textAlign: 'center' }} numberOfLines={2}>
                {c.name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <Pressable onPress={() => setPicking(true)} style={s.input} testID="date">
        <Text style={{ color: C.text }}>📅 {fmtDate(date)}</Text>
      </Pressable>
      {picking && (
        <DateTimePicker
          value={date}
          mode="date"
          maximumDate={new Date(2100, 0, 1)}
          onValueChange={(_, d) => {
            setPicking(false);
            // keep the current time of day, change only the date
            setDate(new Date(d.getFullYear(), d.getMonth(), d.getDate(), date.getHours(), date.getMinutes()));
          }}
          onDismiss={() => setPicking(false)}
        />
      )}
      <Field placeholder="Catatan (opsional)" value={note} onChangeText={setNote} testID="note" />

      <Button title="Simpan" onPress={save} testID="save-tx" />
      {existing && <Button kind="danger" title="Hapus" onPress={remove} testID="delete-tx" />}
    </Screen>
  );
}
