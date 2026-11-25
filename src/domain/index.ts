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
