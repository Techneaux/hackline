// All date math for the app lives here. Storage is UTC ISO-8601; the planner is
// keyed by the user's local date in America/Chicago.

export const TIMEZONE = "America/Chicago";

const localDateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const localTimeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMEZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const localHmFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** 'YYYY-MM-DD' local date for a UTC instant (defaults to now). */
export function localDate(d: Date = new Date()): string {
  return localDateFmt.format(d);
}

/** 'h:mm AM' style local time for a UTC instant. */
export function localTime(d: Date): string {
  return localTimeFmt.format(d);
}

/** 'HH:MM' 24h local time for a UTC instant (slot keys). */
export function localHm(d: Date): string {
  return localHmFmt.format(d);
}

export function isValidDateKey(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Add days to a 'YYYY-MM-DD' key (pure calendar math, no tz involvement). */
export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Day of week 0=Sunday..6=Saturday for a 'YYYY-MM-DD' key. */
export function dayOfWeek(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** UTC instant of local midnight starting the given local date (DST-aware). */
function localMidnightUtc(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  const utcMidnight = Date.UTC(y, m - 1, d);
  // America/Chicago is UTC-5 (CDT) or UTC-6 (CST); try both offsets.
  for (const offsetHours of [5, 6]) {
    const candidate = utcMidnight + offsetHours * 3600_000;
    if (localDate(new Date(candidate)) === dateKey && localHm(new Date(candidate)) === "00:00") {
      return candidate;
    }
  }
  // Spring-forward day where local midnight is skipped can't happen at 00:00 in
  // the US (transitions at 02:00), but fall back defensively to CST.
  return utcMidnight + 6 * 3600_000;
}

/** UTC instants bounding a local calendar date [start, end). */
export function localDayBounds(dateKey: string): { start: Date; end: Date } {
  return {
    start: new Date(localMidnightUtc(dateKey)),
    end: new Date(localMidnightUtc(addDays(dateKey, 1))),
  };
}

/** Pretty header like 'Thursday, July 3, 2026' for a date key. */
export function formatDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}
