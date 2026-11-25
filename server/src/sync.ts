// Sync: phones push changed rows, then pull everything with seq > their cursor. Last write wins on updated_at.
// Rows travel in the app's SQLite shape: snake_case keys, times as epoch ms, booleans as 0/1.
import { and, asc, eq, getTableColumns, gt, sql } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { db } from './db.ts';
import { budgets, categories, recurringRules, transactions, wallets } from './schema.ts';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Order matters: parents before children (foreign keys).
const TABLES = { wallets, categories, recurring_rules: recurringRules, transactions, budgets } as const;
type Synced = (typeof TABLES)[keyof typeof TABLES];
const SERVER_ONLY = new Set(['userId', 'seq']);

const columns = (t: PgTable) => Object.entries(getTableColumns(t)).filter(([k]) => !SERVER_ONLY.has(k));

/** App row -> drizzle insert values. Unknown keys are ignored; types are checked, Postgres enforces the rest. */
function fromApp(t: Synced, row: unknown, userId: string) {
  if (!row || typeof row !== 'object') throw new HttpError(400, 'Baris tidak valid');
  const r = row as Record<string, unknown>;
  const out: Record<string, unknown> = { userId };
  for (const [key, col] of columns(t)) {
    const v = r[col.name];
    if (v === undefined || v === null) {
      out[key] = null;
    } else if (col.columnType === 'PgTimestamp') {
      if (typeof v !== 'number' || !Number.isFinite(v)) throw new HttpError(400, `${col.name} harus epoch ms`);
      out[key] = new Date(v);
    } else if (col.columnType === 'PgBoolean') {
      out[key] = v === 1 || v === true;
    } else if (typeof v === 'string' || typeof v === 'number') {
      out[key] = v;
    } else throw new HttpError(400, `${col.name} tidak valid`);
  }
  if (typeof out.id !== 'string' || !out.id) throw new HttpError(400, 'id wajib');
  return out;
}

function toApp(t: Synced, row: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [key, col] of columns(t)) {
    const v = row[key];
    out[col.name] = v instanceof Date ? v.getTime() : typeof v === 'boolean' ? (v ? 1 : 0) : v;
  }
  return out;
}

export async function push(userId: string, changes: unknown) {
  if (changes == null) return;
  if (typeof changes !== 'object') throw new HttpError(400, 'changes tidak valid');
  const c = changes as Record<string, unknown>;
  await db.transaction(async (tx) => {
    // One push per user at a time, so seq values commit in order and a cursor never skips a row.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
    for (const [name, t] of Object.entries(TABLES)) {
      const rows = c[name] ?? [];
      if (!Array.isArray(rows)) throw new HttpError(400, `${name} harus array`);
      const set: Record<string, unknown> = { seq: sql`nextval('sync_seq')` };
      for (const [key, col] of columns(t)) if (key !== 'id') set[key] = sql.raw(`excluded."${col.name}"`);
      // shortcut: one statement per row; batch inserts if first syncs with thousands of rows feel slow
      for (const row of rows) {
        await tx
          .insert(t)
          .values(fromApp(t, row, userId) as any)
          .onConflictDoUpdate({ target: [t.userId, t.id], set, setWhere: sql`excluded.updated_at > ${t.updatedAt}` });
      }
    }
  });
}

export async function pull(userId: string, cursor: number) {
  let next = cursor;
  const changes: Record<string, unknown[]> = {};
  // shortcut: no paging; fine for one person's data, add a LIMIT + "more" flag if payloads grow large
  for (const [name, t] of Object.entries(TABLES)) {
    const rows = await db.select().from(t as any).where(and(eq(t.userId, userId), gt(t.seq, cursor))).orderBy(asc(t.seq));
    changes[name] = rows.map((r: any) => {
      next = Math.max(next, r.seq);
      return toApp(t, r);
    });
  }
  return { cursor: next, changes };
}
