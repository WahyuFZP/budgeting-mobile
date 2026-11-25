import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { getRandomBytes } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import migrations from '../../drizzle/migrations';
import * as schema from './schema';

export let raw: SQLiteDatabase;
export let db: ExpoSQLiteDatabase<typeof schema>;

const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

/** Opens the SQLCipher database with a random key kept in Keystore/Keychain, then migrates. */
export async function initDb() {
  if (db) return;
  let key = await SecureStore.getItemAsync('db_key');
  if (!key) {
    key = toHex(getRandomBytes(32));
    await SecureStore.setItemAsync('db_key', key);
  }
  raw = openDatabaseSync('kas.db', { enableChangeListener: true });
  // Must be the first statement. No-op in Expo Go (no SQLCipher there); encrypted in dev/release builds.
  raw.execSync(`PRAGMA key = "x'${key}'"`);
  raw.execSync('PRAGMA foreign_keys = ON');
  db = drizzle(raw, { schema });
  await migrate(db, migrations);
}
