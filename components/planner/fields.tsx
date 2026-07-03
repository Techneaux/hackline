"use client";

import { useEffect, useRef } from "react";
import { usePlannerDay } from "./usePlannerDay";

/** Auto-growing textarea wired to the day's autosave context. */
export function AutosaveText({
  value,
  onChange,
  placeholder,
  className = "",
  minRows = 1,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  minRows?: number;
}) {
  const { flush } = usePlannerDay();
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      rows={minRows}
      onChange={(e) => onChange(e.target.value)}
      onBlur={flush}
      placeholder={placeholder}
      className={`w-full resize-none overflow-hidden rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm leading-6 outline-none transition-colors placeholder:text-muted/60 hover:border-border focus:border-accent focus:bg-surface-raised ${className}`}
    />
  );
}

export function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-3">
      <h2 className="hpp-label">{title}</h2>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

export function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-border bg-surface p-5 ${className}`}>{children}</section>
  );
}
