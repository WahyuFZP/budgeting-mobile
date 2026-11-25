// Optional cloud sync with the Kas server (server/). The app stays offline-first: SQLite is the source of truth,
// sync only runs when the user taps it. Last write wins on updated_at, same rule as the server.
import * as SecureStore from 'expo-secure-store';
import { raw } from './client';

// Parents before children (foreign keys). settings stay per device.
const TABLES = ['wallets', 'categories', 'recurring_rules', 'transactions', 'budgets'] as const;

export type SyncAccount = { url: string; email: string } | null;

export async function getAccount(): Promise<SyncAccount> {
  const [url, email, token] = await Promise.all(['sync_url', 'sync_email', 'sync_token'].map((k) => SecureStore.getItemAsync(k)));
  return url && email && token ? { url, email } : null;
}

async function api(url: string, path: string, body: unknown, token?: string) {
  let res: Response;
  try {
    res = await fetch(url.replace(/\/+$/, '') + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Server tidak terjangkau. Cek alamat server dan koneksi Wi-Fi.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`);
  return data;
}

export async function signIn(url: string, email: string, password: string, mode: 'login' | 'register') {
  if (!/^https?:\/\/\S+$/.test(url.trim())) throw new Error('Alamat server harus diawali http:// atau https://');
  const r = await api(url.trim(), mode === 'login' ? '/login' : '/register', { email, password });
  await SecureStore.setItemAsync('sync_url', url.trim());
  await SecureStore.setItemAsync('sync_email', r.email);
  await SecureStore.setItemAsync('sync_token', r.token);
  await resetSyncState(); // new account: push everything, pull everything
}

export async function signOut() {
  await Promise.all(['sync_url', 'sync_email', 'sync_token'].map((k) => SecureStore.deleteItemAsync(k)));
  await resetSyncState();
}

/** Forget what was already synced, so the next sync sends and fetches everything (LWW makes that safe). */
export async function resetSyncState() {
  await Promise.all(['sync_cursor', 'sync_pushed_at'].map((k) => SecureStore.deleteItemAsync(k)));
}

export const lastSyncAt = async () => Number((await SecureStore.getItemAsync('sync_last')) ?? 0) || null;

export async function syncNow() {
  const [url, token] = await Promise.all([SecureStore.getItemAsync('sync_url'), SecureStore.getItemAsync('sync_token')]);
  if (!url || !token) throw new Error('Belum masuk ke akun sync');
  const cursor = Number((await SecureStore.getItemAsync('sync_cursor')) ?? 0);
  // -1, not 0: default categories have updated_at = 0 and must reach the server (transactions reference them)
  const pushedAt = Number((await SecureStore.getItemAsync('sync_pushed_at')) ?? -1);

  // Rows edited while this request is in flight have updated_at >= started, so they go out next time.
  const started = Date.now();
  const changes = Object.fromEntries(TABLES.map((t) => [t, raw.getAllSync(`SELECT * FROM ${t} WHERE updated_at > ?`, [pushedAt])]));
  const sent = Object.values(changes).reduce((n, rows) => n + rows.length, 0);

  const r = await api(url, '/sync', { cursor, changes }, token);
  const received = apply(r.changes);

  await SecureStore.setItemAsync('sync_cursor', String(r.cursor));
  await SecureStore.setItemAsync('sync_pushed_at', String(started));
  await SecureStore.setItemAsync('sync_last', String(Date.now()));
  return { sent, received };
}

// Trust boundary: only known tables/columns; values are bound, never inlined.
function apply(changes: Record<string, unknown>) {
  let n = 0;
  raw.withTransactionSync(() => {
    for (const t of TABLES) {
      const rows = changes?.[t];
      if (!Array.isArray(rows)) continue;
      const cols = new Set(raw.getAllSync<{ name: string }>(`PRAGMA table_info(${t})`).map((c) => c.name));
      for (const row of rows) {
        if (!row || typeof row !== 'object') throw new Error('Data dari server tidak valid');
        const keys = Object.keys(row).filter((k) => cols.has(k));
        if (!keys.includes('id') || !keys.includes('updated_at')) throw new Error('Data dari server tidak valid');
        const vals = keys.map((k) => {
          const v = (row as Record<string, unknown>)[k];
          if (v !== null && typeof v !== 'string' && typeof v !== 'number') throw new Error('Data dari server tidak valid');
          return v as string | number | null;
        });
        const set = keys.filter((k) => k !== 'id').map((k) => `${k} = excluded.${k}`);
        const r = raw.runSync(
          `INSERT INTO ${t} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})
           ON CONFLICT(id) DO UPDATE SET ${set.join(',')} WHERE excluded.updated_at > ${t}.updated_at`,
          vals,
        );
        n += r.changes;
      }
    }
  });
  return n;
}
