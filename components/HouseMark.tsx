/** Curling house (the target rings) — empty-state mark. */
export default function HouseMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden className="mx-auto opacity-60">
      <circle cx="20" cy="20" r="17" fill="none" stroke="var(--accent-2)" strokeWidth="2" opacity="0.55" />
      <circle cx="20" cy="20" r="10.5" fill="none" stroke="var(--accent)" strokeWidth="2" opacity="0.7" />
      <circle cx="20" cy="20" r="4.5" fill="var(--gold)" opacity="0.8" />
    </svg>
  );
}
