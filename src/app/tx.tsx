import DateTimePicker from '@react-native-community/datetimepicker';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { crossedLevel, formatRupiah, parseRupiah, periodFor, type TxType } from '../domain';
import { deleteTx, getTx, q, saveTx, spentInCategory } from '../db/repo';
import { fmtDate, useCategories, useSettings, useWallets } from '../hooks';
import { useTheme } from '../theme';
import { confirm, toast } from '../feedback';
import { Button, Chip, Field, Icon, ItemIcon, Muted, Row, Screen, s, type IconName } from '../ui';

const TYPES: [TxType, string, IconName][] = [
  ['expense', 'Pengeluaran', 'arrow-up-circle'],
  ['income', 'Pemasukan', 'arrow-down-circle'],
  ['transfer', 'Transfer', 'swap-horizontal-circle'],
];

export default function TxScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const t = useTheme();
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
      return toast('Belum bisa disimpan', 'error', (e as Error).message);
    }
    const crossed = budget ? crossedLevel(budget.limitAmount, before, before + n) : null;
    router.back();
    if (crossed) {
      const name = categories.find((c) => c.id === categoryId)?.name;
      toast(
        crossed === 'over' ? `Budget ${name} terlampaui` : `Budget ${name} hampir habis`,
        'warn',
        `${formatRupiah(before + n)} dari ${formatRupiah(budget!.limitAmount)} (${Math.round(((before + n) / budget!.limitAmount) * 100)}%)`,
      );
    } else toast(existing ? 'Transaksi diperbarui' : 'Transaksi disimpan', 'success', `${type === 'income' ? 'Pemasukan' : type === 'expense' ? 'Pengeluaran' : 'Transfer'} ${formatRupiah(n)}`);
  };

  const remove = async () => {
    if (!(await confirm({ title: 'Hapus transaksi?', body: `${formatRupiah(existing!.amount)} akan dihapus dari saldo dan riwayat.`, confirm: 'Hapus', destructive: true }))) return;
    deleteTx(existing!.id);
    router.back();
    toast('Transaksi dihapus', 'info');
  };

  // Date shortcuts: most entries are today or yesterday, so those are one tap; anything else opens the picker.
  const dayOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = dayOf(new Date());
  const isToday = dayOf(date) === today;
  const isYesterday = dayOf(date) === today - 86_400_000;
  const setDay = (offset: number) => {
    const d = new Date();
    setDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset, date.getHours(), date.getMinutes()));
  };

  return (
    <Screen>
      {/* Save is also in the header: reachable even while the number keyboard covers the bottom of the form */}
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={save} accessibilityRole="button" testID="save-tx-header" hitSlop={8} style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8, opacity: pressed ? 0.6 : 1 })}>
              <Text style={{ color: t.mark, fontWeight: '800', fontSize: 16 }}>Simpan</Text>
            </Pressable>
          ),
        }}
      />
      <Row style={{ flexWrap: 'wrap' }}>
        {TYPES.map(([k, label, icon]) => (
          <Chip key={k} label={label} icon={icon} active={type === k} onPress={() => (setType(k), setCategoryId(null))} testID={`type-${k}`} />
        ))}
      </Row>

      <TextInput
        testID="amount"
        autoFocus={!existing}
        value={n ? formatRupiah(n) : ''}
        onChangeText={setAmount}
        keyboardType="number-pad"
        placeholder="Rp0"
        placeholderTextColor={t.muted}
        style={{ fontSize: 44, fontWeight: '800', fontVariant: ['tabular-nums'], color: type === 'income' ? t.income : type === 'expense' ? t.expense : t.text, paddingVertical: 8 }}
        accessibilityLabel="Nominal"
      />
      {/* quick amounts for the most common round figures: one tap instead of five digits */}
      <Row style={{ flexWrap: 'wrap', gap: 6, marginTop: -4 }}>
        {[10_000, 20_000, 50_000, 100_000].map((v) => (
          <Chip key={v} label={`${v / 1000}rb`} active={n === v} onPress={() => setAmount(String(v))} testID={`quick-${v}`} />
        ))}
      </Row>

      <Muted>{type === 'transfer' ? 'Dari dompet' : 'Dompet'}</Muted>
      {active.length === 0 && (
        <Button kind="ghost" icon="plus" title="Belum ada dompet. Tambah dompet dulu" onPress={() => router.push('/wallet')} testID="tx-add-wallet" />
      )}
      <Row style={{ flexWrap: 'wrap' }}>
        {active.map((w) => (
          <Chip key={w.id} label={w.name} icon={w.icon as IconName} active={wallet === w.id} color={w.color} onPress={() => setWalletId(w.id)} testID={`wallet-${w.id}`} />
        ))}
      </Row>

      {type === 'transfer' ? (
        <>
          <Muted>Ke dompet</Muted>
          <Row style={{ flexWrap: 'wrap' }}>
            {active
              .filter((w) => w.id !== wallet)
              .map((w) => (
                <Chip key={w.id} label={w.name} icon={w.icon as IconName} active={toWalletId === w.id} color={w.color} onPress={() => setToWalletId(w.id)} testID={`to-wallet-${w.id}`} />
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
              style={{ width: '23%', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 12, borderWidth: 2, borderColor: categoryId === c.id ? t.mark : 'transparent', backgroundColor: t.card }}
            >
              <ItemIcon icon={c.icon} color={c.color} />
              {/* 11px + slim side padding fits "Transportasi" on one line instead of splitting the word */}
              <Text style={{ fontSize: 11, color: t.text, textAlign: 'center', fontWeight: categoryId === c.id ? '700' : '400' }} numberOfLines={2}>
                {c.name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <Muted>Tanggal</Muted>
      <Row style={{ flexWrap: 'wrap', gap: 6 }}>
        <Chip label="Hari ini" active={isToday} onPress={() => setDay(0)} testID="date-today" />
        <Chip label="Kemarin" active={isYesterday} onPress={() => setDay(1)} testID="date-yesterday" />
        <Chip
          icon="calendar-month"
          label={isToday || isYesterday ? 'Pilih tanggal' : fmtDate(date)}
          active={!isToday && !isYesterday}
          onPress={() => setPicking(true)}
          testID="date"
        />
      </Row>
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

      <Button title="Simpan transaksi" icon="check" onPress={save} testID="save-tx" />
      {existing && <Button kind="danger" title="Hapus transaksi" icon="delete-outline" onPress={remove} testID="delete-tx" />}
    </Screen>
  );
}
