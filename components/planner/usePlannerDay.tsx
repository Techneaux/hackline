"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

// Client-side shape of a planner day; JSON columns are parsed.
export interface MustDoItem {
  id: string;
  taskId?: number;
  text?: string;
  done: boolean;
}

export interface ConnectItem {
  person: string;
  how: string;
}

export interface DayState {
  date: string;
  messageToSelf: string;
  morning: Record<string, string>;
  top3: string[];
  scheduleNotes: Record<string, string>;
  mustDo: MustDoItem[];
  connect: ConnectItem[];
  notes: string;
  evening: Record<string, string>;
  tomorrowPlanned: boolean;
  morningCompletedAt: string | null;
  eveningCompletedAt: string | null;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface PlannerDayApi {
  day: DayState;
  status: SaveStatus;
  /** Merge a partial update into state and schedule a debounced save. */
  update(patch: Partial<DayState>): void;
  /** Save immediately (blur/unmount). */
  flush(): void;
}

const Ctx = createContext<PlannerDayApi | null>(null);

function parseDay(date: string, row: Record<string, unknown>): DayState {
  const j = (v: unknown, fallback: unknown) => {
    if (typeof v !== "string" || !v) return fallback;
    try {
      return JSON.parse(v);
    } catch {
      return fallback;
    }
  };
  return {
    date,
    messageToSelf: (row.messageToSelf as string) ?? "",
    morning: j(row.morningJson, {}) as Record<string, string>,
    top3: j(row.top3Json, ["", "", ""]) as string[],
    scheduleNotes: j(row.scheduleNotesJson, {}) as Record<string, string>,
    mustDo: j(row.mustDoJson, []) as MustDoItem[],
    connect: j(row.connectJson, []) as ConnectItem[],
    notes: (row.notes as string) ?? "",
    evening: j(row.eveningJson, {}) as Record<string, string>,
    tomorrowPlanned: Boolean(row.tomorrowPlanned),
    morningCompletedAt: (row.morningCompletedAt as string) ?? null,
    eveningCompletedAt: (row.eveningCompletedAt as string) ?? null,
  };
}

/** Any content entered in the daytime part of the planner (everything above the evening journal). */
function hasDayContent(d: DayState): boolean {
  return (
    d.messageToSelf.trim() !== "" ||
    d.notes.trim() !== "" ||
    d.mustDo.length > 0 ||
    Object.values(d.morning).some((v) => v.trim() !== "") ||
    d.top3.some((v) => v.trim() !== "") ||
    d.connect.some((c) => (c.person ?? "").trim() !== "" || (c.how ?? "").trim() !== "")
  );
}

/** Any content entered in the evening section (journal or tomorrow-planned check). */
function hasEveningContent(d: DayState): boolean {
  return d.tomorrowPlanned || Object.values(d.evening).some((v) => v.trim() !== "");
}

function serialize(day: DayState) {
  return {
    messageToSelf: day.messageToSelf,
    morningJson: day.morning,
    top3Json: day.top3,
    scheduleNotesJson: day.scheduleNotes,
    mustDoJson: day.mustDo,
    connectJson: day.connect,
    notes: day.notes,
    eveningJson: day.evening,
    tomorrowPlanned: day.tomorrowPlanned ? 1 : 0,
    morningCompletedAt: day.morningCompletedAt,
    eveningCompletedAt: day.eveningCompletedAt,
  };
}

export function PlannerDayProvider({
  date,
  initial,
  children,
}: {
  date: string;
  initial: Record<string, unknown>;
  children: React.ReactNode;
}) {
  const [day, setDay] = useState<DayState>(() => parseDay(date, initial));
  const [status, setStatus] = useState<SaveStatus>("idle");
  // dayRef is the authoritative state: update() writes it synchronously so a
  // flush() in the same event handler serializes the just-made change, not the
  // pre-render snapshot.
  const dayRef = useRef(day);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  const saving = useRef(false);

  const save = useCallback(async () => {
    // Serialize saves so an older in-flight PATCH can't land after (and
    // overwrite) a newer one; the finally block re-runs if edits arrived
    // while a save was in flight.
    if (saving.current || !dirty.current) return;
    saving.current = true;
    dirty.current = false;
    let failed = false;
    setStatus("saving");
    try {
      const res = await fetch(`/api/planner/day/${dayRef.current.date}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(serialize(dayRef.current)),
      });
      if (!res.ok) throw new Error(String(res.status));
      setStatus("saved");
    } catch {
      dirty.current = true;
      failed = true; // no auto-retry loop; the next edit re-triggers a save
      setStatus("error");
    } finally {
      saving.current = false;
      if (dirty.current && !failed && timer.current === null) void save();
    }
  }, []);

  const update = useCallback(
    (patch: Partial<DayState>) => {
      const next = { ...dayRef.current, ...patch };

      // Auto-stamp completion the first time a section gains ANY content.
      // "Day" = anything entered above the evening journal; "evening" = the
      // evening journal. Stamp-once: clearing content later doesn't un-mark it.
      if (!next.morningCompletedAt && hasDayContent(next)) {
        next.morningCompletedAt = new Date().toISOString();
      }
      if (!next.eveningCompletedAt && hasEveningContent(next)) {
        next.eveningCompletedAt = new Date().toISOString();
      }
      dayRef.current = next;
      setDay(next);
      dirty.current = true;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        void save();
      }, 750);
    },
    [save],
  );

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    void save();
  }, [save]);

  // Flush pending edits when navigating away.
  useEffect(() => {
    const onHide = () => {
      if (dirty.current) {
        navigator.sendBeacon?.(
          `/api/planner/day/${dayRef.current.date}`,
          new Blob([JSON.stringify(serialize(dayRef.current))], { type: "application/json" }),
        );
      }
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      onHide();
    };
  }, []);

  const api = useMemo(() => ({ day, status, update, flush }), [day, status, update, flush]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function usePlannerDay(): PlannerDayApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePlannerDay must be inside PlannerDayProvider");
  return ctx;
}
