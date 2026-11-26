import {
  budgetStatus,
  crossedLevel,
  pace,
  reminders,
  squirrelLines,
  formatRupiah,
  nextPeriod,
  parseRupiah,
  periodFor,
  prevPeriod,
  spentByCategory,
  totals,
  validateTx,
  walletBalances,
} from './index';

const d = (y: number, m: number, day: number, h = 12) => new Date(y, m - 1, day, h);

describe('money', () => {
  test('parse keeps integers only', () => {
    expect(parseRupiah('Rp 15.000')).toBe(15000);
    expect(parseRupiah('1.250.000')).toBe(1250000);
    expect(parseRupiah('12,50')).toBe(1250); // no decimals in Rupiah: comma is ignored
    expect(parseRupiah('')).toBeNull();
    expect(parseRupiah('abc')).toBeNull();
    expect(parseRupiah('99999999999999999999')).toBeNull();
  });
  test('format', () => {
    expect(formatRupiah(0)).toBe('Rp0');
    expect(formatRupiah(999)).toBe('Rp999');
    expect(formatRupiah(1250000)).toBe('Rp1.250.000');
    expect(formatRupiah(-15000)).toBe('-Rp15.000');
  });
});

describe('period', () => {
  test('default payday 1 = calendar month', () => {
    const p = periodFor(d(2026, 11, 25), 1);
    expect(p.start).toEqual(new Date(2026, 10, 1));
    expect(p.end).toEqual(new Date(2026, 11, 1));
  });
  test('payday 25: before payday belongs to previous period', () => {
    const p = periodFor(d(2026, 11, 24), 25);
    expect(p.start).toEqual(new Date(2026, 9, 25));
    expect(p.end).toEqual(new Date(2026, 10, 25));
    expect(periodFor(new Date(2026, 10, 25), 25).start).toEqual(new Date(2026, 10, 25));
  });
  test('payday 31 clamps to short months', () => {
    const p = periodFor(d(2027, 3, 15), 31);
    expect(p.start).toEqual(new Date(2027, 1, 28));
    expect(p.end).toEqual(new Date(2027, 2, 31));
  });
  test('year boundary + prev/next', () => {
    const p = periodFor(d(2026, 12, 30), 25);
    expect(p.end).toEqual(new Date(2027, 0, 25));
    expect(prevPeriod(p, 25).start).toEqual(new Date(2026, 10, 25));
    expect(nextPeriod(p, 25).start).toEqual(new Date(2027, 0, 25));
    expect(prevPeriod(periodFor(d(2027, 1, 10), 1), 1).start).toEqual(new Date(2026, 11, 1));
  });
});

describe('balances', () => {
  const wallets = [
    { id: 'cash', initialBalance: 100_000 },
    { id: 'bank', initialBalance: 1_000_000 },
  ];
  test('income, expense and transfer', () => {
    const b = walletBalances(wallets, [
      { type: 'income', amount: 50_000, walletId: 'cash', toWalletId: null },
      { type: 'expense', amount: 20_000, walletId: 'cash', toWalletId: null },
      { type: 'transfer', amount: 300_000, walletId: 'bank', toWalletId: 'cash' },
    ]);
    expect(b.get('cash')).toBe(430_000);
    expect(b.get('bank')).toBe(700_000);
  });
  test('transfer does not change total assets', () => {
    const b = walletBalances(wallets, [{ type: 'transfer', amount: 77_000, walletId: 'cash', toWalletId: 'bank' }]);
    expect([...b.values()].reduce((a, v) => a + v, 0)).toBe(1_100_000);
  });
});

describe('totals & budget', () => {
  const p = periodFor(d(2026, 11, 10), 1);
  const txs = [
    { type: 'expense' as const, amount: 30_000, categoryId: 'food', occurredAt: d(2026, 11, 2) },
    { type: 'expense' as const, amount: 50_000, categoryId: 'food', occurredAt: d(2026, 11, 20) },
    { type: 'expense' as const, amount: 99_000, categoryId: 'food', occurredAt: d(2026, 10, 31) }, // other period
    { type: 'income' as const, amount: 5_000_000, categoryId: 'salary', occurredAt: d(2026, 11, 1, 0) },
    { type: 'transfer' as const, amount: 1_000_000, categoryId: null, occurredAt: d(2026, 11, 5) },
  ];
  test('transfer is neither income nor expense', () => {
    expect(totals(txs, p)).toEqual({ income: 5_000_000, expense: 80_000 });
  });
  test('spent by category in period', () => {
    expect(spentByCategory(txs, p).get('food')).toBe(80_000);
    expect(spentByCategory(txs, p).has('salary')).toBe(false);
  });
  test('status levels at 80% and 100%', () => {
    expect(budgetStatus(100_000, 79_999).level).toBe('ok');
    expect(budgetStatus(100_000, 80_000).level).toBe('warn');
    expect(budgetStatus(100_000, 100_000).level).toBe('over');
    expect(budgetStatus(100_000, 120_000).remaining).toBe(-20_000);
    expect(budgetStatus(0, 5_000).level).toBe('ok');
  });
  test('crossed level fires once per threshold', () => {
    expect(crossedLevel(100_000, 70_000, 85_000)).toBe('warn');
    expect(crossedLevel(100_000, 85_000, 90_000)).toBeNull();
    expect(crossedLevel(100_000, 85_000, 100_000)).toBe('over');
    expect(crossedLevel(100_000, 10_000, 150_000)).toBe('over');
    expect(crossedLevel(100_000, 110_000, 120_000)).toBeNull();
  });
});

