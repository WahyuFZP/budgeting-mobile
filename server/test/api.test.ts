// Integration test against the docker-compose Postgres: `npm run db:up && npm run db:migrate && npm test`.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { db } from '../src/db.ts';
import { handler } from '../src/index.ts';

const server = createServer(handler);
let base = '';
before(() => new Promise<void>((r) => server.listen(0, '127.0.0.1', () => ((base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`), r()))));
after(async () => {
  server.close();
  await db.$client.end();
});

const call = async (path: string, body: unknown, token?: string) => {
  const res = await fetch(base + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as any };
};

const run = Date.now();
const email = `a${run}@test.local`;
const T0 = 1_700_000_000_000;
const wallet = (id: string, updated = T0) => ({ id, created_at: T0, updated_at: updated, deleted_at: null, name: id, type: 'cash', icon: '💵', color: '#000', initial_balance: 100_000, sort_order: 0, archived: 0 });
const category = { id: 'default-expense-food', created_at: T0, updated_at: T0, deleted_at: null, name: 'Makan', kind: 'expense', icon: '🍜', color: '#000', is_default: 1, hidden: 0, sort_order: 0 };
const tx = (over: object = {}) => ({ id: 'tx1', created_at: T0, updated_at: T0, deleted_at: null, type: 'expense', amount: 15_000, wallet_id: 'cash', to_wallet_id: null, category_id: 'default-expense-food', occurred_at: T0, note: 'kopi', recurring_rule_id: null, ...over });

let token = '';

test('register, duplicate, login', async () => {
  const r = await call('/register', { email, password: 'rahasia123' });
  assert.equal(r.status, 201);
  assert.equal((await call('/register', { email, password: 'rahasia123' })).status, 409);
  assert.equal((await call('/login', { email, password: 'salah12345' })).status, 401);
  assert.equal((await call('/register', { email: 'bukan-email', password: 'rahasia123' })).status, 400);
  const l = await call('/login', { email: email.toUpperCase(), password: 'rahasia123' });
  assert.equal(l.status, 200);
  token = l.body.token;
});

test('sync needs a valid token', async () => {
  assert.equal((await call('/sync', { cursor: 0 })).status, 401);
  assert.equal((await call('/sync', { cursor: 0 }, 'ngawur')).status, 401);
});

test('phone A pushes, phone B pulls the same rows in app shape', async () => {
  const a = await call('/sync', { cursor: 0, changes: { wallets: [wallet('cash')], categories: [category], transactions: [tx()] } }, token);
  assert.equal(a.status, 200);
  const b = await call('/sync', { cursor: 0, changes: {} }, token);
  assert.deepEqual(b.body.changes.wallets, [wallet('cash')]);
  assert.deepEqual(b.body.changes.categories, [category]);
  assert.deepEqual(b.body.changes.transactions, [tx()]);
  // nothing new after the cursor
  const again = await call('/sync', { cursor: b.body.cursor }, token);
  assert.equal(again.body.changes.transactions.length, 0);
});

test('last write wins on updated_at', async () => {
  const { body: start } = await call('/sync', { cursor: 0 }, token);
  await call('/sync', { cursor: start.cursor, changes: { transactions: [tx({ amount: 99, updated_at: T0 - 1 })] } }, token);
  let r = await call('/sync', { cursor: 0 }, token);
  assert.equal(r.body.changes.transactions[0].amount, 15_000, 'older edit is ignored');

  await call('/sync', { cursor: start.cursor, changes: { transactions: [tx({ amount: 20_000, updated_at: T0 + 1 })] } }, token);
  r = await call('/sync', { cursor: start.cursor }, token);
  assert.equal(r.body.changes.transactions.length, 1, 'newer edit reaches other phones');
  assert.equal(r.body.changes.transactions[0].amount, 20_000);

  // soft delete syncs like any other edit
  await call('/sync', { cursor: 0, changes: { transactions: [tx({ amount: 20_000, updated_at: T0 + 2, deleted_at: T0 + 2 })] } }, token);
  r = await call('/sync', { cursor: 0 }, token);
  assert.equal(r.body.changes.transactions[0].deleted_at, T0 + 2);
});

test('invalid rows are rejected and nothing is half-saved', async () => {
  const bad = await call('/sync', { cursor: 0, changes: { wallets: [wallet('bank')], transactions: [tx({ id: 'tx2', type: 'transfer', to_wallet_id: 'cash', category_id: null })] } }, token);
  assert.equal(bad.status, 400);
  const r = await call('/sync', { cursor: 0 }, token);
  assert.ok(!r.body.changes.wallets.some((w: any) => w.id === 'bank'), 'bank wallet rolled back with the bad transfer');
  assert.equal((await call('/sync', { cursor: 0, changes: { transactions: [tx({ id: 'tx3', amount: 0 })] } }, token)).status, 400);
  assert.equal((await call('/sync', { cursor: 0, changes: { transactions: [tx({ id: 'tx4', amount: 1.5 })] } }, token)).status, 400);
});

test("users never see or reference each other's data", async () => {
  const other = (await call('/register', { email: `b${run}@test.local`, password: 'rahasia123' })).body.token;
  const r = await call('/sync', { cursor: 0 }, other);
  assert.equal(r.body.changes.wallets.length, 0);
  assert.equal(r.body.changes.transactions.length, 0);
  // same ids as user A, but user B has no wallet "cash": foreign key fails
  assert.equal((await call('/sync', { cursor: 0, changes: { transactions: [tx({ id: 'txB' })] } }, other)).status, 400);
  // same default category id for a second user is fine
  assert.equal((await call('/sync', { cursor: 0, changes: { categories: [category] } }, other)).status, 200);
});
