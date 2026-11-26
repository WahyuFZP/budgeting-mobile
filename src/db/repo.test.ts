// Feature checks against a real SQLite database (Node's built-in), through the same repository code the app runs.
// Each test starts from a fresh database with the real migrations applied.
import { strFromU8, unzipSync } from 'fflate';
import { periodFor, totals, walletBalances } from '../domain';
import * as T from './testdb';

jest.mock('./client', () => require('./testdb'));
jest.mock('expo-crypto', () => ({ randomUUID: () => (globalThis as any).crypto.randomUUID() }));
const written: Uint8Array[] = [];
jest.mock('expo-file-system', () => ({
  Paths: { cache: 'cache' },
  File: class {
    uri = 'file:///cache/out.xlsx';
    create() {}
    async write(b: Uint8Array) {
      written.push(b);
    }
  },
}));
const shared: string[] = [];
jest.mock('expo-sharing', () => ({ shareAsync: async (uri: string) => void shared.push(uri) }));

// imported after the mocks so they bind to the test database
import { exportPeriodXlsx } from './export';
import * as repo from './repo';

const day = (d: number, h = 10) => new Date(2026, 10, d, h);
const P = periodFor(day(15), 1); // 1-30 Nov 2026

function setup() {
  repo.seedIfEmpty();
  repo.saveWallet({ name: 'Tunai', type: 'cash', initialBalance: 100_000, color: '#14386B' });
  repo.saveWallet({ name: 'BCA', type: 'bank', initialBalance: 1_000_000, color: '#2E6E8E' });
  const [cash, bank] = repo.q.wallets().all();
  return { cash: cash.id, bank: bank.id };
}
const tx = (o: Partial<repo.TxSave>): repo.TxSave => ({
  type: 'expense',
  amount: 10_000,
  walletId: null,
  toWalletId: null,
  categoryId: 'default-expense-food',
  occurredAt: day(10),
  note: '',
  ...o,
});
const balances = () => walletBalances(repo.q.wallets().all(), repo.q.balanceTxs().all());

beforeEach(() => {
  T.resetDb();
  written.length = 0;
  shared.length = 0;
});

describe('onboarding & seed', () => {
  test('default categories use real icons, seeding twice adds nothing', () => {
    repo.seedIfEmpty();
    repo.seedIfEmpty();
    const cats = repo.q.categories().all();
    expect(cats).toHaveLength(11);
    expect(cats.find((c) => c.id === 'default-expense-food')?.icon).toBe('silverware-fork-knife');
    expect(cats.every((c) => /^[a-z-]+$/.test(c.icon))).toBe(true); // no emoji left
  });
  test('hasWallet guards the "PIN set but no wallet" state', () => {
    repo.seedIfEmpty();
    expect(repo.hasWallet()).toBe(false);
    repo.saveWallet({ name: 'Tunai', type: 'cash', initialBalance: 0, color: '#14386B' });
    expect(repo.hasWallet()).toBe(true);
  });
  test('wallet needs a name and an integer balance', () => {
    expect(() => repo.saveWallet({ name: '  ', type: 'cash', initialBalance: 0, color: '#000' })).toThrow('Nama dompet');
    expect(() => repo.saveWallet({ name: 'X', type: 'cash', initialBalance: 1.5, color: '#000' })).toThrow('Saldo awal');
  });
});

