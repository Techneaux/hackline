// Canonical High Performance Planner prompt catalog. The planner_days JSON
// columns are keyed by these IDs, so IDs are append-only and must never change.

export interface Prompt {
  id: string;
  text: string;
}

export const MORNING_PROMPTS: Prompt[] = [
  { id: "excited", text: "One thing I can get excited about today is…" },
  {
    id: "word",
    text: "If one word could describe the kind of person I want to be today, then that word is… and why I chose it is…",
  },
  { id: "a-game", text: "Someone who needs me on my A-game today is…" },
  {
    id: "stress",
    text: "A situation that might stress me out or trip me up today could be… and the way that my best self would deal with that is…",
  },
  { id: "surprise", text: "Someone I could surprise with a note, gift, or sign of appreciation is…" },
  { id: "excellence", text: "One action I could take today to demonstrate excellence or real value is…" },
  {
    id: "comfort-zone",
    text: "One thing I could do today that is a little outside my comfort zone is… (try, ask for, express something, take a big step, etc.)",
  },
  {
    id: "coach",
    text: "If I was a high performance coach looking at my life from a high level, I would tell myself to remember that…",
  },
  { id: "projects", text: "The big projects I have to keep in mind that I want to take on, even if I can't act toward them today, are…" },
  { id: "success", text: "I would know that today was a great success if at the end of the day I did, said, or felt this…" },
];

export const EVENING_PROMPTS: Prompt[] = [
  { id: "appreciated", text: "A moment that I really appreciated today was…" },
  { id: "handled", text: "A situation or task I handled well today was…" },
  { id: "realized", text: "Something I realized or learned today was…" },
  { id: "better-if", text: "I could have made today even better if I…" },
  {
    id: "connected",
    text: "Something that could have helped me feel more connected to others today would have been…",
  },
  {
    id: "coach-tomorrow",
    text: "If I was my own high performance coach, I would tell myself this statement about today…",
  },
];

export const HABITS = [
  { id: "clarity", label: "Clarity", statement: "I knew my “why” and lived intentionally today." },
  { id: "energy", label: "Energy", statement: "I managed my mental and physical energy well." },
  { id: "necessity", label: "Necessity", statement: "I felt it was necessary to be my best and made success a “must.”" },
  { id: "productivity", label: "Productivity", statement: "I worked on things that mattered most today." },
  { id: "influence", label: "Influence", statement: "I guided or treated others well today." },
  { id: "courage", label: "Courage", statement: "I shared my real self, thoughts, and feelings today." },
] as const;

export type HabitId = (typeof HABITS)[number]["id"];
