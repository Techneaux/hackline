import { addDays } from "@/lib/time";

export interface EventWindow {
  from: string; // window start, UTC ISO — for timed events
  to: string; // window end, UTC ISO — for timed events
  fromDay: string; // window start, local YYYY-MM-DD — for all-day events
  toDayExclusive: string; // window end, local YYYY-MM-DD — for all-day events
}

/**
 * Whether an event overlaps the requested window. Timed events compare by
 * instant. All-day events are stored anchored to UTC midnight of their calendar
 * DATE, so they must be compared by local date string — otherwise tomorrow's
 * all-day events leak into today (UTC midnight is the prior evening locally).
 */
export function eventInWindow(
  e: { allDay: number | boolean; startTs: string; endTs: string },
  w: EventWindow,
): boolean {
  if (!e.allDay) return e.endTs > w.from && e.startTs < w.to;
  const startDay = e.startTs.slice(0, 10);
  // All-day end dates are exclusive; treat a same-day end (no DTEND) as one day.
  let endDayExclusive = e.endTs.slice(0, 10);
  if (endDayExclusive <= startDay) endDayExclusive = addDays(startDay, 1);
  return startDay < w.toDayExclusive && endDayExclusive > w.fromDay;
}
