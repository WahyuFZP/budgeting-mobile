// Repository: the only place that writes to the database. Screens read via `q.*` + useLiveQuery.
import { and, count, desc, eq, gte, isNull, like, lt, or } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';
import { validateTx, type Period, type TxType } from '../domain';
import { db } from './client';
import { budgets, categories, settings, transactions, wallets, type Category, type Wallet } from './schema';

export const OTHER_EXPENSE = 'default-expense-other';
export const OTHER_INCOME = 'default-income-other';

const stamp = () => {
  const now = new Date();
  return { createdAt: now, updatedAt: now };
};
const alive = <T extends { deletedAt: any }>(t: T) => isNull(t.deletedAt);

// ---------- Queries (pass to useLiveQuery) ----------

export type HistoryFilter = { walletId?: string; categoryId?: string; from?: Date; to?: Date; search?: string };

export const q = {
  wallets: () => db.select().from(wallets).where(alive(wallets)).orderBy(wallets.sortOrder, wallets.createdAt),
  categories: () => db.select().from(categories).where(alive(categories)).orderBy(categories.sortOrder, categories.createdAt),
  settings: () => db.select().from(settings),
  balanceTxs: () =>
    db
      .select({ type: transactions.type, amount: transactions.amount, walletId: transactions.walletId, toWalletId: transactions.toWalletId })
      .from(transactions)
      .where(alive(transactions)),
  flowTxs: (p: Period) =>
    db
      .select({ type: transactions.type, amount: transactions.amount, categoryId: transactions.categoryId, occurredAt: transactions.occurredAt })
      .from(transactions)
      .where(and(alive(transactions), gte(transactions.occurredAt, p.start), lt(transactions.occurredAt, p.end))),
  budgets: (p: Period) => db.select().from(budgets).where(and(alive(budgets), eq(budgets.periodStart, p.start))),
  tx: (id: string) => db.select().from(transactions).where(eq(transactions.id, id)),
  walletTxCount: (p: Period) =>
    db
      .select({ walletId: transactions.walletId, n: count() })
      .from(transactions)
      .where(and(alive(transactions), gte(transactions.occurredAt, p.start), lt(transactions.occurredAt, p.end)))
      .groupBy(transactions.walletId),
  categoryUsage: () =>
    db.select({ categoryId: transactions.categoryId, n: count() }).from(transactions).where(alive(transactions)).groupBy(transactions.categoryId),
  history: (f: HistoryFilter, limit: number) => {
    const c = [alive(transactions)];
    if (f.walletId) c.push(or(eq(transactions.walletId, f.walletId), eq(transactions.toWalletId, f.walletId))!);
    if (f.categoryId) c.push(eq(transactions.categoryId, f.categoryId));
    if (f.from) c.push(gte(transactions.occurredAt, f.from));
    if (f.to) c.push(lt(transactions.occurredAt, f.to));
    if (f.search?.trim()) c.push(like(transactions.note, `%${f.search.trim()}%`));
    return db.select().from(transactions).where(and(...c)).orderBy(desc(transactions.occurredAt)).limit(limit);
  },
};

export const getTx = (id: string) => db.select().from(transactions).where(eq(transactions.id, id)).get();
export const hasWallet = () => !!db.select({ id: wallets.id }).from(wallets).where(isNull(wallets.deletedAt)).limit(1).get();
export const getWallet = (id: string) => db.select().from(wallets).where(eq(wallets.id, id)).get();
export const getCategory = (id: string) => db.select().from(categories).where(eq(categories.id, id)).get();

// ---------- Settings ----------

export const getSetting = (key: string) => db.select().from(settings).where(eq(settings.key, key)).get()?.value;
export function setSetting(key: string, value: string) {
  db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } }).run();
}

// ---------- Seed ----------

const DEFAULT_CATEGORIES: [string, string, 'income' | 'expense', string, string][] = [
  ['default-expense-food', 'Makan & Minum', 'expense', 'silverware-fork-knife', '#A8392D'],
  ['default-expense-transport', 'Transportasi', 'expense', 'motorbike', '#2E6E8E'],
  ['default-expense-bills', 'Tagihan', 'expense', 'receipt-text', '#8A5A00'],
  ['default-expense-shopping', 'Belanja', 'expense', 'cart', '#8E3B5E'],
  ['default-expense-fun', 'Hiburan', 'expense', 'movie-open', '#5B4B9A'],
  ['default-expense-health', 'Kesehatan', 'expense', 'medical-bag', '#1F4D3A'],
  ['default-expense-edu', 'Pendidikan', 'expense', 'school', '#3D5A80'],
  [OTHER_EXPENSE, 'Lainnya', 'expense', 'dots-horizontal-circle', '#56665C'],
  ['default-income-salary', 'Gaji', 'income', 'briefcase', '#1F4D3A'],
  ['default-income-bonus', 'Bonus', 'income', 'gift', '#8A5A00'],
  [OTHER_INCOME, 'Lainnya', 'income', 'dots-horizontal-circle', '#56665C'],
];

// Defaults are identical on every phone; time 0 means any real edit (e.g. hiding one) wins when syncing.
const EPOCH = new Date(0);

export function seedIfEmpty() {
  if (db.select({ n: count() }).from(categories).get()!.n > 0) return;
  db.insert(categories)
    .values(DEFAULT_CATEGORIES.map(([id, name, kind, icon, color], i) => ({ id, name, kind, icon, color, isDefault: true, sortOrder: i, createdAt: EPOCH, updatedAt: EPOCH })))
    .run();
}

