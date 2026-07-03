import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, lte } from "drizzle-orm";
import { db, tables } from "@/lib/db";
import { HABITS } from "@/lib/planner/prompts";
import { isValidDateKey } from "@/lib/time";

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const conds = [];
  if (from) conds.push(gte(tables.habitScores.date, from));
  if (to) conds.push(lte(tables.habitScores.date, to));
  const rows = db
    .select()
    .from(tables.habitScores)
    .where(conds.length ? and(...conds) : undefined)
    .all();
  return NextResponse.json(rows);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { date, habit, score } = body ?? {};
  const validHabit = HABITS.some((h) => h.id === habit);
  if (!isValidDateKey(date ?? "") || !validHabit || ![1, 2, 3, 4, 5].includes(score)) {
    return NextResponse.json({ error: "expected {date, habit, score 1-5}" }, { status: 400 });
  }
  db.insert(tables.habitScores)
    .values({ date, habit, score })
    .onConflictDoUpdate({
      target: [tables.habitScores.date, tables.habitScores.habit],
      set: { score },
    })
    .run();
  return NextResponse.json({ ok: true });
}
