import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Switch, Text } from 'react-native';
import { formatRupiah, parseRupiah } from '../domain';
import { getWallet, saveWallet } from '../db/repo';
import type { Wallet } from '../db/schema';
import { Button, C, Chip, Field, Muted, PALETTE, Row, Screen } from '../ui';

const TYPES: [Wallet['type'], string][] = [
  ['cash', '💵 Cash'],
  ['bank', '🏦 Bank'],
  ['ewallet', '📱 E-wallet'],
];

export default function WalletScreen() {
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
    } catch (e) {
      Alert.alert((e as Error).message);
    }
  };

  return (
    <Screen>
      <Field label="Nama" value={name} onChangeText={setName} placeholder="mis. BCA, GoPay" testID="wallet-name" />
      <Row style={{ flexWrap: 'wrap' }}>
        {TYPES.map(([t, label]) => (
          <Chip key={t} label={label} active={type === t} onPress={() => setType(t)} testID={`wallet-type-${t}`} />
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
      <Row style={{ flexWrap: 'wrap' }}>
        {PALETTE.map((c) => (
          <Chip key={c} label={color === c ? '✓' : '  '} active={color === c} color={c} onPress={() => setColor(c)} />
        ))}
      </Row>
      {w && (
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ color: C.text }}>Arsipkan (sembunyikan dari pilihan)</Text>
          <Switch value={archived} onValueChange={setArchived} testID="wallet-archive" />
        </Row>
      )}
      {w && <Muted>Dompet tidak dihapus agar riwayat transaksinya tetap utuh.</Muted>}
      <Button title="Simpan" onPress={save} testID="save-wallet" />
    </Screen>
  );
}
