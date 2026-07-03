import { describe, expect, it } from "vitest";
import { eventInWindow, type EventWindow } from "@/lib/events";

// A one-day window for the Chicago date 2026-07-04 (CDT = UTC-5).
const win: EventWindow = {
  from: "2026-07-04T05:00:00.000Z",
  to: "2026-07-05T05:00:00.000Z",
  fromDay: "2026-07-04",
  toDayExclusive: "2026-07-05",
};

describe("eventInWindow — timed events", () => {
  it("includes an event inside the window", () => {
    expect(
      eventInWindow({ allDay: 0, startTs: "2026-07-04T15:00:00.000Z", endTs: "2026-07-04T16:00:00.000Z" }, win),
    ).toBe(true);
  });

  it("excludes an event that ends exactly at the window start (boundary is exclusive)", () => {
    expect(
      eventInWindow({ allDay: 0, startTs: "2026-07-03T20:00:00.000Z", endTs: "2026-07-04T05:00:00.000Z" }, win),
    ).toBe(false);
  });
});

describe("eventInWindow — all-day events (compared by local date)", () => {
  it("includes an all-day event on the window day", () => {
    expect(
      eventInWindow({ allDay: 1, startTs: "2026-07-04T00:00:00.000Z", endTs: "2026-07-05T00:00:00.000Z" }, win),
    ).toBe(true);
  });

  it("excludes tomorrow's all-day event (UTC-midnight-leak guard)", () => {
    expect(
      eventInWindow({ allDay: 1, startTs: "2026-07-05T00:00:00.000Z", endTs: "2026-07-06T00:00:00.000Z" }, win),
    ).toBe(false);
  });

  it("excludes an all-day event that ended before the window", () => {
    expect(
      eventInWindow({ allDay: 1, startTs: "2026-07-03T00:00:00.000Z", endTs: "2026-07-04T00:00:00.000Z" }, win),
    ).toBe(false);
  });

  it("treats a same-day end (no DTEND) as a one-day event", () => {
    expect(
      eventInWindow({ allDay: 1, startTs: "2026-07-04T00:00:00.000Z", endTs: "2026-07-04T00:00:00.000Z" }, win),
    ).toBe(true);
  });
});