// ---------- Wallets ----------

export type WalletInput = Pick<Wallet, 'name' | 'type' | 'initialBalance' | 'color'> & { id?: string; archived?: boolean };
// Material Community Icons names (see DESIGN.md); drizzle/0001_icons.sql moves old emoji rows over.
export const WALLET_ICON = { cash: 'cash', bank: 'bank', ewallet: 'cellphone' } as const;

export function saveWallet(w: WalletInput) {
  if (!w.name.trim()) throw new Error('Nama dompet wajib diisi');
  if (!Number.isSafeInteger(w.initialBalance)) throw new Error('Saldo awal tidak valid');
  const values = { name: w.name.trim(), type: w.type, icon: WALLET_ICON[w.type], color: w.color, initialBalance: w.initialBalance, archived: !!w.archived };
  if (w.id) db.update(wallets).set({ ...values, updatedAt: new Date() }).where(eq(wallets.id, w.id)).run();
  else db.insert(wallets).values({ id: randomUUID(), ...values, ...stamp() }).run();
}

// ---------- Categories ----------

export type CategoryInput = Pick<Category, 'name' | 'kind' | 'icon' | 'color'> & { id?: string; hidden?: boolean };

export function saveCategory(c: CategoryInput) {
  if (!c.name.trim()) throw new Error('Nama kategori wajib diisi');
  const values = { name: c.name.trim(), icon: c.icon || 'tag', color: c.color, hidden: !!c.hidden };
  if (c.id) db.update(categories).set({ ...values, updatedAt: new Date() }).where(eq(categories.id, c.id)).run();
  else db.insert(categories).values({ id: randomUUID(), kind: c.kind, ...values, sortOrder: 100, ...stamp() }).run();
}

/** Business rule: transactions of a deleted category move to "Lainnya"; they are never deleted. */
export function deleteCategory(id: string) {
  const c = getCategory(id);
  if (!c) return;
  if (c.isDefault) throw new Error('Kategori bawaan tidak bisa dihapus, hanya disembunyikan');
  const now = new Date();
  db.transaction((tx) => {
    tx.update(transactions)
      .set({ categoryId: c.kind === 'income' ? OTHER_INCOME : OTHER_EXPENSE, updatedAt: now })
      .where(eq(transactions.categoryId, id))
      .run();
    tx.update(budgets).set({ deletedAt: now, updatedAt: now }).where(eq(budgets.categoryId, id)).run();
    tx.update(categories).set({ deletedAt: now, updatedAt: now }).where(eq(categories.id, id)).run();
  });
}

// ---------- Transactions ----------

export type TxSave = {
  id?: string;
  type: TxType;
  amount: number;
  walletId: string | null;
  toWalletId: string | null;
  categoryId: string | null;
  occurredAt: Date;
  note: string;
};

export function saveTx(t: TxSave) {
  const err = validateTx(t);
  if (err) throw new Error(err);
  const transfer = t.type === 'transfer';
  const values = {
    type: t.type,
    amount: t.amount,
    walletId: t.walletId!,
    toWalletId: transfer ? t.toWalletId : null,
    categoryId: transfer ? null : t.categoryId,
    occurredAt: t.occurredAt,
    note: t.note.trim() || null,
  };
  if (t.id) db.update(transactions).set({ ...values, updatedAt: new Date() }).where(eq(transactions.id, t.id)).run();
  else db.insert(transactions).values({ id: randomUUID(), ...values, ...stamp() }).run();
  setSetting('last_wallet', t.walletId!);
}

export function deleteTx(id: string) {
  const now = new Date();
  db.update(transactions).set({ deletedAt: now, updatedAt: now }).where(eq(transactions.id, id)).run();
}

/** Spent in a category during a period, excluding one transaction (the one being edited). */
export function spentInCategory(categoryId: string, p: Period, excludeId?: string) {
  return db
    .select({ id: transactions.id, amount: transactions.amount })
    .from(transactions)
    .where(
      and(
        alive(transactions),
        eq(transactions.type, 'expense'),
        eq(transactions.categoryId, categoryId),
        gte(transactions.occurredAt, p.start),
        lt(transactions.occurredAt, p.end),
      ),
    )
    .all()
    .filter((t) => t.id !== excludeId)
    .reduce((s, t) => s + t.amount, 0);
}

// ---------- Budgets ----------

export function setBudget(categoryId: string, p: Period, limit: number) {
  const now = new Date();
  const existing = db
    .select()
    .from(budgets)
    .where(and(alive(budgets), eq(budgets.categoryId, categoryId), eq(budgets.periodStart, p.start)))
    .get();
  if (existing) {
    const patch = limit > 0 ? { limitAmount: limit } : { deletedAt: now };
    db.update(budgets).set({ ...patch, updatedAt: now }).where(eq(budgets.id, existing.id)).run();
  } else if (limit > 0) {
    db.insert(budgets).values({ id: randomUUID(), categoryId, periodStart: p.start, periodEnd: p.end, limitAmount: limit, ...stamp() }).run();
  }
}

/** Copy last period's limits into `to`, keeping any limit already set there. Returns rows copied. */
export function copyBudgets(from: Period, to: Period) {
  const have = new Set(q.budgets(to).all().map((b) => b.categoryId));
  const src = q.budgets(from).all().filter((b) => !have.has(b.categoryId));
  for (const b of src) setBudget(b.categoryId, to, b.limitAmount);
  return src.length;
}
