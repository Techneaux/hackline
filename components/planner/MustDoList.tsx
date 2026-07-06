"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import type { Task } from "@/lib/db/schema";
import { usePlannerDay, type MustDoItem } from "./usePlannerDay";
import { fetcher } from "@/lib/fetcher";

type List = "home" | "work";

/**
 * Must-dos are pulled from Todoist only (read-only): pick existing tasks from
 * the Home or Work priority lists to commit to today. Checking one off is local
 * to the planner — we never write back to Todoist.
 */
export default function MustDoList() {
  const { day, update, flush } = usePlannerDay();
  const { data: homeTasks, error: homeErr, mutate: mutateHome } = useSWR<Task[]>("/api/tasks?list=home", fetcher);
  const { data: workTasks, error: workErr, mutate: mutateWork } = useSWR<Task[]>("/api/tasks?list=work", fetcher);

  const [picker, setPicker] = useState<List | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [syncing, setSyncing] = useState(false);

  const items = day.mustDo;
  const linkedTaskIds = useMemo(
    () => new Set(items.map((i) => i.taskId).filter(Boolean) as number[]),
    [items],
  );

  // Every fetched task by id, for resolving the labels of already-added items.
  const byId = useMemo(() => {
    const m = new Map<number, Task>();
    for (const t of [...(homeTasks ?? []), ...(workTasks ?? [])]) m.set(t.id, t);
    return m;
  }, [homeTasks, workTasks]);

  const groups = useMemo(() => {
    const g: Record<"work" | "home" | "other", MustDoItem[]> = { work: [], home: [], other: [] };
    for (const item of items) g[item.list ?? "other"].push(item);
    return g;
  }, [items]);

  const pickerTasks = picker === "home" ? homeTasks : picker === "work" ? workTasks : undefined;
  const pickerError = picker === "home" ? homeErr : picker === "work" ? workErr : undefined;
  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (pickerTasks ?? [])
      .filter((t) => !linkedTaskIds.has(t.id))
      .filter((t) => !q || t.content.toLowerCase().includes(q));
  }, [pickerTasks, linkedTaskIds, query]);

  function setItems(next: MustDoItem[]) {
    update({ mustDo: next });
  }

  function openPicker(list: List) {
    setPicker((cur) => (cur === list ? null : list));
    setQuery("");
    setSelected(new Set());
  }

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addSelected() {
    if (!selected.size) return;
    const additions: MustDoItem[] = [...selected].map((taskId) => ({
      id: crypto.randomUUID(),
      taskId,
      done: false,
      list: picker ?? undefined,
    }));
    setItems([...items, ...additions]);
    flush();
    setSelected(new Set());
    setQuery("");
    setPicker(null);
  }

  async function syncNow() {
    setSyncing(true);
    try {
      await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: "tasks" }),
      });
      await Promise.all([mutateHome(), mutateWork()]);
    } finally {
      setSyncing(false);
    }
  }

  function labelFor(item: MustDoItem): string {
    if (item.taskId) return byId.get(item.taskId)?.content ?? `(task #${item.taskId})`;
    return item.text ?? "";
  }

  function projectLabel(t: Task): string {
    return [t.projectName, t.sectionName].filter(Boolean).join(" · ");
  }

  const pickerBtn = (list: List, label: string) =>
    `rounded-md border px-2.5 py-1 text-xs hover:border-accent hover:text-foreground ${
      picker === list ? "border-accent text-foreground" : "border-border text-muted"
    }`;

  function renderItem(item: MustDoItem) {
    return (
      <li key={item.id} className="group flex items-center gap-2.5">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: "var(--gold)" }}
          aria-hidden
        />
        <span className="flex-1 text-sm">
          {labelFor(item)}
          {item.taskId && <span className="ml-1.5 text-[10px] text-muted">Todoist</span>}
        </span>
        <button
          onClick={() => {
            setItems(items.filter((i) => i.id !== item.id));
            flush();
          }}
          className="invisible text-xs text-muted hover:text-danger group-hover:visible"
          aria-label="Remove"
        >
          ✕
        </button>
      </li>
    );
  }

  // Rendered in a fixed order; a group only appears once it has items.
  const sections: { key: "work" | "home" | "other"; label: string }[] = [
    { key: "work", label: "Work" },
    { key: "home", label: "Home" },
    { key: "other", label: "Other" },
  ];

  return (
    <div>
      {items.length === 0 ? (
        <p className="text-sm text-muted">No must-dos yet — pull some in from Todoist.</p>
      ) : (
        <div className="space-y-3">
          {sections.map(({ key, label }) =>
            groups[key].length === 0 ? null : (
              <div key={key}>
                <h4 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
                  {label}
                </h4>
                <ul className="space-y-1.5">{groups[key].map(renderItem)}</ul>
              </div>
            ),
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={() => openPicker("home")} className={pickerBtn("home", "home")}>
          {picker === "home" ? "Close" : "+ Add home tasks"}
        </button>
        <button onClick={() => openPicker("work")} className={pickerBtn("work", "work")}>
          {picker === "work" ? "Close" : "+ Add work tasks"}
        </button>
        <button
          onClick={syncNow}
          disabled={syncing}
          className="ml-auto rounded-md border border-border px-2.5 py-1 text-xs text-muted hover:border-accent hover:text-foreground disabled:opacity-50"
          title="Pull the latest tasks from Todoist"
        >
          {syncing ? "Syncing…" : "↻ Sync"}
        </button>
      </div>

      {picker && (
        <div className="mt-2 rounded-lg border border-border bg-surface-raised p-2.5">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${picker} tasks…`}
            className="mb-2 w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs outline-none placeholder:text-muted focus:border-accent"
          />
          <ul className="max-h-64 space-y-0.5 overflow-y-auto">
            {available.map((t) => (
              <li key={t.id}>
                <label className="flex cursor-pointer items-start gap-2 rounded-md px-1.5 py-1 hover:bg-surface">
                  <input
                    type="checkbox"
                    checked={selected.has(t.id)}
                    onChange={() => toggleSelect(t.id)}
                    className="mt-0.5 shrink-0 accent-[var(--gold)]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm">{t.content}</span>
                    {projectLabel(t) && (
                      <span className="block text-[10px] text-muted">{projectLabel(t)}</span>
                    )}
                  </span>
                </label>
              </li>
            ))}
            {available.length === 0 && (
              <li className="px-1.5 py-2 text-xs text-muted">
                {pickerError
                  ? "Couldn't load tasks — is Todoist connected and synced?"
                  : pickerTasks === undefined
                    ? "Loading…"
                    : query
                      ? "No matching tasks."
                      : `No ${picker} tasks available to pull in.`}
              </li>
            )}
          </ul>
          <div className="mt-2 flex justify-end">
            <button
              onClick={addSelected}
              disabled={selected.size === 0}
              className="rounded-md border border-accent px-2.5 py-1 text-xs text-foreground hover:bg-surface disabled:opacity-40"
            >
              Add {selected.size || ""} selected
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
