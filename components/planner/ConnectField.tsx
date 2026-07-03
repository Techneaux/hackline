"use client";

import { AutosaveText } from "./fields";
import { usePlannerDay } from "./usePlannerDay";

export default function ConnectField() {
  const { day, update, flush } = usePlannerDay();
  const rows = day.connect.length ? day.connect : [{ person: "", how: "" }];

  function set(i: number, patch: Partial<{ person: string; how: string }>) {
    const next = rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    update({ connect: next });
  }

  function remove(i: number) {
    update({ connect: rows.filter((_, idx) => idx !== i) });
    flush();
  }

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="group flex items-start gap-2">
          <input
            value={row.person}
            onChange={(e) => set(i, { person: e.target.value })}
            onBlur={flush}
            placeholder="Who"
            className="w-40 shrink-0 rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted/60 hover:border-border focus:border-accent focus:bg-surface-raised"
          />
          <AutosaveText value={row.how} onChange={(v) => set(i, { how: v })} placeholder="How I'll show up for them" />
          {day.connect.length > 0 && (
            <button
              onClick={() => remove(i)}
              className="invisible mt-2 shrink-0 text-xs text-muted hover:text-danger group-hover:visible"
              aria-label={`Remove ${row.person || "person"}`}
            >
              ✕
            </button>
          )}
        </div>
      ))}
      <button
        onClick={() => update({ connect: [...rows, { person: "", how: "" }] })}
        className="rounded-md border border-border px-2.5 py-1 text-xs text-muted hover:border-accent hover:text-foreground"
      >
        + Person
      </button>
    </div>
  );
}
