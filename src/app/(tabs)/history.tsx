import DateTimePicker from '@react-native-community/datetimepicker';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, ScrollView, Text, View } from 'react-native';
import { q, type HistoryFilter } from '../../db/repo';
import type { Transaction } from '../../db/schema';
import { fmtDate, useCategories, useWallets } from '../../hooks';
import { C, Chip, Field, Muted, Row, TxRow, s } from '../../ui';

const LIMIT = 500; // shortcut: newest 500 matches, no paging; switch to FlashList + paging for 20k-row profiling

type Item = { header: string } | Transaction;

export default function History() {
  const { wallets } = useWallets();
  const categories = useCategories();
  const [f, setF] = useState<HistoryFilter>({});
  const [picking, setPicking] = useState<'from' | 'to' | null>(null);
  const { data } = useLiveQuery(q.history(f, LIMIT), [f.walletId, f.categoryId, f.from?.getTime(), f.to?.getTime(), f.search]);

  const catMap = new Map(categories.map((c) => [c.id, c]));
  const walletMap = new Map(wallets.map((w) => [w.id, w]));

  // group by day: insert a header row whenever the date changes
  const items: Item[] = [];
  let last = '';
  for (const t of data) {
    const day = fmtDate(t.occurredAt);
    if (day !== last) items.push({ header: (last = day) });
    items.push(t);
  }

  const toggle = <K extends keyof HistoryFilter>(k: K, v: HistoryFilter[K]) => setF((o) => ({ ...o, [k]: o[k] === v ? undefined : v }));
  const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 12, gap: 8 }}>
        <Field placeholder="Cari catatan…" value={f.search ?? ''} onChangeText={(search) => setF((o) => ({ ...o, search }))} testID="search" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {wallets.map((w) => (
            <Chip key={w.id} label={`${w.icon} ${w.name}`} active={f.walletId === w.id} color={w.color} onPress={() => toggle('walletId', w.id)} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {categories.map((c) => (
            <Chip key={c.id} label={`${c.icon} ${c.name}`} active={f.categoryId === c.id} color={c.color} onPress={() => toggle('categoryId', c.id)} />
          ))}
        </ScrollView>
        <Row>
          <Chip label={f.from ? `Dari ${f.from.toLocaleDateString('id-ID')}` : 'Dari tanggal'} active={!!f.from} onPress={() => (f.from ? setF((o) => ({ ...o, from: undefined })) : setPicking('from'))} testID="filter-from" />
          <Chip
            label={f.to ? `Sampai ${new Date(f.to.getTime() - 1).toLocaleDateString('id-ID')}` : 'Sampai tanggal'}
            active={!!f.to}
            onPress={() => (f.to ? setF((o) => ({ ...o, to: undefined })) : setPicking('to'))}
            testID="filter-to"
          />
        </Row>
      </View>
      {picking && (
        <DateTimePicker
          value={new Date()}
          mode="date"
          onValueChange={(_, d) => {
            const day = dayStart(d);
            // "to" is exclusive: store the start of the following day
            setF((o) => ({ ...o, [picking]: picking === 'to' ? new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1) : day }));
            setPicking(null);
          }}
          onDismiss={() => setPicking(null)}
        />
      )}
      <FlatList
        data={items}
        keyExtractor={(it, i) => ('header' in it ? `h${i}` : it.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        ListEmptyComponent={<Muted>Tidak ada transaksi.</Muted>}
        ListFooterComponent={data.length === LIMIT ? <Muted>Menampilkan {LIMIT} terbaru. Persempit filter untuk melihat yang lebih lama.</Muted> : undefined}
        renderItem={({ item }) =>
          'header' in item ? (
            <Text style={[s.label, { marginTop: 12, color: C.muted }]}>{item.header}</Text>
          ) : (
            <TxRow
              t={item}
              cat={catMap.get(item.categoryId ?? '')}
              wallet={walletMap.get(item.walletId)}
              toWallet={walletMap.get(item.toWalletId ?? '')}
              onPress={() => router.push({ pathname: '/tx', params: { id: item.id } })}
            />
          )
        }
      />
    </View>
  );
}
