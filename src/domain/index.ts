// Pure domain logic: no React, no database. Amounts are always integer Rupiah.

export type TxType = 'income' | 'expense' | 'transfer';

// ---------- Money ----------

/** "15.000" / "Rp 15.000" / "15000" -> 15000. Digits only, so decimals can never sneak in. */
export function parseRupiah(input: string): number | null {
  const digits = input.replace(/\D/g, '');
  if (!digits) return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : null;
}

export function formatRupiah(n: number): string {
  'worklet'; // also runs on the UI thread for the rolling balance
  const sign = n < 0 ? '-' : '';
  return `${sign}Rp${Math.abs(Math.trunc(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

/** What shows instead of an amount while the user has hidden their balances (eye toggle). */
export const HIDDEN_AMOUNT = 'Rp ••••••';

export function isValidAmount(n: unknown): n is number {
  return Number.isSafeInteger(n) && (n as number) > 0;
}

// ---------- Budget period (from payday) ----------

export type Period = { start: Date; end: Date }; // end is exclusive

const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
const startOf = (y: number, m: number, payday: number) => new Date(y, m, Math.min(payday, daysIn(y, m)));

/** Period containing `date`, starting on `payday` (1–31, clamped to month length). */
export function periodFor(date: Date, payday = 1): Period {
  const y = date.getFullYear();
  const m = date.getMonth();
  const thisStart = startOf(y, m, payday);
  const start = date >= thisStart ? thisStart : startOf(y, m - 1, payday);
  // new Date() normalises month overflow (e.g. month 12 -> January next year)
  const n = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  return { start, end: startOf(n.getFullYear(), n.getMonth(), payday) };
}

export const prevPeriod = (p: Period, payday = 1) => periodFor(new Date(p.start.getTime() - 1), payday);
export const nextPeriod = (p: Period, payday = 1) => periodFor(p.end, payday);
export const inPeriod = (d: Date, p: Period) => d >= p.start && d < p.end;

// ---------- Balances ----------

export type BalanceTx = { type: TxType; amount: number; walletId: string; toWalletId: string | null };

/** Balance = initial + income - expense - transfers out + transfers in. Never stored, always derived. */
export function walletBalances(
  wallets: { id: string; initialBalance: number }[],
  txs: BalanceTx[],
): Map<string, number> {
  const bal = new Map(wallets.map((w) => [w.id, w.initialBalance]));
  const add = (id: string | null, v: number) => {
    if (id && bal.has(id)) bal.set(id, bal.get(id)! + v);
  };
  for (const t of txs) {
    if (t.type === 'income') add(t.walletId, t.amount);
    else if (t.type === 'expense') add(t.walletId, -t.amount);
    else {
      add(t.walletId, -t.amount);
      add(t.toWalletId, t.amount);
    }
  }
  return bal;
}

// ---------- Income / expense totals (transfers excluded by rule) ----------

export type FlowTx = { type: TxType; amount: number; categoryId: string | null; occurredAt: Date };

export function totals(txs: FlowTx[], p: Period) {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (!inPeriod(t.occurredAt, p)) continue;
    if (t.type === 'income') income += t.amount;
    if (t.type === 'expense') expense += t.amount;
  }
  return { income, expense };
}

export function spentByCategory(txs: FlowTx[], p: Period): Map<string, number> {
  const out = new Map<string, number>();
  for (const t of txs) {
    if (t.type !== 'expense' || !t.categoryId || !inPeriod(t.occurredAt, p)) continue;
    out.set(t.categoryId, (out.get(t.categoryId) ?? 0) + t.amount);
  }
  return out;
}

// ---------- Budget status ----------

export type BudgetLevel = 'ok' | 'warn' | 'over';
const rank: Record<BudgetLevel, number> = { ok: 0, warn: 1, over: 2 };

export function budgetStatus(limit: number, spent: number) {
  const pct = limit > 0 ? (spent / limit) * 100 : 0;
  const level: BudgetLevel = limit <= 0 ? 'ok' : pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok';
  return { limit, spent, remaining: limit - spent, pct, level };
}

/** Level newly reached when spending goes from `before` to `after`, or null. Used for the post-save warning. */
export function crossedLevel(limit: number, before: number, after: number): BudgetLevel | null {
  const a = budgetStatus(limit, before).level;
  const b = budgetStatus(limit, after).level;
  return rank[b] > rank[a] ? b : null;
}

// ---------- Spending pace ----------

const DAY = 86_400_000;

/** How much can still be spent per day until the period ends, and the average spent per day so far.
 *  Both count today. Integer Rupiah, rounded down so following the allowance never overspends. */
export function pace(remaining: number, spent: number, p: Period, now: Date) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysLeft = Math.max(1, Math.round((p.end.getTime() - today.getTime()) / DAY));
  const daysIn = Math.max(1, Math.round((today.getTime() - p.start.getTime()) / DAY) + 1);
  return { daysLeft, perDay: remaining > 0 ? Math.floor(remaining / daysLeft) : 0, avgPerDay: Math.round(spent / daysIn) };
}

// ---------- Transaction validation ----------

export type TxInput = {
  type: TxType;
  amount: number;
  walletId: string | null;
  toWalletId: string | null;
  categoryId: string | null;
};

export function validateTx(t: TxInput): string | null {
  if (!isValidAmount(t.amount)) return 'Nominal harus lebih dari 0';
  if (!t.walletId) return 'Pilih dompet';
  if (t.type === 'transfer') {
    if (!t.toWalletId) return 'Pilih dompet tujuan';
    if (t.toWalletId === t.walletId) return 'Dompet asal dan tujuan harus berbeda';
  } else if (!t.categoryId) return 'Pilih kategori';
  return null;
}

// ---------- Reminders (bell on Beranda) ----------

export type Reminder = { id: string; icon: 'backup' | 'budget-warn' | 'budget-over' | 'today'; title: string; body: string; href: '/backup' | '/budget' | '/tx' };

/** Things worth the user's attention right now, most urgent first. Pure: derived only from the given facts. */
export function reminders(f: {
  now: Date;
  lastBackup: number | null;
  firstUse: number;
  budgets: { name: string; limit: number; spent: number }[];
  hasAnyTx: boolean;
  hasTxToday: boolean;
}): Reminder[] {
  const out: Reminder[] = [];
  for (const b of f.budgets) {
    const s = budgetStatus(b.limit, b.spent);
    if (s.level === 'over')
      out.push({ id: `over-${b.name}`, icon: 'budget-over', title: `Budget ${b.name} terlampaui`, body: `Terpakai ${Math.round(s.pct)}% dari batas.`, href: '/budget' });
  }
  for (const b of f.budgets) {
    const s = budgetStatus(b.limit, b.spent);
    if (s.level === 'warn')
      out.push({ id: `warn-${b.name}`, icon: 'budget-warn', title: `Budget ${b.name} hampir habis`, body: `Terpakai ${Math.round(s.pct)}%, sisa ${formatRupiah(s.remaining)}.`, href: '/budget' });
  }
  const days = Math.floor((f.now.getTime() - (f.lastBackup ?? f.firstUse)) / DAY);
  if (days >= 30)
    out.push({
      id: 'backup',
      icon: 'backup',
      title: f.lastBackup ? `Sudah ${days} hari tanpa backup` : 'Belum pernah backup',
      body: 'Data hanya ada di HP ini. Simpan salinan terenkripsi supaya aman kalau HP rusak atau hilang.',
      href: '/backup',
    });
  if (f.hasAnyTx && !f.hasTxToday)
    out.push({ id: 'today', icon: 'today', title: 'Belum ada catatan hari ini', body: 'Catat pengeluaran hari ini selagi masih ingat.', href: '/tx' });
  return out;
}

// ---------- What the squirrel says (speech bubble on Beranda) ----------

/** Short lines for the mascot's speech bubble, most relevant first, built only from real figures.
 *  With balances hidden, amounts are masked so the bubble never reveals them. */
export function squirrelLines(f: {
  budget: { limit: number; remaining: number; level: BudgetLevel };
  perDay: number;
  daysLeft: number;
  spentToday: number;
  hasAnyTx: boolean;
  reminderTitles: string[];
  hidden: boolean;
}): string[] {
  const rp = (n: number) => (f.hidden ? 'Rp ••••' : formatRupiah(n));
  const out: string[] = [];
  if (f.budget.limit <= 0) out.push('Atur budget dulu ya, nanti aku hitung jatah harianmu sampai gajian.');
  else if (f.budget.level === 'over') out.push('Budget periode ini sudah lewat. Yuk tahan belanja sampai gajian.');
  else if (f.budget.level === 'warn') out.push(`Pelan-pelan ya, sisa budget ${rp(f.budget.remaining)} untuk ${f.daysLeft} hari lagi.`);
  else out.push(`Jatah belanja hari ini ${rp(f.perDay)}. Masih aman!`);
  if (f.hasAnyTx) out.push(f.spentToday > 0 ? `Hari ini sudah keluar ${rp(f.spentToday)}.` : 'Belum ada pengeluaran hari ini. Hemat!');
  for (const r of f.reminderTitles) out.push(`${r}.`);
  out.push('Aku simpan biji ek untuk nanti. Kamu juga ya!');
  return out;
}
