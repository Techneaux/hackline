import { and, eq, gte, inArray, lt, notInArray } from "drizzle-orm";
import { db, tables } from "@/lib/db";
import type { Account } from "@/lib/db/schema";
import { googleSource } from "@/lib/sources/google";
import { todoistSource } from "@/lib/sources/todoist";
import type { CalendarSource, NormalizedEvent, SyncWindow, TaskSource } from "@/lib/sources/types";

const calendarSources = new Map<string, CalendarSource>([["google", googleSource]]);
const taskSources = new Map<string, TaskSource>([["todoist", todoistSource]]);

export function getTaskSource(kind: string): TaskSource | undefined {
  return taskSources.get(kind);
}

/**
 * Todoist is configured via TODOIST_API_TOKEN in .env.local (the token is not
 * stored in the DB). Provision the account row on boot so the sync engine and
 * accounts UI treat it like any other account.
 */
export function ensureTodoistAccount(): void {
  if (!process.env.TODOIST_API_TOKEN) return;
  const existing = db.select().from(tables.accounts).where(eq(tables.accounts.kind, "todoist")).get();
  if (existing) return;
  const now = nowIso();
  db.insert(tables.accounts)
    .values({
      kind: "todoist",
      domain: "tasks",
      label: "Todoist",
      identity: null,
      authJson: null,
      color: "#F5C84C",
      status: "ok",
      createdAt: now,
      updatedAt: now,
    })
    .run();
}

// Per-(account,resource) in-process locks so overlapping runs don't race.
const locks = new Set<string>();

function nowIso() {
  return new Date().toISOString();
}

function getCursor(accountId: number, resource: string): string | null {
  const row = db
    .select()
    .from(tables.syncState)
    .where(and(eq(tables.syncState.accountId, accountId), eq(tables.syncState.resource, resource)))
    .get();
  return row?.cursor ?? null;
}

function saveSyncState(accountId: number, resource: string, cursor: string | null, error: string | null) {
  db.insert(tables.syncState)
    .values({ accountId, resource, cursor, lastSyncedAt: error ? null : nowIso(), lastError: error })
    .onConflictDoUpdate({
      target: [tables.syncState.accountId, tables.syncState.resource],
      set: error
        ? { lastError: error }
        : { cursor, lastSyncedAt: nowIso(), lastError: null },
    })
    .run();
  db.update(tables.accounts)
    .set({ status: error ? "error" : "ok", updatedAt: nowIso() })
    .where(eq(tables.accounts.id, accountId))
    .run();
}

/** Default sync window: −30d … +90d. */
export function defaultWindow(): SyncWindow {
  const now = Date.now();
  return { from: new Date(now - 30 * 86400_000), to: new Date(now + 90 * 86400_000) };
}

// The transaction handle passed to db.transaction()'s callback.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function upsertEvents(tx: Tx, accountId: number, events: NormalizedEvent[]) {
  for (const e of events) {
    tx.insert(tables.calendarEvents)
      .values({
        accountId,
        externalId: e.externalId,
        calendarId: e.calendarId ?? null,
        title: e.title,
        description: e.description ?? null,
        location: e.location ?? null,
        startTs: e.startTs,
        endTs: e.endTs,
        allDay: e.allDay ? 1 : 0,
        status: e.status,
        attendeesJson: e.attendees ? JSON.stringify(e.attendees) : null,
        rawJson: e.raw ? JSON.stringify(e.raw) : null,
        updatedAt: nowIso(),
      })
      .onConflictDoUpdate({
        target: [tables.calendarEvents.accountId, tables.calendarEvents.externalId],
        set: {
          calendarId: e.calendarId ?? null,
          title: e.title,
          description: e.description ?? null,
          location: e.location ?? null,
          startTs: e.startTs,
          endTs: e.endTs,
          allDay: e.allDay ? 1 : 0,
          status: e.status,
          attendeesJson: e.attendees ? JSON.stringify(e.attendees) : null,
          rawJson: e.raw ? JSON.stringify(e.raw) : null,
          updatedAt: nowIso(),
        },
      })
      .run();
  }
}