describe('validateTx', () => {
  const base = { type: 'expense' as const, amount: 10_000, walletId: 'w', toWalletId: null, categoryId: 'c' };
  test('valid expense', () => expect(validateTx(base)).toBeNull());
  test('rejects zero, decimals, missing category', () => {
    expect(validateTx({ ...base, amount: 0 })).not.toBeNull();
    expect(validateTx({ ...base, amount: 10.5 })).not.toBeNull();
    expect(validateTx({ ...base, categoryId: null })).not.toBeNull();
  });
  test('transfer needs a different destination, no category', () => {
    const t = { ...base, type: 'transfer' as const, categoryId: null };
    expect(validateTx({ ...t, toWalletId: null })).not.toBeNull();
    expect(validateTx({ ...t, toWalletId: 'w' })).not.toBeNull();
    expect(validateTx({ ...t, toWalletId: 'w2' })).toBeNull();
  });
});

describe('pace', () => {
  const p = periodFor(new Date(2026, 10, 15), 1); // 1-30 Nov
  test('allowance per day counts today, rounds down', () => {
    expect(pace(600_000, 400_000, p, new Date(2026, 10, 25, 21))).toEqual({ daysLeft: 6, perDay: 100_000, avgPerDay: 16_000 });
    expect(pace(100_000, 0, p, new Date(2026, 10, 28)).perDay).toBe(33_333);
  });
  test('last day and overspent', () => {
    expect(pace(50_000, 0, p, new Date(2026, 10, 30, 23)).daysLeft).toBe(1);
    expect(pace(-20_000, 120_000, p, new Date(2026, 10, 10)).perDay).toBe(0);
  });
  test('payday period crossing the month end', () => {
    const q = periodFor(new Date(2026, 10, 30), 25); // 25 Nov - 24 Dec
    expect(pace(300_000, 0, q, new Date(2026, 11, 22)).daysLeft).toBe(3);
  });
});

describe('reminders', () => {
  const now = new Date(2026, 10, 26, 20);
  const base = { now, lastBackup: now.getTime(), firstUse: now.getTime(), budgets: [], hasAnyTx: true, hasTxToday: true };
  test('nothing to say when everything is fine', () => expect(reminders(base)).toEqual([]));
  test('over budget first, then almost spent, then backup, then today', () => {
    const r = reminders({
      ...base,
      lastBackup: now.getTime() - 40 * 86_400_000,
      hasTxToday: false,
      budgets: [
        { name: 'Makan', limit: 100_000, spent: 85_000 },
        { name: 'Hiburan', limit: 50_000, spent: 60_000 },
        { name: 'Transport', limit: 100_000, spent: 10_000 },
      ],
    });
    expect(r.map((x) => x.id)).toEqual(['over-Hiburan', 'warn-Makan', 'backup', 'today']);
    expect(r[2].title).toBe('Sudah 40 hari tanpa backup');
  });
  test('never backed up counts from first use; no "today" nag before the first transaction', () => {
    const r = reminders({ ...base, lastBackup: null, firstUse: now.getTime() - 31 * 86_400_000, hasAnyTx: false, hasTxToday: false });
    expect(r.map((x) => x.title)).toEqual(['Belum pernah backup']);
  });
});

describe('squirrelLines', () => {
  const base = { budget: { limit: 1_000_000, remaining: 600_000, level: 'ok' as const }, perDay: 100_000, daysLeft: 6, spentToday: 25_000, hasAnyTx: true, reminderTitles: [], hidden: false };
  test('allowance first, then today, then the sign-off', () => {
    expect(squirrelLines(base)).toEqual([
      'Jatah belanja hari ini Rp100.000. Masih aman!',
      'Hari ini sudah keluar Rp25.000.',
      'Aku simpan biji ek untuk nanti. Kamu juga ya!',
    ]);
  });
  test('warns when almost spent, nudges when no budget, passes reminders through', () => {
    expect(squirrelLines({ ...base, budget: { limit: 100, remaining: 10, level: 'warn' } })[0]).toContain('sisa budget Rp10 untuk 6 hari');
    expect(squirrelLines({ ...base, budget: { limit: 0, remaining: 0, level: 'ok' }, reminderTitles: ['Belum pernah backup'] })).toContain('Belum pernah backup.');
    expect(squirrelLines({ ...base, budget: { limit: 0, remaining: 0, level: 'ok' } })[0]).toContain('Atur budget');
  });
  test('never reveals amounts while balances are hidden', () => {
    expect(squirrelLines({ ...base, hidden: true }).join(' ')).not.toMatch(/Rp\d/);
  });
});
