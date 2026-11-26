import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Switch, Text } from 'react-native';
import { formatRupiah, parseRupiah } from '../domain';
import { WALLET_ICON, getWallet, saveWallet } from '../db/repo';
import type { Wallet } from '../db/schema';
import { PALETTE, useTheme } from '../theme';
import { Button, Chip, ColorPicker, Field, Muted, Row, Screen } from '../ui';
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

  const save = () => {
    try {
      saveWallet({ id: w?.id, name, type, initialBalance: parseRupiah(initial) ?? 0, color, archived });
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
