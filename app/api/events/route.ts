import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, gte, lt, ne } from "drizzle-orm";
import { db, tables } from "@/lib/db";
import { eventInWindow } from "@/lib/events";
import { storedCalendars } from "@/lib/sources/google";
import { localDate } from "@/lib/time";

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (!from || !to) return NextResponse.json({ error: "from and to required" }, { status: 400 });

  const rows = db
    .select({
      id: tables.calendarEvents.id,
      accountId: tables.calendarEvents.accountId,
      calendarId: tables.calendarEvents.calendarId,
      title: tables.calendarEvents.title,
      location: tables.calendarEvents.location,
      startTs: tables.calendarEvents.startTs,
      endTs: tables.calendarEvents.endTs,
      allDay: tables.calendarEvents.allDay,
      status: tables.calendarEvents.status,
      accountLabel: tables.accounts.label,
      accountColor: tables.accounts.color,
    })
    .from(tables.calendarEvents)
    .innerJoin(tables.accounts, eq(tables.calendarEvents.accountId, tables.accounts.id))
    .where(
      and(
        // Padded by a day each side so date-anchored all-day events aren't
        // clipped by the instant comparison; they're re-filtered below.
        gte(tables.calendarEvents.endTs, new Date(new Date(from).getTime() - 86400_000).toISOString()),
        lt(tables.calendarEvents.startTs, new Date(new Date(to).getTime() + 86400_000).toISOString()),
        ne(tables.calendarEvents.status, "cancelled"),
      ),
    )
    .orderBy(asc(tables.calendarEvents.startTs))
    .all();

  // Timed events overlap by instant. All-day events are stored anchored to UTC
  // midnight of their calendar DATE (timezone-less), so compare date strings
  // against the local dates the request spans — otherwise tomorrow's all-day
  // events leak into today (UTC midnight is yesterday evening local time).
  const win = {
    from,
    to,
    fromDay: localDate(new Date(from)),
    toDayExclusive: localDate(new Date(to)), // request bounds end at local midnight
  };
  const inWindow = rows.filter((e) => eventInWindow(e, win));

  // Color + label each event by its Google sub-calendar, falling back to the
  // account's own color/label when we have no cached calendar metadata.
  const calMeta = new Map(
    storedCalendars().map((c) => [`${c.accountId}:${c.id}`, c] as const),
  );
  const events = inWindow.map((e) => {
    const meta = e.calendarId ? calMeta.get(`${e.accountId}:${e.calendarId}`) : undefined;
    return {
      ...e,
      color: meta?.color ?? e.accountColor,
      calendarLabel: meta?.summary ?? e.accountLabel,
    };
  });
  return NextResponse.json(events);
}
