// Encrypted backup: JSON dump of all tables -> AES-256-GCM, key = PBKDF2-SHA256(password, random salt).
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync, getRandomBytes } from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { raw } from './client';
import { setSetting } from './repo';

// Insert order respects foreign keys; delete runs in reverse.
const TABLES = ['wallets', 'categories', 'recurring_rules', 'transactions', 'budgets', 'settings'] as const;
const ITER = 200_000; // shortcut: PBKDF2 in pure JS (~seconds on mid phones); upgrade to native Argon2/scrypt if it feels slow
const FORMAT = 'kas-backup-v1';

async function deriveKey(password: string, salt: Uint8Array, iter = ITER) {
  const bytes = await pbkdf2Async(sha256, password, salt, { c: iter, dkLen: 32 });
  return AESEncryptionKey.import(bytes);
}

export async function exportBackup(password: string) {
  if (password.length < 6) throw new Error('Password minimal 6 karakter');
  const tables: Record<string, unknown[]> = {};
  for (const t of TABLES) tables[t] = raw.getAllSync(`SELECT * FROM ${t}`);
  const plain = new TextEncoder().encode(JSON.stringify({ exportedAt: Date.now(), tables }));

  const salt = getRandomBytes(16);
  const sealed = await aesEncryptAsync(plain, await deriveKey(password, salt));
  const body = { format: FORMAT, kdf: 'pbkdf2-sha256', iter: ITER, salt: bytesToHex(salt), data: await sealed.combined('base64') };

  const stamp = new Date().toISOString().slice(0, 10);
  const file = new File(Paths.cache, `kas-backup-${stamp}.kasbak`);
  file.create({ overwrite: true });
  await file.write(JSON.stringify(body));
  await Sharing.shareAsync(file.uri, { mimeType: 'application/octet-stream', dialogTitle: 'Simpan backup Kas' });
  setSetting('last_backup', String(Date.now()));
}

/** Pick a backup file and decrypt it. Returns row counts for confirmation, plus an apply() that replaces all data. */
export async function readBackup(password: string) {
  const pick = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, type: '*/*' });
  if (pick.canceled) return null;
  let body: any;
  try {
    body = JSON.parse(await new File(pick.assets[0].uri).text());
  } catch {
    throw new Error('File bukan backup Kas');
  }
  if (body?.format !== FORMAT || typeof body.salt !== 'string' || typeof body.data !== 'string' || !Number.isInteger(body.iter) || body.iter < 10_000 || body.iter > 5_000_000)
    throw new Error('File bukan backup Kas');

  let data: any;
  try {
    const key = await deriveKey(password, hexToBytes(body.salt), body.iter);
    const plain = await aesDecryptAsync(AESSealedData.fromCombined(body.data), key);
    data = JSON.parse(new TextDecoder().decode(plain));
  } catch {
    throw new Error('Password salah atau file rusak');
  }
  const tables = validate(data);
  const counts = Object.fromEntries(TABLES.map((t) => [t, tables[t].length]));
  return { counts, apply: () => restore(tables) };
}

// Trust boundary: the file may be crafted. Only known tables/columns are accepted; values are bound, never inlined.
function validate(data: any): Record<(typeof TABLES)[number], Record<string, unknown>[]> {
  if (!data || typeof data.tables !== 'object') throw new Error('Isi backup tidak valid');
  const out = {} as Record<(typeof TABLES)[number], Record<string, unknown>[]>;
  for (const t of TABLES) {
    const rows = data.tables[t];
    if (!Array.isArray(rows)) throw new Error(`Tabel ${t} tidak ada di backup`);
    const cols = new Set(raw.getAllSync<{ name: string }>(`PRAGMA table_info(${t})`).map((c) => c.name));
    for (const r of rows) {
      if (!r || typeof r !== 'object') throw new Error(`Baris ${t} tidak valid`);
      for (const [k, v] of Object.entries(r)) {
        if (!cols.has(k)) throw new Error(`Kolom ${t}.${k} tidak dikenal`);
        if (v !== null && typeof v !== 'string' && typeof v !== 'number') throw new Error(`Nilai ${t}.${k} tidak valid`);
      }
    }
    out[t] = rows;
  }
  return out;
}

function restore(tables: Record<(typeof TABLES)[number], Record<string, unknown>[]>) {
  raw.withTransactionSync(() => {
    for (const t of [...TABLES].reverse()) raw.runSync(`DELETE FROM ${t}`);
    for (const t of TABLES)
      for (const r of tables[t]) {
        const keys = Object.keys(r);
        raw.runSync(
          `INSERT INTO ${t} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`,
          keys.map((k) => r[k] as string | number | null),
        );
      }
  });
}
