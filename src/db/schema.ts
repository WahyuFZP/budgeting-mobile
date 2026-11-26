import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Every syncable row: UUID id + created/updated/deleted (soft delete), ready for v2 sync.
const meta = {
  id: text('id').primaryKey(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
};

export const wallets = sqliteTable('wallets', {
  ...meta,
  name: text('name').notNull(),
  type: text('type', { enum: ['cash', 'bank', 'ewallet'] }).notNull(),
  icon: text('icon').notNull(),
  color: text('color').notNull(),
  initialBalance: integer('initial_balance').notNull(), // Rupiah; balance itself is derived, never stored
  sortOrder: integer('sort_order').notNull().default(0),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  // savings goal: a wallet with a target works like a bank "pocket"; progress is its derived balance
  targetAmount: integer('target_amount'),
  targetDate: integer('target_date', { mode: 'timestamp_ms' }),
});

export const categories = sqliteTable('categories', {
  ...meta,
  name: text('name').notNull(),
  kind: text('kind', { enum: ['income', 'expense'] }).notNull(),
  icon: text('icon').notNull(),
  color: text('color').notNull(),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  hidden: integer('hidden', { mode: 'boolean' }).notNull().default(false), // default categories can only be hidden
  sortOrder: integer('sort_order').notNull().default(0),
});

export const transactions = sqliteTable(
  'transactions',
  {
    ...meta,
    type: text('type', { enum: ['income', 'expense', 'transfer'] }).notNull(),
    amount: integer('amount').notNull(), // Rupiah, always positive
    walletId: text('wallet_id').notNull().references(() => wallets.id),
    toWalletId: text('to_wallet_id').references(() => wallets.id),
    categoryId: text('category_id').references(() => categories.id),
    occurredAt: integer('occurred_at', { mode: 'timestamp_ms' }).notNull(),
    note: text('note'),
    recurringRuleId: text('recurring_rule_id'),
  },
  (t) => [
    index('tx_occurred_idx').on(t.occurredAt),
    index('tx_wallet_idx').on(t.walletId),
    index('tx_category_idx').on(t.categoryId),
  ],
);

export const budgets = sqliteTable(
  'budgets',
  {
    ...meta,
    categoryId: text('category_id').notNull().references(() => categories.id),
    periodStart: integer('period_start', { mode: 'timestamp_ms' }).notNull(),
    periodEnd: integer('period_end', { mode: 'timestamp_ms' }).notNull(),
    limitAmount: integer('limit_amount').notNull(),
  },
  (t) => [index('budget_period_idx').on(t.periodStart)],
);

// Monthly bills (frequency 'monthly', next_run_at = next due date) and one-tap templates (frequency 'none').
export const recurringRules = sqliteTable('recurring_rules', {
  ...meta,
  template: text('template').notNull(), // JSON RuleTemplate (domain)
  frequency: text('frequency', { enum: ['none', 'daily', 'weekly', 'monthly', 'yearly'] }).notNull(),
  interval: integer('interval').notNull().default(1),
  nextRunAt: integer('next_run_at', { mode: 'timestamp_ms' }).notNull(),
  endAt: integer('end_at', { mode: 'timestamp_ms' }),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export type Wallet = typeof wallets.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
