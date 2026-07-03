"use client";

import useSWR from "swr";
import { EVENING_PROMPTS, MORNING_PROMPTS } from "@/lib/planner/prompts";
import { fetcher } from "@/lib/fetcher";
import ConnectField from "./ConnectField";
import { AutosaveText, Section, SectionHeader } from "./fields";
import HabitScorecard from "./HabitScorecard";
import MustDoList from "./MustDoList";
import PromptList from "./PromptList";
import ScheduleGrid from "./ScheduleGrid";
import TopThree from "./TopThree";
import { PlannerDayProvider, usePlannerDay } from "./usePlannerDay";

function SaveIndicator() {
  const { status } = usePlannerDay();
  const text =
    status === "saving" ? "Saving…" : status === "saved" ? "Saved ✓" : status === "error" ? "Save failed — retrying on next edit" : "";
  return (
    <p
      className="pointer-events-none fixed bottom-4 right-5 text-xs text-muted transition-opacity"
      style={{ opacity: text ? 1 : 0, color: status === "error" ? "var(--danger)" : undefined }}
    >
      {text}
    </p>
  );
}

function MessageToSelf() {
  const { day, update } = usePlannerDay();
  return (
    <AutosaveText
      value={day.messageToSelf}
      onChange={(v) => update({ messageToSelf: v })}
      placeholder="Today's message to myself…"
      className="text-base italic"
      minRows={1}
    />
  );
}

function TomorrowPlan() {
  const { day, update, flush } = usePlannerDay();
  const { data: work } = useSWR<{ url: string | null }>("/api/todoist/work-url", fetcher);
  const done = day.tomorrowPlanned;
  return (
    <div className="space-y-3">
      <button
        onClick={() => {
          update({ tomorrowPlanned: !done });
          flush();
        }}
        className="flex items-center gap-2.5 text-left text-sm"
        aria-pressed={done}
      >
        <span
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors"
          style={{ borderColor: "var(--gold)", background: done ? "var(--gold)" : "transparent" }}
        >
          {done && (
            <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden>
              <path d="M1.5 5.5l2.2 2.2L8.5 2.5" stroke="var(--background)" strokeWidth="1.8" fill="none" />
            </svg>
          )}
        </span>
        <span className="text-muted">I&apos;ve planned my tasks for tomorrow</span>
      </button>
      {work?.url && (
        <a
          href={work.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
        >
          Open Work – Todo in Todoist ↗
        </a>
      )}
    </div>
  );
}

function TopLink() {
  return (
    <a
      href="#planner-top"
      className="rounded-md border border-border px-2.5 py-1 text-xs text-muted hover:border-accent hover:text-foreground"
    >
      ↑ Top
    </a>
  );
}

function Notes() {
  const { day, update } = usePlannerDay();
  return (
    <AutosaveText
      value={day.notes}
      onChange={(v) => update({ notes: v })}
      placeholder="Notes…"
      minRows={4}
    />
  );
}

export default function DailyPlanner({
  date,
  initial,
  dayBounds,
}: {
  date: string;
  initial: Record<string, unknown>;
  dayBounds: { from: string; to: string };
}) {
  return (
    <PlannerDayProvider date={date} initial={initial}>
      <SaveIndicator />

      <div className="grid items-start gap-6 lg:grid-cols-2">
        {/* Left column — mindset, must-dos, people, then goals & message */}
        <div className="space-y-6">
          <Section>
            <SectionHeader title="Morning mindset" />
            <PromptList prompts={MORNING_PROMPTS} field="morning" />
          </Section>

          <Section>
            <SectionHeader title="Tasks that absolutely must be done today" sub="Pull in the Todoist tasks you're committing to today." />
            <MustDoList />
          </Section>

          <Section>
            <SectionHeader title="Person(s) I need to lead or connect with today" sub="…and how to do it well." />
            <ConnectField />
          </Section>

          <Section>
            <SectionHeader title="Today's top 3 goals / priorities" />
            <TopThree />
          </Section>

          <Section>
            <SectionHeader title="Today's message to myself" />
            <MessageToSelf />
          </Section>
        </div>

        {/* Right column — schedule, notes */}
        <div className="space-y-6">
          <Section>
            <SectionHeader title="Schedule" sub="Synced events appear automatically; add your own notes per slot." />
            <ScheduleGrid dayBounds={dayBounds} />
          </Section>

          <Section>
            <SectionHeader title="Notes" />
            <Notes />
          </Section>
        </div>
      </div>

      <div className="mt-2 flex justify-end">
        <TopLink />
      </div>

      <hr className="hog-line my-8" />

      <div id="evening" className="scroll-mt-6 grid items-start gap-6 lg:grid-cols-2">
        <Section>
          <SectionHeader title="Evening journal" />
          <PromptList prompts={EVENING_PROMPTS} field="evening" />
        </Section>
        <div className="space-y-6">
          <Section>
            <SectionHeader title="Daily habits scorecard" />
            <HabitScorecard date={date} />
          </Section>
          <Section>
            <SectionHeader title="Tomorrow's tasks" />
            <TomorrowPlan />
          </Section>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <TopLink />
      </div>
    </PlannerDayProvider>
  );
}
