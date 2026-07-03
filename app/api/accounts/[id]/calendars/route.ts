import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, tables } from "@/lib/db";
import { listGoogleCalendars } from "@/lib/sources/google";
import { syncAll } from "@/lib/sync/engine";

function getGoogleAccount(id: number) {
  const account = db.select().from(tables.accounts).where(eq(tables.accounts.id, id)).get();
  if (!account || account.kind !== "google") return null;
  return account;
}

/** Calendars available on this Google account + which are selected for sync. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = getGoogleAccount(Number(id));
  if (!account) return NextResponse.json({ error: "not a google account" }, { status: 404 });
  try {
    const calendars = await listGoogleCalendars(account);
    const auth = JSON.parse(account.authJson ?? "{}");
    const selected: string[] = auth.calendarIds?.length ? auth.calendarIds : ["primary"];
    return NextResponse.json({ calendars, selected });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}

/** Replace the synced-calendar selection; wipes the account's events and resyncs clean. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = getGoogleAccount(Number(id));
  if (!account) return NextResponse.json({ error: "not a google account" }, { status: 404 });

  const body = await req.json();
  const calendarIds: unknown = body?.calendarIds;
  if (!Array.isArray(calendarIds) || calendarIds.length === 0 || !calendarIds.every((c) => typeof c === "string")) {
    return NextResponse.json({ error: "calendarIds must be a non-empty string array" }, { status: 400 });
  }

  const auth = JSON.parse(account.authJson ?? "{}");
  auth.calendarIds = calendarIds;

  db.transaction((tx) => {
    tx.update(tables.accounts)
      .set({ authJson: JSON.stringify(auth), updatedAt: new Date().toISOString() })
      .where(eq(tables.accounts.id, account.id))
      .run();
    // Selection changed → clean slate for this account: drop events and cursors,
    // let the next sync repopulate exactly the chosen calendars.
    tx.delete(tables.calendarEvents).where(eq(tables.calendarEvents.accountId, account.id)).run();
    tx.delete(tables.syncState)
      .where(and(eq(tables.syncState.accountId, account.id), eq(tables.syncState.resource, "calendar")))
      .run();
  });

  await syncAll({ accountId: account.id });
  return NextResponse.json({ ok: true, selected: calendarIds });
}
