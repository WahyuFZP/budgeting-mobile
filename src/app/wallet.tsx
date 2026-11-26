import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { formatRupiah, parseRupiah } from '../domain';
import { WALLET_ICON, getWallet, saveWallet } from '../db/repo';
import type { Wallet } from '../db/schema';
import { PALETTE, useTheme } from '../theme';
import { Button, Chip, ColorPicker, Field, Muted, Row, Screen } from '../ui';
import { fmtDate } from '../hooks';
import { toast } from '../feedback';

const TYPES: [Wallet['type'], string][] = [
  ['cash', 'Tunai'],
  ['bank', 'Bank'],
  ['ewallet', 'E-wallet'],
];

export default function WalletScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const w = useMemo(() => (id ? getWallet(id) : undefined), [id]);
  const [name, setName] = useState(w?.name ?? '');
  const [type, setType] = useState<Wallet['type']>(w?.type ?? 'cash');
  const [initial, setInitial] = useState(w ? String(w.initialBalance) : '');
  const [color, setColor] = useState(w?.color ?? PALETTE[1]);
  const [archived, setArchived] = useState(w?.archived ?? false);
  const [goal, setGoal] = useState(!!w?.targetAmount);
  const [target, setTarget] = useState(w?.targetAmount ? String(w.targetAmount) : '');
  const [targetDate, setTargetDate] = useState<Date | null>(w?.targetDate ?? null);
  const [picking, setPicking] = useState(false);

  const save = () => {
    try {
      saveWallet({ id: w?.id, name, type, initialBalance: parseRupiah(initial) ?? 0, color, archived, targetAmount: goal ? (parseRupiah(target) ?? 0) : null, targetDate });
      router.back();
      toast(w ? 'Dompet diperbarui' : 'Dompet ditambahkan', 'success', name.trim());
    } catch (e) {
      toast('Belum bisa disimpan', 'error', (e as Error).message);
    }
  };

  return (
    <Screen>
      <Field label="Nama" value={name} onChangeText={setName} placeholder="mis. BCA, GoPay" testID="wallet-name" />
      <Row style={{ flexWrap: 'wrap' }}>
        {TYPES.map(([k, label]) => (
          <Chip key={k} label={label} icon={WALLET_ICON[k]} active={type === k} onPress={() => setType(k)} testID={`wallet-type-${k}`} />
        ))}
      </Row>
      <Field
        label="Saldo awal"
        value={initial ? formatRupiah(parseRupiah(initial) ?? 0) : ''}
        onChangeText={setInitial}
        keyboardType="number-pad"
        placeholder="Rp0"
        testID="wallet-initial"
      />
      <ColorPicker value={color} onChange={setColor} />

      {/* savings goal: the wallet's own balance is the progress, money goes in by transfer */}
      <Row style={{ justifyContent: 'space-between', minHeight: 44 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: t.text, fontWeight: '600' }}>Jadikan target tabungan</Text>
          <Muted>Saldo dompet ini jadi progres. Isi dengan transfer dari dompet lain.</Muted>
        </View>
        <Switch value={goal} onValueChange={setGoal} testID="wallet-goal" accessibilityLabel="Jadikan target tabungan" trackColor={{ true: t.mark, false: t.line }} thumbColor={t.card} />
      </Row>
      {goal && (
        <>
          <Field
            label="Target"
            value={target ? formatRupiah(parseRupiah(target) ?? 0) : ''}
            onChangeText={setTarget}
            keyboardType="number-pad"
            placeholder="mis. Rp5.000.000"
            testID="wallet-target"
          />
          <Muted>Tenggat (opsional): Kas menghitung berapa yang perlu disisihkan tiap bulan.</Muted>
          <Row style={{ flexWrap: 'wrap', gap: 6 }}>
            <Chip label="Tanpa tenggat" active={!targetDate} onPress={() => setTargetDate(null)} testID="target-nodate" />
            <Chip icon="calendar-month" label={targetDate ? fmtDate(targetDate) : 'Pilih tanggal'} active={!!targetDate} onPress={() => setPicking(true)} testID="target-date" />
          </Row>
          {picking && (
            <DateTimePicker
              value={targetDate ?? new Date(new Date().getFullYear() + 1, new Date().getMonth(), 1)}
              mode="date"
              minimumDate={new Date()}
              onValueChange={(_, d) => (setPicking(false), setTargetDate(d))}
              onDismiss={() => setPicking(false)}
            />
          )}
        </>
      )}
      {w && (
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ color: t.text, flex: 1 }}>Arsipkan (sembunyikan dari pilihan)</Text>
          <Switch value={archived} onValueChange={setArchived} testID="wallet-archive" accessibilityLabel="Arsipkan dompet" trackColor={{ true: t.mark, false: t.line }} thumbColor={t.card} />
        </Row>
      )}
      {w && <Muted>Dompet tidak dihapus agar riwayat transaksinya tetap utuh.</Muted>}
      <Button title="Simpan dompet" icon="check" onPress={save} testID="save-wallet" />
    </Screen>
  );
}
