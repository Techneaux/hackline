"use client";

import { AutosaveText } from "./fields";
import { usePlannerDay } from "./usePlannerDay";

export default function TopThree() {
  const { day, update } = usePlannerDay();
  const top3 = [...day.top3];
  while (top3.length < 3) top3.push("");

  return (
    <ol className="space-y-2">
      {top3.slice(0, 3).map((goal, i) => (
        <li key={i} className="flex items-center gap-3">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold"
            style={{ borderColor: "var(--gold)", color: "var(--gold)" }}
          >
            {i + 1}
          </span>
          <AutosaveText
            value={goal}
            onChange={(v) => {
              const next = [...top3];
              next[i] = v;
              update({ top3: next });
            }}
            placeholder={`Goal ${i + 1}`}
          />
        </li>
      ))}
    </ol>
  );
}
