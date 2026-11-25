import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Switch, Text } from 'react-native';
import { deleteCategory, getCategory, saveCategory } from '../db/repo';
import type { Category } from '../db/schema';
import { Button, C, Chip, Field, Muted, PALETTE, Row, Screen } from '../ui';

export default function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const c = useMemo(() => (id ? getCategory(id) : undefined), [id]);
  const [name, setName] = useState(c?.name ?? '');
  const [kind, setKind] = useState<Category['kind']>(c?.kind ?? 'expense');
  const [icon, setIcon] = useState(c?.icon ?? '');
  const [color, setColor] = useState(c?.color ?? PALETTE[0]);
  const [hidden, setHidden] = useState(c?.hidden ?? false);

  const save = () => {
    try {
      saveCategory({ id: c?.id, name, kind, icon, color, hidden });
      router.back();
    } catch (e) {
      Alert.alert((e as Error).message);
    }
  };

  const remove = () =>
    Alert.alert('Hapus kategori?', 'Transaksi di kategori ini dipindah ke "Lainnya". Budget kategori ini ikut dihapus.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: () => {
          deleteCategory(c!.id);
          router.back();
        },
      },
    ]);

  return (
    <Screen>
      {!c && (
        <Row>
          <Chip label="Pengeluaran" active={kind === 'expense'} onPress={() => setKind('expense')} testID="cat-kind-expense" />
          <Chip label="Pemasukan" active={kind === 'income'} onPress={() => setKind('income')} testID="cat-kind-income" />
        </Row>
      )}
      <Field label="Nama" value={name} onChangeText={setName} testID="cat-name" />
      <Field label="Ikon (emoji)" value={icon} onChangeText={setIcon} placeholder="🏷️" maxLength={4} testID="cat-icon" />
      <Row style={{ flexWrap: 'wrap' }}>
        {PALETTE.map((p) => (
          <Chip key={p} label={color === p ? '✓' : '  '} active={color === p} color={p} onPress={() => setColor(p)} />
        ))}
      </Row>
      {c?.isDefault && (
        <>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ color: C.text }}>Sembunyikan</Text>
            <Switch value={hidden} onValueChange={setHidden} testID="cat-hidden" />
          </Row>
          <Muted>Kategori bawaan tidak bisa dihapus, hanya disembunyikan.</Muted>
        </>
      )}
      <Button title="Simpan" onPress={save} testID="save-category" />
      {c && !c.isDefault && <Button kind="danger" title="Hapus kategori" onPress={remove} testID="delete-category" />}
    </Screen>
  );
}
