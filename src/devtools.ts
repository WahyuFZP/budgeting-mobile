// Dev-only helpers for React Native DevTools > Console (stripped from release builds by the __DEV__ guard).
//   __kas.go('/report')   open a screen
//   __kas.tour()          open every screen in turn; a broken screen shows up as a red error in the Console
//   __kas.check()         read-only consistency check of the real data on this phone
import { router, type Href } from 'expo-router';
import { periodFor, validateTx, walletBalances } from './domain';
import { getSetting, q } from './db/repo';

const SCREENS = ['/', '/history', '/report', '/budget', '/settings', '/tx', '/wallet', '/category', '/backup', '/sync', '/pin'];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function check() {
  const wallets = q.wallets().all();
  const cats = q.categories().all();
  const txs = q.history({}, 100_000).all();
  const walletIds = new Set(wallets.map((w) => w.id));
  const catIds = new Set(cats.map((c) => c.id));
  const problems: string[] = [];

  for (const t of txs) {
    const err = validateTx(t);
    if (err) problems.push(`transaksi ${t.id}: ${err}`);
    if (!walletIds.has(t.walletId)) problems.push(`transaksi ${t.id}: dompet ${t.walletId} tidak ada`);
    if (t.toWalletId && !walletIds.has(t.toWalletId)) problems.push(`transaksi ${t.id}: dompet tujuan tidak ada`);
    if (t.categoryId && !catIds.has(t.categoryId)) problems.push(`transaksi ${t.id}: kategori ${t.categoryId} sudah dihapus`);
  }
  for (const id of ['default-expense-other', 'default-income-other']) if (!catIds.has(id)) problems.push(`kategori bawaan ${id} hilang`);
  if (wallets.length === 0) problems.push('belum ada dompet: form transaksi tidak bisa dipakai');

  const bal = walletBalances(wallets, q.balanceTxs().all());
  const payday = Number(getSetting('payday') ?? 1);
  const p = periodFor(new Date(), payday);
  console.table(wallets.map((w) => ({ dompet: w.name, saldo_awal: w.initialBalance, saldo: bal.get(w.id), diarsipkan: w.archived })));
  console.log(
    `Transaksi: ${txs.length}, kategori: ${cats.length}, budget periode ini (${p.start.toDateString()}): ${q.budgets(p).all().length}, tanggal gajian: ${payday}`,
  );
  if (problems.length) console.error(`Kas check: ${problems.length} masalah`, problems);
  else console.log('Kas check: OK, tidak ada data yang tidak konsisten');
  return problems.length === 0;
}

async function tour(ms = 2500) {
  for (const path of SCREENS) {
    console.log(`Kas tour: ${path}`);
    router.navigate(path as Href);
    await sleep(ms);
  }
  router.dismissTo('/');
  console.log('Kas tour selesai: semua layar dibuka. Error (kalau ada) tampil merah di atas.');
}

if (__DEV__) {
  (globalThis as any).__kas = { go: (path: string) => router.navigate(path as Href), tour, check, screens: SCREENS };
  console.log('Kas dev helpers siap: __kas.check(), __kas.tour(), __kas.go("/report")');
}
