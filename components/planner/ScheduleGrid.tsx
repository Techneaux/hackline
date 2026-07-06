"use client";

import useSWR from "swr";
import { AutosaveText } from "./fields";
import { usePlannerDay } from "./usePlannerDay";
import { fetcher } from "@/lib/fetcher";
import { localHm } from "@/lib/time";


interface EventRow {
  id: number;
  title: string;
  startTs: string;
  endTs: string;
  allDay: number;
  color: string; // the source calendar's color
  calendarLabel: string; // the source calendar's name
}

// 6:00 through 20:00 in half-hour slots.
const SLOTS: string[] = [];
for (let h = 6; h <= 20; h++) {
  SLOTS.push(`${String(h).padStart(2, "0")}:00`);
  if (h < 20) SLOTS.push(`${String(h).padStart(2, "0")}:30`);
}

function slotLabel(slot: string): string {
  const [h, m] = slot.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour12} ${ampm}` : `${hour12}:30`;
}


export default function ScheduleGrid({ dayBounds }: { dayBounds: { from: string; to: string } }) {
  const { day, update } = usePlannerDay();
  const { data: events, error } = useSWR<EventRow[]>(
    `/api/events?from=${encodeURIComponent(dayBounds.from)}&to=${encodeURIComponent(dayBounds.to)}`,
    fetcher,
    { refreshInterval: 5 * 60_000 },
  );

  const allDayEvents = events?.filter((e) => e.allDay) ?? [];
  const timed = events?.filter((e) => !e.allDay) ?? [];

  // Which calendars are represented today, for the color legend.
  const legend = new Map<string, string>(); // label -> color
  for (const e of events ?? []) if (!legend.has(e.calendarLabel)) legend.set(e.calendarLabel, e.color);

  // Map each timed event to its starting slot (clamped into the grid).
  const eventsBySlot = new Map<string, EventRow[]>();
  for (const e of timed) {
    let slot = localHm(new Date(e.startTs));
    if (slot < SLOTS[0]) slot = SLOTS[0];
    if (slot > SLOTS[SLOTS.length - 1]) continue;
    // Snap to the half-hour grid.
    const [h, m] = slot.split(":").map(Number);
    const snapped = `${String(h).padStart(2, "0")}:${m < 30 ? "00" : "30"}`;
    const list = eventsBySlot.get(snapped) ?? [];
    list.push(e);
    eventsBySlot.set(snapped, list);
  }

  return (
    <div>
      {error && (
        <p className="mb-2 text-xs" style={{ color: "var(--danger)" }}>
          Couldn&apos;t load calendar events.
        </p>
      )}
      {/* Color key: which calendar each color represents. Always shown when the
          day has any events, so the color→calendar mapping is never a guess. */}
      {legend.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
          <span className="font-medium uppercase tracking-wide text-muted/80">Calendars</span>
          {[...legend].map(([label, color]) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: color }} />
              {label}
            </span>
          ))}
        </div>
      )}
      {/* All-day events, styled like timed events (colored bar) so they read as
          events, not as calendar tags. */}
      {allDayEvents.length > 0 && (
        <div className="mb-2 flex items-start gap-2 border-b border-border/60 pb-2">
          <span className="w-14 shrink-0 pt-1 text-right text-[11px] uppercase tracking-wide text-muted">
            All day
          </span>
          <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {allDayEvents.map((e) => (
              <span
                key={e.id}
                className="rounded-md border-l-2 bg-surface-raised px-2 py-1 text-xs"
                style={{ borderLeftColor: e.color }}
                title={e.calendarLabel}
              >
                {e.title}
              </span>
            ))}
          </div>
        </div>
      )}
      {/* Only render slots that hold an event. */}
      {(() => {
        const visibleSlots = SLOTS.filter((slot) => (eventsBySlot.get(slot)?.length ?? 0) > 0);
        if (visibleSlots.length === 0) {
          // Stay silent when all-day events are shown above — "No events
          // scheduled." would contradict them; it only fits a truly empty day.
          return allDayEvents.length === 0 ? (
            <p className="py-2 text-xs text-muted">No events scheduled.</p>
          ) : null;
        }
        return (
          <div className="divide-y divide-border/50">
            {visibleSlots.map((slot) => {
              const slotEvents = eventsBySlot.get(slot) ?? [];
              return (
                <div key={slot} className="group flex min-h-9 items-start gap-2 py-0.5">
                  <span className="w-14 shrink-0 pt-2 text-right text-[11px] tabular-nums text-muted">
                    {slotLabel(slot)}
                  </span>
                  <div className="min-w-0 flex-1">
                    {slotEvents.map((e) => (
                      <div
                        key={e.id}
                        className="mt-1 flex items-center gap-2 rounded-md border-l-2 bg-surface-raised px-2 py-1 text-xs"
                        style={{ borderLeftColor: e.color }}
                        title={`${e.calendarLabel} · ${new Date(e.startTs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}–${new Date(e.endTs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
                      >
                        <span className="truncate">{e.title}</span>
                      </div>
                    ))}
                    <AutosaveText
                      value={day.scheduleNotes[slot] ?? ""}
                      onChange={(v) =>
                        update({ scheduleNotes: { ...day.scheduleNotes, [slot]: v } })
                      }
                      className="!py-1 text-xs"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
