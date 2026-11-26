// Transaction detail as a ticket: the colored stub says what it was (category + amount, or the transfer route),
// the perforation separates it from the facts below, and the actions sit at the bottom.
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { formatRupiah } from '../domain';
import { deleteTx, q } from '../db/repo';
import { useCategories, useWallets } from '../hooks';
import { useTheme } from '../theme';
import { Button, Icon, ItemIcon, Muted, Row, Screen } from '../ui';
import { confirm, toast } from '../feedback';

const TYPE = { income: 'Pemasukan', expense: 'Pengeluaran', transfer: 'Transfer' } as const;
const NOTCH = 22;

export default function DetailScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useLiveQuery(q.tx(id ?? ''), [id]);
  const { wallets } = useWallets();
  const categories = useCategories();
  const tx = data[0];

  if (!tx || tx.deletedAt)
    return (
      <Screen>
        <Muted>Transaksi ini sudah dihapus atau tidak ditemukan.</Muted>
        <Button kind="ghost" title="Kembali" onPress={() => router.back()} />
      </Screen>
    );

  const cat = categories.find((c) => c.id === tx.categoryId);
  const from = wallets.find((w) => w.id === tx.walletId);
  const to = wallets.find((w) => w.id === tx.toWalletId);
  const transfer = tx.type === 'transfer';
  const stub = transfer ? t.primary : (cat?.color ?? t.primary);
  const sign = tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : '';
  const day = tx.occurredAt.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const time = tx.occurredAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  const remove = async () => {
    const ok = await confirm({ title: 'Hapus transaksi?', body: `${TYPE[tx.type]} ${formatRupiah(tx.amount)} akan dihapus dari saldo dan riwayat.`, confirm: 'Hapus', destructive: true });
    if (!ok) return;
    deleteTx(tx.id);
    router.back();
    toast('Transaksi dihapus', 'info');
  };

  const facts: [string, string][] = [
    ['Tanggal', day],
    ['Jam', time],
    ['Jenis', TYPE[tx.type]],
    [transfer ? 'Dari dompet' : 'Dompet', from?.name ?? '-'],
    ...(transfer ? ([['Ke dompet', to?.name ?? '-']] as [string, string][]) : ([['Kategori', cat?.name ?? '-']] as [string, string][])),
    ['Dicatat', tx.createdAt.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })],
  ];

  return (
    <Screen>
      <Animated.View entering={FadeInDown.duration(260)} style={{ borderRadius: 20, overflow: 'hidden', backgroundColor: t.card }}>
        {/* stub */}
        <View style={{ backgroundColor: stub, padding: 20, gap: 14 }}>
          <Row style={{ gap: 10 }}>
            <ItemIcon icon={transfer ? 'swap-horizontal' : (cat?.icon ?? 'tag')} color="rgba(255,255,255,0.2)" size={36} />
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16, flex: 1 }}>{transfer ? 'Transfer antar dompet' : (cat?.name ?? 'Tanpa kategori')}</Text>
            <Text style={{ color: '#FFFFFF', opacity: 0.9 }}>{TYPE[tx.type]}</Text>
          </Row>
          {transfer ? (
            // the transfer reads like a route: from -> to
            <Row style={{ justifyContent: 'space-between', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#FFFFFF', opacity: 0.85 }}>Dari</Text>
                <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '800' }} numberOfLines={1}>
                  {from?.name}
                </Text>
              </View>
              <Icon name="arrow-right-thin" size={32} color="#FFFFFF" />
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={{ color: '#FFFFFF', opacity: 0.85 }}>Ke</Text>
                <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '800' }} numberOfLines={1}>
                  {to?.name}
                </Text>
              </View>
            </Row>
          ) : null}
          <Text style={{ color: '#FFFFFF', fontSize: 34, fontWeight: '800', fontVariant: ['tabular-nums'] }} adjustsFontSizeToFit numberOfLines={1}>
            {sign}
            {formatRupiah(tx.amount)}
          </Text>
        </View>

        {/* perforation: notches cut into both sides + dashed tear line */}
        <View style={{ height: NOTCH, justifyContent: 'center' }}>
          <View style={{ position: 'absolute', left: -NOTCH / 2, width: NOTCH, height: NOTCH, borderRadius: NOTCH / 2, backgroundColor: t.bg }} />
          <View style={{ marginHorizontal: NOTCH, borderTopWidth: 2, borderStyle: 'dashed', borderColor: t.line }} />
          <View style={{ position: 'absolute', right: -NOTCH / 2, width: NOTCH, height: NOTCH, borderRadius: NOTCH / 2, backgroundColor: t.bg }} />
        </View>

        <View style={{ padding: 20, paddingTop: 8, gap: 16 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 }}>
            {facts.map(([k, v]) => (
              <View key={k} style={{ width: '50%', paddingRight: 8, gap: 2 }}>
                <Muted>{k}</Muted>
                <Text style={{ color: t.text, fontWeight: '700' }}>{v}</Text>
              </View>
            ))}
          </View>
          <View style={{ gap: 2 }}>
            <Muted>Catatan</Muted>
            <Text style={{ color: tx.note ? t.text : t.muted }}>{tx.note || 'Tidak ada catatan'}</Text>
          </View>
        </View>
      </Animated.View>

      <Button title="Ubah transaksi" icon="pencil" onPress={() => router.replace({ pathname: '/tx', params: { id: tx.id } })} testID="detail-edit" />
      <Button kind="danger" title="Hapus transaksi" icon="delete-outline" onPress={remove} testID="detail-delete" />
    </Screen>
  );
}
