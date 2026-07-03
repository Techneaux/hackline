import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, gte, inArray, isNotNull, lte, or } from "drizzle-orm";
import { db, tables } from "@/lib/db";
import { homeFilterIds, PRIORITY_SECTION_NAME, WORK_PROJECT_NAME } from "@/lib/sources/todoist";
import { localDate, localDayBounds } from "@/lib/time";

// Todoist is read-only in this app: we mirror it locally via sync and only ever
// read here. There is no task-creation or completion write-back endpoint.

function listHome() {
  const ids = homeFilterIds();
  if (!ids.length) return [];
  const rows = db
    .select()
    .from(tables.tasks)
    .where(
      and(
        eq(tables.tasks.source, "todoist"),
        eq(tables.tasks.completed, 0),
        inArray(tables.tasks.externalId, ids),
      ),
    )
    .all();
  // Preserve the filter's own ordering.
  const order = new Map(ids.map((id, i) => [id, i]));
  return rows.sort((a, b) => (order.get(a.externalId!) ?? 0) - (order.get(b.externalId!) ?? 0));
}

function listWork() {
  return db
    .select()
    .from(tables.tasks)
    .where(
      and(
        eq(tables.tasks.source, "todoist"),
        eq(tables.tasks.completed, 0),
        eq(tables.tasks.projectName, WORK_PROJECT_NAME),
        eq(tables.tasks.sectionName, PRIORITY_SECTION_NAME),
      ),
    )
    .orderBy(asc(tables.tasks.sortOrder))
    .all();
}

function listToday() {
  const today = localDate();
  // Completed tasks only linger if they were completed TODAY (local time) —
  // keying on dueDate would accumulate every historical completion forever.
  const todayStartIso = localDayBounds(today).start.toISOString();
  return db
    .select()
    .from(tables.tasks)
    .where(
      and(
        or(
          and(eq(tables.tasks.completed, 0), isNotNull(tables.tasks.dueDate), lte(tables.tasks.dueDate, today)),
          and(eq(tables.tasks.completed, 1), isNotNull(tables.tasks.completedAt), gte(tables.tasks.completedAt, todayStartIso)),
        ),
      ),
    )
    .orderBy(asc(tables.tasks.completed), asc(tables.tasks.dueDate), asc(tables.tasks.sortOrder))
    .all();
}

export async function GET(req: NextRequest) {
  const list = req.nextUrl.searchParams.get("list") ?? req.nextUrl.searchParams.get("filter") ?? "today";
  const rows = list === "home" ? listHome() : list === "work" ? listWork() : listToday();
  return NextResponse.json(rows);
}