describe('catat transaksi & saldo', () => {
  test('income, expense and transfer move the right wallets', () => {
    const { cash, bank } = setup();
    repo.saveTx(tx({ type: 'income', amount: 50_000, walletId: cash, categoryId: 'default-income-salary' }));
    repo.saveTx(tx({ amount: 20_000, walletId: cash }));
    repo.saveTx(tx({ type: 'transfer', amount: 300_000, walletId: bank, toWalletId: cash, categoryId: 'default-expense-food' }));
    const b = balances();
    expect(b.get(cash)).toBe(430_000);
    expect(b.get(bank)).toBe(700_000);
    const transfer = repo.q.history({}, 10).all().find((t) => t.type === 'transfer')!;
    expect(transfer.categoryId).toBeNull(); // category is dropped for transfers
  });
  test('transfer is neither income nor expense in the period totals', () => {
    const { cash, bank } = setup();
    repo.saveTx(tx({ amount: 20_000, walletId: cash }));
    repo.saveTx(tx({ type: 'transfer', amount: 300_000, walletId: bank, toWalletId: cash }));
    expect(totals(repo.q.flowTxs(P).all(), P)).toEqual({ income: 0, expense: 20_000 });
  });
  test('invalid input is rejected and nothing is saved', () => {
    const { cash } = setup();
    expect(() => repo.saveTx(tx({ amount: 0, walletId: cash }))).toThrow('Nominal');
    expect(() => repo.saveTx(tx({ walletId: null }))).toThrow('Pilih dompet');
    expect(() => repo.saveTx(tx({ type: 'transfer', walletId: cash, toWalletId: cash }))).toThrow('berbeda');
    expect(() => repo.saveTx(tx({ walletId: cash, categoryId: null }))).toThrow('Pilih kategori');
    expect(repo.q.history({}, 10).all()).toHaveLength(0);
  });
  test('the wallet picked for income is the one saved, and becomes the default next time', () => {
    const { bank } = setup();
    repo.saveTx(tx({ type: 'income', amount: 75_000, walletId: bank, categoryId: 'default-income-bonus' }));
    expect(repo.q.history({}, 1).all()[0].walletId).toBe(bank);
    expect(repo.getSetting('last_wallet')).toBe(bank);
    expect(repo.getSetting('last_cat_income')).toBe('default-income-bonus');
    expect(repo.getSetting('last_cat_expense')).toBeFalsy();
    expect(balances().get(bank)).toBe(1_075_000);
  });
  test('undo after delete brings the transaction and its effect on the balance back', () => {
    const { cash } = setup();
    repo.saveTx(tx({ amount: 20_000, walletId: cash }));
    const id = repo.q.history({}, 1).all()[0].id;
    const before = balances().get(cash);
    repo.deleteTx(id);
    expect(balances().get(cash)).toBe(before! + 20_000);
    repo.restoreTx(id);
    expect(repo.q.history({}, 10).all().map((t) => t.id)).toContain(id);
    expect(balances().get(cash)).toBe(before);
  });
  test('edit replaces, delete is soft and disappears from every query', () => {
    const { cash } = setup();
    repo.saveTx(tx({ amount: 20_000, walletId: cash, note: 'kopi' }));
    const id = repo.q.history({}, 1).all()[0].id;
    repo.saveTx(tx({ id, amount: 25_000, walletId: cash, note: 'kopi susu' }));
    expect(repo.getTx(id)).toMatchObject({ amount: 25_000, note: 'kopi susu' });
    repo.deleteTx(id);
    expect(repo.getTx(id)?.deletedAt).toBeInstanceOf(Date); // still on disk for sync
    expect(repo.q.history({}, 10).all()).toHaveLength(0);
    expect(balances().get(cash)).toBe(100_000);
  });
});

describe('riwayat & pencarian', () => {
  test('filters by wallet (incl. transfer target), category, date range and note', () => {
    const { cash, bank } = setup();
    repo.saveTx(tx({ amount: 1, walletId: cash, note: 'Kopi pagi', occurredAt: day(3) }));
    repo.saveTx(tx({ amount: 2, walletId: bank, categoryId: 'default-expense-transport', occurredAt: day(12) }));
    repo.saveTx(tx({ type: 'transfer', amount: 3, walletId: bank, toWalletId: cash, occurredAt: day(20) }));
    const amounts = (f: repo.HistoryFilter) => repo.q.history(f, 50).all().map((t) => t.amount).sort();
    expect(amounts({ walletId: cash })).toEqual([1, 3]);
    expect(amounts({ categoryId: 'default-expense-transport' })).toEqual([2]);
    expect(amounts({ from: new Date(2026, 10, 10), to: new Date(2026, 10, 15) })).toEqual([2]);
    expect(amounts({ search: 'kopi' })).toEqual([1]); // case-insensitive LIKE
    expect(repo.q.history({}, 50).all().map((t) => t.amount)).toEqual([3, 2, 1]); // newest first
  });
});

