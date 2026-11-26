// Postgres mirror of the app's SQLite schema (src/db/schema.ts) for v2 sync. Keep the two in step.
// Primary keys are (user_id, id): the app seeds default categories with fixed text ids
// ("default-expense-food"), identical on every phone, so id alone is not unique across users.
// Composite foreign keys also stop a row from pointing at another user's wallet/category.
import { sql } from 'drizzle-orm';
import { bigint, boolean, check, foreignKey, index, integer, pgSequence, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(), // stored lower-case
  passwordHash: text('password_hash').notNull(), // scrypt
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  tokenHash: text('token_hash').primaryKey(), // sha256 of the bearer token; the token itself is never stored
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: ts('created_at').notNull().defaultNow(),
});

// Server-side change counter. Pull uses "seq > cursor" instead of the phone's clock (updated_at),
// so a row uploaded late with an old updated_at is still delivered to the other phones.
export const syncSeq = pgSequence('sync_seq');

const owned = () => ({
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  id: text('id').notNull(),
  createdAt: ts('created_at').notNull(),
  updatedAt: ts('updated_at').notNull(),
  deletedAt: ts('deleted_at'),
  seq: bigint('seq', { mode: 'number' }).notNull().default(sql`nextval('sync_seq')`),
});
const bySeq = (name: string, t: { userId: any; seq: any }) => index(name).on(t.userId, t.seq);
// Rupiah as bigint (int4 tops out at ~2.1 billion); mode 'number' is exact up to 9e15.
const rupiah = (name: string) => bigint(name, { mode: 'number' });

export const wallets = pgTable(
  'wallets',
  {
    ...owned(),
    name: text('name').notNull(),
    type: text('type', { enum: ['cash', 'bank', 'ewallet'] }).notNull(),
    icon: text('icon').notNull(),
    color: text('color').notNull(),
    initialBalance: rupiah('initial_balance').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    archived: boolean('archived').notNull().default(false),
    targetAmount: rupiah('target_amount'),
    targetDate: ts('target_date'),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] }), bySeq('wallets_seq_idx', t), check('wallet_type', sql`${t.type} in ('cash','bank','ewallet')`)],
);

export const categories = pgTable(
  'categories',
  {
    ...owned(),
    name: text('name').notNull(),
    kind: text('kind', { enum: ['income', 'expense'] }).notNull(),
    icon: text('icon').notNull(),
    color: text('color').notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    hidden: boolean('hidden').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] }), bySeq('categories_seq_idx', t), check('category_kind', sql`${t.kind} in ('income','expense')`)],
);

export const recurringRules = pgTable(
  'recurring_rules',
  {
    ...owned(),
    template: text('template').notNull(), // JSON, same as the app
    frequency: text('frequency', { enum: ['none', 'daily', 'weekly', 'monthly', 'yearly'] }).notNull(),
    interval: integer('interval').notNull().default(1),
    nextRunAt: ts('next_run_at').notNull(),
    endAt: ts('end_at'),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] }), bySeq('recurring_seq_idx', t)],
);

export const transactions = pgTable(
  'transactions',
  {
    ...owned(),
    type: text('type', { enum: ['income', 'expense', 'transfer'] }).notNull(),
    amount: rupiah('amount').notNull(),
    walletId: text('wallet_id').notNull(),
    toWalletId: text('to_wallet_id'),
    categoryId: text('category_id'),
    occurredAt: ts('occurred_at').notNull(),
    note: text('note'),
    recurringRuleId: text('recurring_rule_id'),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.id] }),
    foreignKey({ columns: [t.userId, t.walletId], foreignColumns: [wallets.userId, wallets.id] }),
    foreignKey({ columns: [t.userId, t.toWalletId], foreignColumns: [wallets.userId, wallets.id] }),
    foreignKey({ columns: [t.userId, t.categoryId], foreignColumns: [categories.userId, categories.id] }),
    // Same business rules as src/domain validateTx, enforced again by the database
    check('tx_amount_positive', sql`${t.amount} > 0`),
    check('tx_type', sql`${t.type} in ('income','expense','transfer')`),
    check(
      'tx_shape',
      sql`(${t.type} = 'transfer' and ${t.toWalletId} is not null and ${t.toWalletId} <> ${t.walletId} and ${t.categoryId} is null)
       or (${t.type} <> 'transfer' and ${t.toWalletId} is null and ${t.categoryId} is not null)`,
    ),
    index('tx_user_occurred_idx').on(t.userId, t.occurredAt),
    bySeq('tx_seq_idx', t),
  ],
);

export const budgets = pgTable(
  'budgets',
  {
    ...owned(),
    categoryId: text('category_id').notNull(),
    periodStart: ts('period_start').notNull(),
    periodEnd: ts('period_end').notNull(),
    limitAmount: rupiah('limit_amount').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.id] }),
    foreignKey({ columns: [t.userId, t.categoryId], foreignColumns: [categories.userId, categories.id] }),
    check('budget_limit_positive', sql`${t.limitAmount} > 0`),
    index('budget_user_period_idx').on(t.userId, t.periodStart),
    bySeq('budget_seq_idx', t),
  ],
);

// Not synced: the app's settings are per device (last wallet, last backup, payday).
export const settings = pgTable(
  'settings',
  {
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    value: text('value').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);
