import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { deleteCategory, getCategory, saveCategory } from '../db/repo';
import type { Category } from '../db/schema';
import { PALETTE, useTheme } from '../theme';
import { Button, Chip, ColorPicker, Field, ItemIcon, Muted, Row, Screen, s, type IconName } from '../ui';
import { confirm, toast } from '../feedback';

// Picked for what Indonesians actually spend on and earn from; no generic decorative glyphs.
const ICONS: IconName[] = [
  'silverware-fork-knife', 'coffee', 'food-apple', 'basket', 'cart', 'motorbike', 'bus', 'gas-station',
  'airplane', 'home-city', 'receipt-text', 'water', 'wifi', 'cellphone-wireless', 'medical-bag', 'heart-pulse',
  'dumbbell', 'school', 'book-open-variant', 'movie-open', 'gamepad-variant', 'tshirt-crew', 'baby-carriage', 'paw',
  'gift', 'hand-heart', 'briefcase', 'cash-plus', 'piggy-bank', 'chart-line', 'bank-transfer', 'credit-card',
  'tag', 'dots-horizontal-circle',
];

export default function CategoryScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const c = useMemo(() => (id ? getCategory(id) : undefined), [id]);
  const [name, setName] = useState(c?.name ?? '');
  const [kind, setKind] = useState<Category['kind']>(c?.kind ?? 'expense');
  const [icon, setIcon] = useState(c?.icon ?? 'tag');
  const [color, setColor] = useState(c?.color ?? PALETTE[0]);
  const [hidden, setHidden] = useState(c?.hidden ?? false);

  const save = () => {
    try {
      saveCategory({ id: c?.id, name, kind, icon, color, hidden });
      router.back();
      toast(c ? 'Kategori diperbarui' : 'Kategori ditambahkan', 'success', name.trim());
    } catch (e) {
      toast('Belum bisa disimpan', 'error', (e as Error).message);
    }
  };

  const remove = async () => {
    const ok = await confirm({ title: `Hapus kategori ${c!.name}?`, body: 'Transaksinya dipindah ke "Lainnya", tidak ikut terhapus. Budget kategori ini ikut dihapus.', confirm: 'Hapus', destructive: true });
    if (!ok) return;
    deleteCategory(c!.id);
    router.back();
    toast('Kategori dihapus', 'info', 'Transaksinya sekarang di "Lainnya".');
  };

  return (
    <Screen>
      <Row style={{ gap: 12 }}>
        <ItemIcon icon={icon} color={color} size={56} />
        <View style={{ flex: 1 }}>
          <Field label="Nama" value={name} onChangeText={setName} placeholder="mis. Parkir" testID="cat-name" />
        </View>
      </Row>
      {!c && (
        <Row>
          <Chip label="Pengeluaran" icon="arrow-up-circle" active={kind === 'expense'} onPress={() => setKind('expense')} testID="cat-kind-expense" />
          <Chip label="Pemasukan" icon="arrow-down-circle" active={kind === 'income'} onPress={() => setKind('income')} testID="cat-kind-income" />
        </Row>
      )}
      <Text style={[s.label, { color: t.muted }]}>Ikon</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {ICONS.map((i) => (
          <Pressable
            key={i}
            onPress={() => setIcon(i)}
            accessibilityRole="radio"
            accessibilityLabel={i.replace(/-/g, ' ')}
            accessibilityState={{ checked: icon === i }}
            style={{ padding: 2, borderRadius: 26, borderWidth: 2, borderColor: icon === i ? t.text : 'transparent' }}
          >
            <ItemIcon icon={i} color={icon === i ? color : t.muted} size={44} />
          </Pressable>
        ))}
      </View>
      <ColorPicker value={color} onChange={setColor} />
      {c?.isDefault && (
        <>
          <Row style={{ justifyContent: 'space-between', minHeight: 44 }}>
            <Text style={{ color: t.text }}>Sembunyikan dari pilihan</Text>
            <Switch value={hidden} onValueChange={setHidden} testID="cat-hidden" accessibilityLabel="Sembunyikan kategori" trackColor={{ true: t.mark, false: t.line }} thumbColor={t.card} />
          </Row>
          <Muted>Kategori bawaan tidak bisa dihapus, hanya disembunyikan.</Muted>
        </>
      )}
      <Button title="Simpan kategori" icon="check" onPress={save} testID="save-category" />
      {c && !c.isDefault && <Button kind="danger" icon="delete-outline" title="Hapus kategori" onPress={remove} testID="delete-category" />}
    </Screen>
  );
}
