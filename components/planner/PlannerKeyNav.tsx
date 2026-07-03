"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { addDays, localDate } from "@/lib/time";

/** ← / → (or j / k) move between days; t jumps to today. Inactive while typing. */
export default function PlannerKeyNav({ date }: { date: string }) {
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) {
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "j") router.push(`/planner/${addDays(date, -1)}`);
      else if (e.key === "ArrowRight" || e.key === "k") router.push(`/planner/${addDays(date, 1)}`);
      else if (e.key === "t") router.push(date === localDate() ? "/" : `/planner/${localDate()}`);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [date, router]);

  return null;
}