describe('kategori', () => {
  test('deleting a used category moves its transactions to "Lainnya" and drops its budgets', () => {
    const { cash } = setup();
    repo.saveCategory({ name: 'Parkir', kind: 'expense', icon: 'car', color: '#14386B' });
    const parkir = repo.q.categories().all().find((c) => c.name === 'Parkir')!;
    repo.saveTx(tx({ amount: 5_000, walletId: cash, categoryId: parkir.id }));
    repo.setBudget(parkir.id, P, 50_000);
    repo.deleteCategory(parkir.id);
    expect(repo.q.history({}, 10).all()[0].categoryId).toBe(repo.OTHER_EXPENSE);
    expect(repo.q.budgets(P).all()).toHaveLength(0);
    expect(repo.q.categories().all().some((c) => c.id === parkir.id)).toBe(false);
  });
  test('default categories cannot be deleted, only hidden', () => {
    setup();
    expect(() => repo.deleteCategory('default-expense-food')).toThrow('bawaan');
    const food = repo.getCategory('default-expense-food')!;
    repo.saveCategory({ ...food, hidden: true });
    expect(repo.getCategory('default-expense-food')?.hidden).toBe(true);
  });
});

describe('budget', () => {
  test('set, update, remove with 0, and copy from last period without overwriting', () => {
    setup();
    const prev = periodFor(new Date(2026, 9, 15), 1);
    repo.setBudget('default-expense-food', prev, 1_000_000);
    repo.setBudget('default-expense-transport', prev, 300_000);
    repo.setBudget('default-expense-food', P, 800_000);
    expect(repo.copyBudgets(prev, P)).toBe(1); // only transport copied
    const limits = Object.fromEntries(repo.q.budgets(P).all().map((b) => [b.categoryId, b.limitAmount]));
    expect(limits).toEqual({ 'default-expense-food': 800_000, 'default-expense-transport': 300_000 });
    repo.setBudget('default-expense-food', P, 0);
    expect(repo.q.budgets(P).all()).toHaveLength(1);
  });
  test('spentInCategory counts the period only and can exclude the edited transaction', () => {
    const { cash } = setup();
    repo.saveTx(tx({ amount: 40_000, walletId: cash }));
    repo.saveTx(tx({ amount: 60_000, walletId: cash, occurredAt: new Date(2026, 9, 30) })); // October
    const id = repo.q.history({}, 1).all()[0].id;
    expect(repo.spentInCategory('default-expense-food', P)).toBe(40_000);
    expect(repo.spentInCategory('default-expense-food', P, repo.q.history({}, 10).all().find((t) => t.amount === 40_000)!.id)).toBe(0);
    expect(id).toBeTruthy();
  });
});

describe('ekspor Excel', () => {
  test('writes one row per transaction of the period, numbers as numbers, then opens the share sheet', async () => {
    const { cash, bank } = setup();
    repo.saveTx(tx({ amount: 15_000, walletId: cash, note: 'Kopi & roti', occurredAt: day(5) }));
    repo.saveTx(tx({ type: 'transfer', amount: 200_000, walletId: bank, toWalletId: cash, occurredAt: day(6) }));
    repo.saveTx(tx({ amount: 99_000, walletId: cash, occurredAt: new Date(2026, 9, 31) })); // other period
    await expect(exportPeriodXlsx(P)).resolves.toBe(2);
    const sheet = strFromU8(unzipSync(written[0])['xl/worksheets/sheet1.xml']);
    expect(sheet).toContain('<t xml:space="preserve">2026-11-05</t>');
    expect(sheet).toContain('<v>15000</v>');
    expect(sheet).toContain('Kopi &amp; roti');
    expect(sheet).toContain('<t xml:space="preserve">Transfer</t>');
    expect(sheet).not.toContain('99000');
    expect(shared).toHaveLength(1);
  });
  test('empty period gives a clear message instead of an empty file', async () => {
    setup();
    await expect(exportPeriodXlsx(P)).rejects.toThrow('Tidak ada transaksi');
    expect(shared).toHaveLength(0);
  });
});

