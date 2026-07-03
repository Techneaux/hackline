"use client";

import useSWR from "swr";
import GoogleCalendarPicker from "@/components/settings/GoogleCalendarPicker";
import { fetcher } from "@/lib/fetcher";


interface AccountRow {
  id: number;
  kind: string;
  domain: string;
  label: string;
  identity: string | null;
  color: string;
  status: string;
  hasAuth: boolean;
}

interface SyncRow {
  accountId: number;
  resource: string;
  lastSyncedAt: string | null;
  lastError: string | null;
}

export default function SettingsPage() {
  const { data: accounts, mutate } = useSWR<AccountRow[]>("/api/accounts", fetcher);
  const { data: syncState } = useSWR<SyncRow[]>("/api/sync", fetcher, { refreshInterval: 30_000 });
  const todoistAccount = accounts?.find((a) => a.kind === "todoist");

  async function removeAccount(id: number) {
    if (!confirm("Remove this account and its synced data?")) return;
    await fetch(`/api/accounts/${id}`, { method: "DELETE" });
    mutate();
  }

  function stateFor(accountId: number): SyncRow | undefined {
    return syncState?.find((s) => s.accountId === accountId);
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <p className="hpp-label">Settings</p>
        <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-space-grotesk)" }}>
          Accounts &amp; sync
        </h1>
      </div>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="hpp-label mb-4">Connected accounts</h2>
        {!accounts?.length && <p className="text-sm text-muted">Nothing connected yet.</p>}
        <ul className="space-y-3">
          {accounts?.map((a) => {
            const st = stateFor(a.id);
            return (
              <li key={a.id} className="flex items-start gap-3 rounded-lg border border-border bg-surface-raised px-4 py-3">
                <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: a.color }} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {a.label} <span className="text-muted">· {a.kind}</span>
                  </p>
                  <p className="text-xs text-muted">
                    {a.identity ?? a.domain}
                    {st?.lastSyncedAt && ` · synced ${new Date(st.lastSyncedAt).toLocaleTimeString()}`}
                  </p>
                  {st?.lastError && (
                    <p className="mt-1 break-all text-xs" style={{ color: "var(--danger)" }}>
                      {st.lastError}
                    </p>
                  )}
                  {a.kind === "google" && (
                    <GoogleCalendarPicker accountId={a.id} onSynced={() => mutate()} />
                  )}
                </div>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px]"
                  style={{
                    background: a.status === "ok" ? "color-mix(in srgb, var(--accent) 18%, transparent)" : "color-mix(in srgb, var(--danger) 18%, transparent)",
                    color: a.status === "ok" ? "var(--accent)" : "var(--danger)",
                  }}
                >
                  {a.status}
                </span>
                <button
                  onClick={() => removeAccount(a.id)}
                  className="text-xs text-muted hover:text-danger"
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {!todoistAccount && (
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="hpp-label mb-2">Todoist</h2>
          <p className="text-sm text-muted">
            Set <code>TODOIST_API_TOKEN</code> in <code>.env.local</code> (from Todoist → Settings →
            Integrations → Developer), then restart. Todoist connects automatically.
          </p>
        </section>
      )}

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="hpp-label mb-2">Connect Google Calendar</h2>
        <p className="mb-3 text-sm text-muted">
          Uses your own OAuth client — set <code>GOOGLE_CLIENT_ID</code> / <code>GOOGLE_CLIENT_SECRET</code> in{" "}
          <code>.env.local</code> first (see README). Once connected, use <em>Choose calendars…</em> to pick
          which of the account&apos;s calendars appear on the schedule.
        </p>
        <a
          href="/api/oauth/google/start"
          className="inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-background"
        >
          Connect Google account
        </a>
      </section>
    </div>
  );
}
