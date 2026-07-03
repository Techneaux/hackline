import { describe, expect, it } from "vitest";
import { addDays, dayOfWeek, isValidDateKey, localDate, localDayBounds } from "@/lib/time";

describe("date keys", () => {
  it("validates keys", () => {
    expect(isValidDateKey("2026-07-03")).toBe(true);
    expect(isValidDateKey("2026-02-30")).toBe(false);
    expect(isValidDateKey("2026-7-3")).toBe(false);
    expect(isValidDateKey("garbage")).toBe(false);
  });

  it("adds days across month/year boundaries", () => {
    expect(addDays("2026-07-03", 1)).toBe("2026-07-04");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("computes day of week", () => {
    expect(dayOfWeek("2026-07-03")).toBe(5); // Friday
    expect(dayOfWeek("2026-06-28")).toBe(0); // Sunday
  });
});

describe("localDayBounds (America/Chicago)", () => {
  it("bounds a CDT summer day (UTC-5)", () => {
    const { start, end } = localDayBounds("2026-07-03");
    expect(start.toISOString()).toBe("2026-07-03T05:00:00.000Z");
    expect(end.toISOString()).toBe("2026-07-04T05:00:00.000Z");
  });

  it("bounds a CST winter day (UTC-6)", () => {
    const { start, end } = localDayBounds("2026-01-15");
    expect(start.toISOString()).toBe("2026-01-15T06:00:00.000Z");
    expect(end.toISOString()).toBe("2026-01-16T06:00:00.000Z");
  });

  it("handles spring-forward day (23h)", () => {
    // DST starts 2026-03-08 in the US.
    const { start, end } = localDayBounds("2026-03-08");
    expect(end.getTime() - start.getTime()).toBe(23 * 3600_000);
  });

  it("handles fall-back day (25h)", () => {
    // DST ends 2026-11-01.
    const { start, end } = localDayBounds("2026-11-01");
    expect(end.getTime() - start.getTime()).toBe(25 * 3600_000);
  });

  it("round-trips: every bound instant maps back to the right local date", () => {
    for (const key of ["2026-07-03", "2026-03-08", "2026-11-01"]) {
      const { start, end } = localDayBounds(key);
      expect(localDate(start)).toBe(key);
      expect(localDate(new Date(end.getTime() - 1))).toBe(key);
      expect(localDate(end)).toBe(addDays(key, 1));
    }
  });
});
