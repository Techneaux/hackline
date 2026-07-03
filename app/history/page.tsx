import Link from "next/link";
import { and, gte, lte } from "drizzle-orm";
import { db, tables } from "@/lib/db";
import HabitTrend, { type TrendPoint } from "@/components/history/HabitTrend";
import { addDays, dayOfWeek, localDate } from "@/lib/time";

export const dynamic = "force-dynamic";

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const today = localDate();
  const { month: rawMonth } = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(rawMonth ?? "") ? rawMonth! : today.slice(0, 7);

  const monthStart = `${month}-01`;
  const nextMonthStart = `${shiftMonth(month, 1)}-01`;
  const monthEnd = addDays(nextMonthStart, -1);

  const days = db
    .select({
      date: tables.plannerDays.date,
      morningCompletedAt: tables.plannerDays.morningCompletedAt,
      eveningCompletedAt: tables.plannerDays.eveningCompletedAt,
    })
    .from(tables.plannerDays)
    .where(and(gte(tables.plannerDays.date, monthStart), lte(tables.plannerDays.date, monthEnd)))
    .all();
  const dayMap = new Map(days.map((d) => [d.date, d]));

  const monthScores = db
    .select()
    .from(tables.habitScores)
    .where(and(gte(tables.habitScores.date, monthStart), lte(tables.habitScores.date, monthEnd)))
    .all();
  const scoresByDate = new Map<string, number[]>();
  for (const s of monthScores) {
    (scoresByDate.get(s.date) ?? scoresByDate.set(s.date, []).get(s.date)!).push(s.score);
  }

  // Trend: last 60 days ending today.
  const trendFrom = addDays(today, -59);
  const trendScores = db
    .select()
    .from(tables.habitScores)
    .where(and(gte(tables.habitScores.date, trendFrom), lte(tables.habitScores.date, today)))
    .all();
  const trendByDate = new Map<string, number[]>();
  for (const s of trendScores) {
    (trendByDate.get(s.date) ?? trendByDate.set(s.date, []).get(s.date)!).push(s.score);
  }
  const trendPoints: TrendPoint[] = [...trendByDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, scores]) => ({
      date,
      avg: scores.reduce((a, b) => a + b, 0) / scores.length,
      count: scores.length,
    }));

  // Month grid cells, padded to full weeks.
  const cells: (string | null)[] = [];
  for (let i = 0; i < dayOfWeek(monthStart); i++) cells.push(null);
  for (let d = monthStart; d <= monthEnd; d = addDays(d, 1)) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="hpp-label">History</p>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            {monthLabel(month)}
          </h1>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={`/history?month=${shiftMonth(month, -1)}`}
            className="rounded-md border border-border px-2.5 py-1 text-muted hover:border-accent hover:text-foreground"
          >
            ← Prev
          </Link>
          {month !== today.slice(0, 7) && (
            <Link
              href="/history"
              className="rounded-md border border-border px-2.5 py-1 text-muted hover:border-accent hover:text-foreground"
            >
              This month
            </Link>
          )}
          <Link
            href={`/history?month=${shiftMonth(month, 1)}`}
            className="rounded-md border border-border px-2.5 py-1 text-muted hover:border-accent hover:text-foreground"
          >
            Next →
          </Link>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-surface p-5">
        <div className="mb-2 grid grid-cols-7 text-center">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <span key={d} className="hpp-label">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((dateKey, i) => {
            if (!dateKey) return <div key={`pad-${i}`} />;
            const entry = dayMap.get(dateKey);
            const scores = scoresByDate.get(dateKey);
            const avg = scores ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
            const isToday = dateKey === today;
            const isFuture = dateKey > today;
            return (
              <Link
                key={dateKey}
                href={`/planner/${dateKey}`}
                className="group flex min-h-16 flex-col rounded-lg border p-1.5 transition-colors hover:border-accent"
                style={{
                  borderColor: isToday ? "var(--accent)" : "var(--border)",
                  opacity: isFuture ? 0.45 : 1,
                }}
              >
                <span className={`text-xs tabular-nums ${isToday ? "font-semibold" : "text-muted"}`}>
                  {Number(dateKey.slice(8, 10))}
                </span>
                <span className="mt-auto flex items-center gap-1">
                  {/* day / evening completion dots */}
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    title="Day entries"
                    style={{ background: entry?.morningCompletedAt ? "var(--accent)" : "var(--border)" }}
                  />
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    title="Evening journal"
                    style={{ background: entry?.eveningCompletedAt ? "var(--accent-2)" : "var(--border)" }}
                  />
                  {avg !== null && (
                    <span className="ml-auto text-[10px] tabular-nums" style={{ color: "var(--chart-1)" }}>
                      {avg.toFixed(1)}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] text-muted">
          <span style={{ color: "var(--accent)" }}>●</span> day entries ·{" "}
          <span style={{ color: "var(--accent-2)" }}>●</span> evening journal · number = avg habit score
        </p>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="hpp-label mb-3">Average daily habit score — last 60 days</h2>
        <HabitTrend points={trendPoints} />
      </section>
    </div>
  );
}
