import { eq } from "drizzle-orm";
import { db, tables } from "./index";

export function getSetting(key: string): string | null {
  return db.select().from(tables.appSettings).where(eq(tables.appSettings.key, key)).get()?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  db.insert(tables.appSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: tables.appSettings.key, set: { value } })
    .run();
}

export function getJsonSetting<T>(key: string, fallback: T): T {
  const raw = getSetting(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
