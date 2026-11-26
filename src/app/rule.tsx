// One form for both kinds: a monthly bill (has a due day, reminds and records with "Lunas")
// and a template (no schedule, recorded with one tap from Beranda). Same fields as a transaction.
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { formatRupiah, parseRupiah, type TxType } from '../domain';
import { deleteRule, q, ruleTemplate, saveRule } from '../db/repo';
import { useCategories, useSettings, useWallets } from '../hooks';
import { useTheme } from '../theme';
import { toast } from '../feedback';
import { Button, Chip, Field, ItemIcon, Muted, Row, Screen, type IconName } from '../ui';

const TYPES: [TxType, string, IconName][] = [
  ['expense', 'Pengeluaran', 'arrow-up-circle'],
  ['income', 'Pemasukan', 'arrow-down-circle'],
  ['transfer', 'Transfer', 'swap-horizontal-circle'],
];

export default function RuleScreen() {
  const t = useTheme();
  const { id, kind: kindParam } = useLocalSearchParams<{ id?: string; kind?: 'bill' | 'template' }>();
  const rule = useMemo(() => (id ? q.rules().all().find((r) => r.id === id) : undefined), [id]);
  const tpl = rule ? ruleTemplate(rule) : undefined;
  const { active } = useWallets();
  const categories = useCategories();
  const { lastWallet } = useSettings();

  const [bill, setBill] = useState(tpl ? tpl.day != null : kindParam !== 'template');
  const [name, setName] = useState(tpl?.name ?? '');
  const [type, setType] = useState<TxType>(tpl?.type ?? 'expense');
  const [amount, setAmount] = useState(tpl ? String(tpl.amount) : '');
  const [walletId, setWalletId] = useState<string | null>(tpl?.walletId ?? null);
  const [toWalletId, setToWalletId] = useState<string | null>(tpl?.toWalletId ?? null);
  // a new bill starts in the built-in "Tagihan" category: right for kos, listrik, wifi; one tap to change
  const [categoryId, setCategoryId] = useState<string | null>(tpl ? tpl.categoryId : kindParam !== 'template' ? 'default-expense-bills' : null);
  const [day, setDay] = useState(String(tpl?.day ?? new Date().getDate()));
  const [note, setNote] = useState(tpl?.note ?? '');

  const wallet = walletId ?? (active.find((w) => w.id === lastWallet) ?? active[0])?.id ?? null;
  const cats = categories.filter((c) => c.kind === (type === 'income' ? 'income' : 'expense') && (!c.hidden || c.id === categoryId));
  const n = parseRupiah(amount) ?? 0;

  const save = () => {
    try {
      saveRule(rule?.id, { name, type, amount: n, walletId: wallet, toWalletId, categoryId, note, day: bill ? Number(day) : undefined });
    } catch (e) {
      return toast('Belum bisa disimpan', 'error', (e as Error).message);
    }
    router.back();
    toast(rule ? 'Perubahan disimpan' : bill ? 'Tagihan ditambahkan' : 'Template ditambahkan', 'success', name.trim());
  };

  const remove = () => {
    const r = rule!;
    deleteRule(r.id);
    router.back();
    toast(`${tpl!.name} dihapus`, 'info', 'Transaksi yang sudah tercatat tetap ada.');
  };

  return (
    <Screen>
      <Row>
        <Chip label="Tagihan bulanan" icon="calendar-sync" active={bill} onPress={() => setBill(true)} testID="rule-kind-bill" />
        <Chip label="Template cepat" icon="lightning-bolt-outline" active={!bill} onPress={() => setBill(false)} testID="rule-kind-template" />
      </Row>
      <Muted>
        {bill
          ? 'Kas mengingatkan menjelang jatuh tempo. Ketuk Lunas untuk mencatatnya, tanggalnya pindah ke bulan berikutnya.'
          : 'Muncul di Beranda. Satu ketukan langsung mencatat transaksi ini.'}
      </Muted>

      <Field label="Nama" placeholder={bill ? 'mis. Kos, Wifi, Cicilan motor' : 'mis. Kopi pagi'} value={name} onChangeText={setName} testID="rule-name" />

      <Row style={{ flexWrap: 'wrap' }}>
        {TYPES.map(([k, label, icon]) => (
          <Chip key={k} label={label} icon={icon} active={type === k} onPress={() => (setType(k), setCategoryId(null))} testID={`rule-type-${k}`} />
        ))}
      </Row>

      <TextInput
        testID="rule-amount"
        value={n ? formatRupiah(n) : ''}
        onChangeText={setAmount}
        keyboardType="number-pad"
        placeholder="Rp0"
        placeholderTextColor={t.muted}
        style={{ fontSize: 36, fontWeight: '800', fontVariant: ['tabular-nums'], color: type === 'income' ? t.income : type === 'expense' ? t.expense : t.text, paddingVertical: 6 }}
        accessibilityLabel="Nominal"
      />

      {bill && (
        <View style={{ gap: 6 }}>
          <Muted>Jatuh tempo setiap tanggal</Muted>
          <Row style={{ gap: 10 }}>
            <View style={{ width: 90 }}>
              <Field value={day} onChangeText={(v) => setDay(v.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" accessibilityLabel="Tanggal jatuh tempo" testID="rule-day" />
            </View>
            <View style={{ flex: 1 }}><Muted>Tanggal 29 sampai 31 jadi akhir bulan di bulan yang lebih pendek.</Muted></View>
          </Row>
        </View>
      )}

      <Muted>{type === 'transfer' ? 'Dari dompet' : 'Dompet'}</Muted>
      <Row style={{ flexWrap: 'wrap' }}>
        {active.map((w) => (
          <Chip key={w.id} label={w.name} icon={w.icon as IconName} active={wallet === w.id} color={w.color} onPress={() => setWalletId(w.id)} testID={`rule-wallet-${w.id}`} />
        ))}
      </Row>

      {type === 'transfer' ? (
        <>
          <Muted>Ke dompet</Muted>
          <Row style={{ flexWrap: 'wrap' }}>
            {active
              .filter((w) => w.id !== wallet)
              .map((w) => (
                <Chip key={w.id} label={w.name} icon={w.icon as IconName} active={toWalletId === w.id} color={w.color} onPress={() => setToWalletId(w.id)} testID={`rule-to-${w.id}`} />
              ))}
          </Row>
        </>
      ) : (
        <>
        <Muted>Kategori</Muted>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {cats.map((c) => (
            <Pressable
              key={c.id}
              testID={`rule-cat-${c.id}`}
              accessibilityRole="button"
              accessibilityState={{ selected: categoryId === c.id }}
              onPress={() => setCategoryId(c.id)}
              style={{ width: '23%', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 12, borderWidth: 2, borderColor: categoryId === c.id ? t.mark : 'transparent', backgroundColor: t.card }}
            >
              <ItemIcon icon={c.icon} color={c.color} />
              <Text style={{ fontSize: 11, color: t.text, textAlign: 'center', fontWeight: categoryId === c.id ? '700' : '400' }} numberOfLines={2}>
                {c.name}
              </Text>
            </Pressable>
          ))}
        </View>
        </>
      )}

      <Field placeholder="Catatan (opsional)" value={note} onChangeText={setNote} testID="rule-note" />
      <Button title={bill ? 'Simpan tagihan' : 'Simpan template'} icon="check" onPress={save} testID="save-rule" />
      {rule && <Button kind="danger" title="Hapus" icon="delete-outline" onPress={remove} testID="delete-rule" />}
    </Screen>
  );
}
