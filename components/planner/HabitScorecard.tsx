"use client";

import { useState } from "react";
import useSWR from "swr";
import { HABITS } from "@/lib/planner/prompts";
import { fetcher } from "@/lib/fetcher";


interface ScoreRow {
  date: string;
  habit: string;
  score: number;
}

export default function HabitScorecard({ date }: { date: string }) {
  const { data: scores, mutate } = useSWR<ScoreRow[]>(`/api/habits?from=${date}&to=${date}`, fetcher);
  const [error, setError] = useState(false);

  async function setScore(habit: string, score: number) {
    mutate(
      (prev) => {
        const rest = prev?.filter((s) => s.habit !== habit) ?? [];
        return [...rest, { date, habit, score }];
      },
      { revalidate: false },
    );
    const res = await fetch("/api/habits", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, habit, score }),
    });
    setError(!res.ok);
    mutate();
  }

  return (
    <div>
      <p className="mb-4 text-xs text-muted">
        Score yourself 1–5 on each habit. Like a draw to the button — 5 sits on the pin.
      </p>
      {error && <p className="mb-2 text-xs" style={{ color: "var(--danger)" }}>Couldn&apos;t save a score.</p>}
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {HABITS.map((h) => {
          const current = scores?.find((s) => s.habit === h.id)?.score;
          return (
            <div key={h.id}>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-sm font-medium">{h.label}</span>
                <span className="text-xs tabular-nums text-muted">{current ?? "–"}/5</span>
              </div>
              <p className="mb-1.5 text-[11px] leading-4 text-muted">{h.statement}</p>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => {
                  const active = current !== undefined && n <= current;
                  return (
                    <button
                      key={n}
                      onClick={() => setScore(h.id, n)}
                      aria-label={`${h.label} ${n} of 5`}
                      className="flex h-7 flex-1 items-center justify-center rounded-md border text-xs tabular-nums transition-colors"
                      style={{
                        borderColor: active ? "var(--accent)" : "var(--border)",
                        background: active
                          ? "color-mix(in srgb, var(--accent) 22%, transparent)"
                          : "transparent",
                        color: active ? "var(--accent)" : "var(--muted)",
                      }}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