export async function syncCalendarAccount(account: Account): Promise<void> {
  const source = calendarSources.get(account.kind);
  if (!source) return;
  const resource = "calendar";
  const lockKey = `${account.id}:${resource}`;
  if (locks.has(lockKey)) return;
  locks.add(lockKey);
  try {
    const window = defaultWindow();
    const cursor = getCursor(account.id, resource);
    const result = await source.sync(account, cursor, window);

    db.transaction((tx) => {
      if (result.full) {
        // Snapshot semantics: replace everything in the window for this account.
        const keepIds = result.events.map((e) => e.externalId);
        tx.delete(tables.calendarEvents)
          .where(
            and(
              eq(tables.calendarEvents.accountId, account.id),
              gte(tables.calendarEvents.startTs, window.from.toISOString()),
              lt(tables.calendarEvents.startTs, window.to.toISOString()),
              keepIds.length ? notInArray(tables.calendarEvents.externalId, keepIds) : undefined,
            ),
          )
          .run();
      } else {
        // Per-calendar snapshots (initial fetch / expired cursor): replace just
        // those calendars' windows so remote deletions during the gap are purged.
        for (const calendarId of result.replacedCalendarIds ?? []) {
          const keepIds = result.events
            .filter((e) => e.calendarId === calendarId)
            .map((e) => e.externalId);
          tx.delete(tables.calendarEvents)
            .where(
              and(
                eq(tables.calendarEvents.accountId, account.id),
                eq(tables.calendarEvents.calendarId, calendarId),
                gte(tables.calendarEvents.startTs, window.from.toISOString()),
                lt(tables.calendarEvents.startTs, window.to.toISOString()),
                keepIds.length ? notInArray(tables.calendarEvents.externalId, keepIds) : undefined,
              ),
            )
            .run();
        }
        if (result.deletedIds.length) {
          tx.delete(tables.calendarEvents)
            .where(
              and(
                eq(tables.calendarEvents.accountId, account.id),
                inArray(tables.calendarEvents.externalId, result.deletedIds),
              ),
            )
            .run();
        }
      }
      // Upsert inside the same transaction so the delete-and-replace is atomic:
      // a failed insert can't leave the window emptied of its stale events.
      upsertEvents(tx, account.id, result.events);
    });
    saveSyncState(account.id, resource, result.nextCursor, null);
  } catch (err) {
    saveSyncState(account.id, resource, getCursor(account.id, resource), String(err));
    throw err;
  } finally {
    locks.delete(lockKey);
  }
}

export async function syncTaskAccount(account: Account): Promise<void> {
  const source = taskSources.get(account.kind);
  if (!source) return;
  const resource = "tasks";
  const lockKey = `${account.id}:${resource}`;
  if (locks.has(lockKey)) return;
  locks.add(lockKey);
  try {
    const cursor = getCursor(account.id, resource);
    const result = await source.sync(account, cursor);

    db.transaction((tx) => {
      if (result.full) {
        // A full sync returns only ACTIVE items — completed tasks are absent by
        // design, so restrict the reconcile-delete to open rows or we'd wipe
        // completed history (and break planner must-do links) on every full sync.
        const keepIds = result.upserts
          .map((t) => t.externalId)
          .filter((id): id is string => id !== null);
        tx.delete(tables.tasks)
          .where(
            and(
              eq(tables.tasks.source, source.kind),
              eq(tables.tasks.completed, 0),
              keepIds.length ? notInArray(tables.tasks.externalId, keepIds) : undefined,
            ),
          )
          .run();
      } else if (result.deletedIds.length) {
        tx.delete(tables.tasks)
          .where(
            and(eq(tables.tasks.source, source.kind), inArray(tables.tasks.externalId, result.deletedIds)),
          )
          .run();
      }
      for (const t of result.upserts) {
        tx.insert(tables.tasks)
          .values({
            source: source.kind,
            externalId: t.externalId,
            content: t.content,
            description: t.description ?? null,
            dueDate: t.dueDate ?? null,
            dueDatetime: t.dueDatetime ?? null,
            priority: t.priority,
            projectId: t.projectId ?? null,
            projectName: t.projectName ?? null,
            sectionId: t.sectionId ?? null,
            sectionName: t.sectionName ?? null,
            completed: t.completed ? 1 : 0,
            completedAt: t.completedAt ?? null,
            sortOrder: t.sortOrder,
            updatedAt: nowIso(),
          })
          .onConflictDoUpdate({
            target: [tables.tasks.source, tables.tasks.externalId],
            set: {
              content: t.content,
              description: t.description ?? null,
              dueDate: t.dueDate ?? null,
              dueDatetime: t.dueDatetime ?? null,
              priority: t.priority,
              projectId: t.projectId ?? null,
              projectName: t.projectName ?? null,
              sectionId: t.sectionId ?? null,
              sectionName: t.sectionName ?? null,
              completed: t.completed ? 1 : 0,
              completedAt: t.completedAt ?? null,
              sortOrder: t.sortOrder,
              updatedAt: nowIso(),
            },
          })
          .run();
      }
    });
    saveSyncState(account.id, resource, result.nextCursor, null);
  } catch (err) {
    saveSyncState(account.id, resource, getCursor(account.id, resource), String(err));
    throw err;
  } finally {
    locks.delete(lockKey);
  }
}

/** Sync every account (optionally filtered); errors are recorded, not thrown. */
export async function syncAll(filter?: { accountId?: number; domain?: string }): Promise<void> {
  let rows = db.select().from(tables.accounts).all();
  if (filter?.accountId) rows = rows.filter((a) => a.id === filter.accountId);
  if (filter?.domain) rows = rows.filter((a) => a.domain === filter.domain);
  await Promise.allSettled(
    rows.map((account) =>
      account.domain === "calendar" ? syncCalendarAccount(account) : syncTaskAccount(account),
    ),
  );
}
