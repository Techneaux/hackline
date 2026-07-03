"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";


interface SyncRow {
  accountId: number;
  resource: string;
  lastSyncedAt: string | null;
  lastError: string | null;
}

function ago(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

export default function SyncStatusBar() {
  const { data, mutate } = useSWR<SyncRow[]>("/api/sync", fetcher, { refreshInterval: 60_000 });
  const [syncing, setSyncing] = useState(false);

  async function syncNow() {
    setSyncing(true);
    try {
      await fetch("/api/sync", { method: "POST", body: "{}" });
      mutate();
    } finally {
      setSyncing(false);
    }
  }

  const newest = data?.reduce<string | null>(
    (acc, r) => (r.lastSyncedAt && (!acc || r.lastSyncedAt > acc) ? r.lastSyncedAt : acc),
    null,
  );
  const errors = data?.filter((r) => r.lastError) ?? [];

  return (
    <div className="flex items-center gap-3 text-xs text-muted">
      {errors.length > 0 && (
        <span title={errors.map((e) => e.lastError).join("\n")} style={{ color: "var(--danger)" }}>
          {errors.length} sync error{errors.length > 1 ? "s" : ""}
        </span>
      )}
      <span>synced {ago(newest ?? null)}</span>
      <button
        onClick={syncNow}
        disabled={syncing}
        className="rounded-md border border-border px-2.5 py-1 transition-colors hover:border-accent hover:text-foreground disabled:opacity-50"
      >
        {syncing ? "Syncing…" : "Sync now"}
      </button>
    </div>
  );
}
