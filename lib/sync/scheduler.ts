import { syncAll } from "./engine";

const CALENDAR_INTERVAL_MS = 15 * 60_000;
const TASKS_INTERVAL_MS = 15 * 60_000;

// Survives HMR: intervals are stored on globalThis and never doubled.
const globalForScheduler = globalThis as unknown as { __syncScheduler?: { started: boolean } };

export function startScheduler() {
  if (globalForScheduler.__syncScheduler?.started) return;
  globalForScheduler.__syncScheduler = { started: true };

  const run = (domain: string) =>
    syncAll({ domain }).catch((err) => console.error(`[sync:${domain}]`, err));

  setInterval(() => run("calendar"), CALENDAR_INTERVAL_MS);
  setInterval(() => run("tasks"), TASKS_INTERVAL_MS);

  // Initial sync shortly after boot (let the server finish starting first).
  setTimeout(() => {
    run("calendar");
    run("tasks");
  }, 3_000);

  console.log("[sync] scheduler started (calendar 15m, tasks 15m)");
}
