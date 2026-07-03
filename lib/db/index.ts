import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { chmodSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import * as schema from "./schema";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "hackline.db");

type DB = BetterSQLite3Database<typeof schema>;

// Singleton across HMR reloads in dev.
const globalForDb = globalThis as unknown as { __hacklineDb?: DB };

function createDb(): DB {
  mkdirSync(DATA_DIR, { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  // Restrict perms every boot on the DB and its WAL sidecars — in WAL mode
  // freshly written rows (incl. account auth tokens) live in -wal until
  // checkpoint, so 0600 on the main file alone isn't enough.
  for (const p of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`]) {
    if (existsSync(p)) {
      try {
        chmodSync(p, 0o600);
      } catch {
        // best-effort (e.g. non-POSIX filesystems)
      }
    }
  }
  const database = drizzle(sqlite, { schema });
  migrate(database, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return database;
}

export const db: DB = globalForDb.__hacklineDb ?? (globalForDb.__hacklineDb = createDb());

export * as tables from "./schema";
