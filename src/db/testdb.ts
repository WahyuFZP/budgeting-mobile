// Test-only stand-in for ./client: the same drizzle expo-sqlite driver the app uses, on Node's built-in SQLite,
// with the real migration files applied. Each resetDb() gives a fresh in-memory database.
import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

// getBuiltinModule bypasses Jest's resolver, which does not know node:sqlite yet
const proc = (globalThis as any).process;
const { DatabaseSync } = proc.getBuiltinModule('node:sqlite');
const fs = proc.getBuiltinModule('node:fs');
const path = proc.getBuiltinModule('node:path');

/** The three calls drizzle's expo-sqlite session makes, backed by node:sqlite. */
function expoShim(d: any) {
  return {
    prepareSync(sql: string) {
      const st = d.prepare(sql);
      return {
        executeSync: (params: unknown[] = []) => ({
          getAllSync: () => st.all(...params),
          getFirstSync: () => st.get(...params) ?? null,
          get changes() {
            return st.run(...params).changes;
          },
          lastInsertRowId: 0,
        }),
        executeForRawResultSync: (params: unknown[] = []) => ({
          getAllSync: () => {
            st.setReturnArrays(true);
            return st.all(...params);
          },
        }),
      };
    },
  };
}

export let sqlite: any;
export let db: ExpoSQLiteDatabase<typeof schema>;
export const raw = undefined;

export function resetDb(upTo = Infinity) {
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  const dir = path.join(proc.cwd(), 'drizzle');
  const files = fs.readdirSync(dir).filter((f: string) => f.endsWith('.sql')).sort();
  files.slice(0, upTo).forEach((f: string) => runSqlFile(path.join(dir, f)));
  db = drizzle(expoShim(sqlite) as any, { schema });
}

export function runSqlFile(file: string) {
  for (const stmt of fs.readFileSync(file, 'utf8').split('--> statement-breakpoint')) if (stmt.trim()) sqlite.exec(stmt);
}

export async function initDb() {}
