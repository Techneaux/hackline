"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? res.statusText);
  return json;
};

interface CalendarInfo {
  id: string;
  summary: string;
  primary: boolean;
  color: string | null;
  accessRole: string;
}

export default function GoogleCalendarPicker({
  accountId,
  onSynced,
}: {
  accountId: number;
  onSynced?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { data, error, mutate } = useSWR<{ calendars: CalendarInfo[]; selected: string[] }>(
    open ? `/api/accounts/${accountId}/calendars` : null,
    fetcher,
  );
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (data && selected === null) setSelected(new Set(data.selected));
  }, [data, selected]);

  const dirty =
    data && selected !== null &&
    (selected.size !== data.selected.length || data.selected.some((id) => !selected.has(id)));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    if (!selected?.size) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/accounts/${accountId}/calendars`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendarIds: [...selected] }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setMessage("Saved — events resynced.");
      mutate();
      onSynced?.();
    } catch (err) {
      setMessage(`Failed: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-muted underline hover:text-foreground"
      >
        {open ? "Hide calendars" : "Choose calendars…"}
      </button>

      {open && (
        <div className="mt-2 rounded-md border border-border bg-surface p-3">
          {error && (
            <p className="text-xs" style={{ color: "var(--danger)" }}>
              Couldn&apos;t load calendars: {String(error.message ?? error)}
            </p>
          )}
          {!data && !error && <p className="text-xs text-muted">Loading calendars…</p>}
          {data && selected && (
            <>
              <ul className="space-y-1.5">
                {data.calendars.map((c) => (
                  <li key={c.id}>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => toggle(c.id)}
                        className="accent-[var(--accent)]"
                      />
                      {c.color && <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />}
                      <span className="min-w-0 truncate">
                        {c.summary}
                        {c.primary && <span className="ml-1.5 text-[10px] text-muted">primary</span>}
                        {c.accessRole === "reader" && (
                          <span className="ml-1.5 text-[10px] text-muted">read-only</span>
                        )}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={save}
                  disabled={saving || !dirty || selected.size === 0}
                  className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-background disabled:opacity-50"
                >
                  {saving ? "Saving & resyncing…" : "Save selection"}
                </button>
                {selected.size === 0 && (
                  <span className="text-xs" style={{ color: "var(--danger)" }}>
                    Select at least one calendar.
                  </span>
                )}
                {message && <span className="text-xs text-muted">{message}</span>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
