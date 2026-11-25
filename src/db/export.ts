// Export one period's transactions to an Excel workbook and hand it to the share sheet.
import { and, asc, gte, isNull, lt } from 'drizzle-orm';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { Period } from '../domain';
import { buildXlsx, type Cell } from '../domain/xlsx';
import { db } from './client';
import { categories, transactions, wallets } from './schema';

const TYPE = { income: 'Pemasukan', expense: 'Pengeluaran', transfer: 'Transfer' } as const;
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export async function exportPeriodXlsx(p: Period) {
  const txs = db
    .select()
    .from(transactions)
    .where(and(isNull(transactions.deletedAt), gte(transactions.occurredAt, p.start), lt(transactions.occurredAt, p.end)))
    .orderBy(asc(transactions.occurredAt))
    .all();
  if (txs.length === 0) throw new Error('Tidak ada transaksi di periode ini untuk diekspor.');
  const walletName = new Map(db.select().from(wallets).all().map((w) => [w.id, w.name]));
  const catName = new Map(db.select().from(categories).all().map((c) => [c.id, c.name]));

  const rows: Cell[][] = [
    ['Tanggal', 'Jenis', 'Kategori', 'Dompet', 'Ke dompet', 'Nominal (Rp)', 'Catatan'],
    ...txs.map((t) => [
      ymd(t.occurredAt),
      TYPE[t.type],
      t.categoryId ? (catName.get(t.categoryId) ?? '') : '',
      walletName.get(t.walletId) ?? '',
      t.toWalletId ? (walletName.get(t.toWalletId) ?? '') : '',
      t.amount,
      t.note,
    ]),
  ];
  const name = `kas-${ymd(p.start)}-sd-${ymd(new Date(p.end.getTime() - 1))}.xlsx`;
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  await file.write(buildXlsx(`Transaksi ${ymd(p.start)}`, rows, [12, 13, 18, 16, 16, 14, 30]));
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: 'Simpan atau kirim laporan Excel',
    UTI: 'org.openxmlformats.spreadsheetml.sheet',
  });
  return txs.length;
}
