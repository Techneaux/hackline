import { NextRequest, NextResponse } from "next/server";
import { db, tables } from "@/lib/db";
import { isValidDateKey } from "@/lib/time";
import { eq } from "drizzle-orm";

const JSON_FIELDS = [
  "morningJson",
  "top3Json",
  "scheduleNotesJson",
  "mustDoJson",
  "connectJson",
  "eveningJson",
] as const;

const TEXT_FIELDS = ["messageToSelf", "notes", "morningCompletedAt", "eveningCompletedAt"] as const;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!isValidDateKey(date)) return NextResponse.json({ error: "bad date" }, { status: 400 });
  const row = db.select().from(tables.plannerDays).where(eq(tables.plannerDays.date, date)).get();
  return NextResponse.json(row ?? { date });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!isValidDateKey(date)) return NextResponse.json({ error: "bad date" }, { status: 400 });
  const body = await req.json();

  const set: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  for (const f of TEXT_FIELDS) {
    if (body[f] !== undefined) set[f] = body[f];
  }
  for (const f of JSON_FIELDS) {
    if (body[f] !== undefined) set[f] = body[f] === null ? null : JSON.stringify(body[f]);
  }
  if (body.tomorrowPlanned !== undefined) set.tomorrowPlanned = body.tomorrowPlanned ? 1 : 0;

  const row = db
    .insert(tables.plannerDays)
    .values({ date, ...set, updatedAt: set.updatedAt as string })
    .onConflictDoUpdate({ target: tables.plannerDays.date, set })
    .returning()
    .get();
  return NextResponse.json(row);
}

// sendBeacon (used to flush unsaved edits on page hide) can only POST.
export const POST = PATCH;
