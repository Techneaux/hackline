import { describe, expect, it } from "vitest";
import { normalizeDue } from "@/lib/sources/todoist";
import { normalizeGoogleEvent } from "@/lib/sources/google";

describe("todoist normalizeDue", () => {
  it("date-only due → dueDate, no datetime", () => {
    expect(normalizeDue({ date: "2026-07-04" })).toEqual({
      dueDate: "2026-07-04",
      dueDatetime: null,
    });
  });

  it("fixed-timezone (Z) due keeps the full datetime", () => {
    expect(normalizeDue({ date: "2026-07-04T15:00:00Z" })).toEqual({
      dueDate: "2026-07-04",
      dueDatetime: "2026-07-04T15:00:00Z",
    });
  });

  it("floating (no Z) due is stored as-is", () => {
    expect(normalizeDue({ date: "2026-07-04T15:00:00" })).toEqual({
      dueDate: "2026-07-04",
      dueDatetime: "2026-07-04T15:00:00",
    });
  });

  it("null / empty due → nulls", () => {
    expect(normalizeDue(null)).toEqual({ dueDate: null, dueDatetime: null });
    expect(normalizeDue({ date: "" })).toEqual({ dueDate: null, dueDatetime: null });
  });
});

describe("google normalizeGoogleEvent", () => {
  it("all-day event anchors to UTC midnight of the date", () => {
    const n = normalizeGoogleEvent(
      { id: "abc", status: "confirmed", summary: "Trip", start: { date: "2026-07-04" }, end: { date: "2026-07-05" } },
      "primary",
    );
    expect(n).toMatchObject({
      externalId: "primary:abc",
      title: "Trip",
      allDay: true,
      startTs: "2026-07-04T00:00:00.000Z",
      endTs: "2026-07-05T00:00:00.000Z",
      status: "confirmed",
    });
  });

  it("timed event converts to a UTC instant", () => {
    const n = normalizeGoogleEvent(
      {
        id: "e1",
        status: "confirmed",
        summary: "Standup",
        start: { dateTime: "2026-07-04T15:00:00-05:00" },
        end: { dateTime: "2026-07-04T16:00:00-05:00" },
      },
      "work@example.com",
    );
    expect(n).toMatchObject({
      externalId: "work@example.com:e1",
      allDay: false,
      startTs: "2026-07-04T20:00:00.000Z",
      endTs: "2026-07-04T21:00:00.000Z",
    });
  });

  it("falls back to a placeholder title when summary is missing", () => {
    const n = normalizeGoogleEvent(
      { id: "e2", status: "confirmed", start: { dateTime: "2026-07-04T15:00:00Z" }, end: { dateTime: "2026-07-04T16:00:00Z" } },
      "primary",
    );
    expect(n?.title).toBe("(no title)");
  });

  it("returns null when start or end is missing", () => {
    expect(
      normalizeGoogleEvent({ id: "e3", status: "confirmed", start: { dateTime: "2026-07-04T15:00:00Z" } }, "primary"),
    ).toBeNull();
  });
});
