"use client";

import type { Prompt } from "@/lib/planner/prompts";
import { AutosaveText } from "./fields";
import { usePlannerDay } from "./usePlannerDay";

export default function PromptList({
  prompts,
  field,
}: {
  prompts: Prompt[];
  field: "morning" | "evening";
}) {
  const { day, update } = usePlannerDay();
  const answers = day[field];

  return (
    <ol className="space-y-4">
      {prompts.map((p, i) => (
        <li key={p.id}>
          <p className="mb-1 text-sm text-muted">
            <span className="mr-1.5 font-medium text-foreground/70">{i + 1}.</span>
            {p.text}
          </p>
          <AutosaveText
            value={answers[p.id] ?? ""}
            onChange={(v) => update({ [field]: { ...answers, [p.id]: v } } as never)}
          />
        </li>
      ))}
    </ol>
  );
}
