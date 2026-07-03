import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, tables } from "@/lib/db";
import { addDays, formatDateKey, localDate, localDayBounds } from "@/lib/time";
import DailyPlanner from "@/components/planner/DailyPlanner";
import PlannerKeyNav from "@/components/planner/PlannerKeyNav";
import SyncStatusBar from "@/components/dashboard/SyncStatusBar";

const navBtn =
  "rounded-md border border-border px-2.5 py-1 text-muted hover:border-accent hover:text-foreground";

/**
 * The daily planner for one date. Rendered at `/` (today) and at
 * `/planner/[date]` (any day reached from history).
 */
export default function PlannerScreen({ date }: { date: string }) {
  const row =
    db.select().from(tables.plannerDays).where(eq(tables.plannerDays.date, date)).get() ?? {};
  const bounds = localDayBounds(date);
  const today = localDate();
  const isToday = date === today;

  return (
    <div id="planner-top" className="scroll-mt-6 space-y-6">
      <PlannerKeyNav date={date} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="hpp-label">{isToday ? "Today" : "Daily planner"}</p>
          <h1
            className="text-2xl font-semibold tracking-tight"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            {formatDateKey(date)}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <SyncStatusBar />
          <a href="#evening" className={navBtn} title="Jump to the evening journal">
            ↓ Evening
          </a>
          <span className="mr-1 hidden text-[11px] text-muted sm:inline" title="Keyboard shortcuts">
            ←/→ days · t today
          </span>
          <Link href={`/planner/${addDays(date, -1)}`} className={navBtn}>
            ← Prev
          </Link>
          {!isToday && (
            <Link href="/" className={navBtn}>
              Today
            </Link>
          )}
          <Link href={`/planner/${addDays(date, 1)}`} className={navBtn}>
            Next →
          </Link>
        </div>
      </div>

      <DailyPlanner
        key={date}
        date={date}
        initial={JSON.parse(JSON.stringify(row))}
        dayBounds={{ from: bounds.start.toISOString(), to: bounds.end.toISOString() }}
      />
    </div>
  );
}