describe('migrasi', () => {
  test('0001 converts old emoji icons, keeps user-changed ones and updated_at', () => {
    T.resetDb(1); // only 0000: the schema as shipped in the first build
    T.sqlite.exec(`INSERT INTO categories (id,created_at,updated_at,name,kind,icon,color,is_default,hidden,sort_order)
      VALUES ('default-expense-food',0,0,'Makan','expense','🍜','#E4572E',1,0,0),
             ('default-expense-bills',0,0,'Tagihan','expense','🧾','#F2A541',1,0,0)`);
    T.sqlite.exec(`INSERT INTO wallets (id,created_at,updated_at,name,type,icon,color,initial_balance,sort_order,archived)
      VALUES ('w1',5,5,'Cash','cash','💵','#000',0,0,0)`);
    T.runSqlFile(`${(globalThis as any).process.cwd()}/drizzle/0001_icons.sql`);
    const cats = T.sqlite.prepare('SELECT id, icon, updated_at FROM categories ORDER BY id').all();
    expect(cats).toEqual([
      { id: 'default-expense-bills', icon: '🧾', updated_at: 0 }, // user had changed it: untouched
      { id: 'default-expense-food', icon: 'silverware-fork-knife', updated_at: 0 },
    ]);
    expect(T.sqlite.prepare('SELECT icon, updated_at FROM wallets').get()).toEqual({ icon: 'cash', updated_at: 5 });
  });
});

describe('bills and templates', () => {
  const bill = (walletId: string, day = 28) => ({ name: 'Kos', type: 'expense' as const, amount: 1_500_000, walletId, toWalletId: null, categoryId: 'default-expense-bills', note: '', day });
  test('a new bill is due on its day this month; paying records it and moves to next month; undo puts both back', () => {
    const { bank } = setup();
    repo.saveRule(undefined, bill(bank), day(26));
    const [r] = repo.q.rules().all();
    expect(r.frequency).toBe('monthly');
    expect(r.nextRunAt).toEqual(new Date(2026, 10, 28));
    const u = repo.runRule(r, day(27));
    expect(repo.q.history({}, 5).all()[0]).toMatchObject({ amount: 1_500_000, recurringRuleId: r.id, categoryId: 'default-expense-bills' });
    expect(repo.q.rules().all()[0].nextRunAt).toEqual(new Date(2026, 11, 28));
    repo.undoRun(u);
    expect(repo.q.history({}, 5).all()).toHaveLength(0);
    expect(repo.q.rules().all()[0].nextRunAt).toEqual(new Date(2026, 10, 28));
  });
  test('a template has no schedule and can run any number of times', () => {
    const { cash } = setup();
    repo.saveRule(undefined, { ...bill(cash), name: 'Kopi', amount: 18_000, categoryId: 'default-expense-food', day: undefined });
    const [r] = repo.q.rules().all();
    expect(r.frequency).toBe('none');
    repo.runRule(r);
    repo.runRule(repo.q.rules().all()[0]);
    expect(repo.q.history({}, 5).all()).toHaveLength(2);
  });
  test('invalid rules are refused like transactions are', () => {
    const { cash } = setup();
    expect(() => repo.saveRule(undefined, { ...bill(cash), name: ' ' })).toThrow('Nama wajib diisi');
    expect(() => repo.saveRule(undefined, { ...bill(cash), amount: 0 })).toThrow('Nominal harus lebih dari 0');
    expect(() => repo.saveRule(undefined, { ...bill(cash), day: 32 })).toThrow('Tanggal jatuh tempo 1 sampai 31');
  });
  test('editing a bill keeps its schedule unless the due day changes', () => {
    const { bank } = setup();
    repo.saveRule(undefined, bill(bank), day(26));
    const id = repo.q.rules().all()[0].id;
    repo.runRule(repo.q.rules().all()[0], day(27)); // next: 28 Dec
    repo.saveRule(id, { ...bill(bank), amount: 1_600_000 }, day(27));
    expect(repo.q.rules().all()[0].nextRunAt).toEqual(new Date(2026, 11, 28));
    repo.saveRule(id, bill(bank, 5), day(27));
    expect(repo.q.rules().all()[0].nextRunAt).toEqual(new Date(2026, 11, 5));
  });
  test('a wallet target is stored with its date and cleared together with it', () => {
    setup();
    const w = repo.q.wallets().all()[0];
    repo.saveWallet({ ...w, targetAmount: 5_000_000, targetDate: new Date(2027, 5, 1) });
    expect(repo.getWallet(w.id)).toMatchObject({ targetAmount: 5_000_000, targetDate: new Date(2027, 5, 1) });
    repo.saveWallet({ ...w, targetAmount: null, targetDate: new Date(2027, 5, 1) });
    expect(repo.getWallet(w.id)).toMatchObject({ targetAmount: null, targetDate: null });
    expect(() => repo.saveWallet({ ...w, targetAmount: -1 })).toThrow('Target harus lebih dari 0');
  });
});
