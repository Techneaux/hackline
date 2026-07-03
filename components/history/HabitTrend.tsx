"use client";

import { useMemo, useState } from "react";

export interface TrendPoint {
  date: string; // YYYY-MM-DD
  avg: number; // 1..5
  count: number; // habits scored that day
}

const W = 640;
const H = 180;
const PAD = { top: 12, right: 12, bottom: 24, left: 30 };

export default function HabitTrend({ points }: { points: TrendPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const { path, coords } = useMemo(() => {
    if (!points.length) return { path: "", coords: [] as { x: number; y: number }[] };
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const x = (i: number) => PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    const y = (v: number) => PAD.top + ((5 - v) / 4) * innerH;
    const coords = points.map((p, i) => ({ x: x(i), y: y(p.avg) }));
    const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
    return { path, coords };
  }, [points]);

  if (!points.length) {
    return <p className="py-8 text-center text-sm text-muted">Score some habits and the trend shows up here.</p>;
  }

  const h = hover !== null ? points[hover] : null;

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Average daily habit score over time"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * W;
          let best = 0;
          let bestD = Infinity;
          coords.forEach((c, i) => {
            const d = Math.abs(c.x - px);
            if (d < bestD) {
              bestD = d;
              best = i;
            }
          });
          setHover(best);
        }}
      >
        {/* grid: score levels 1..5 */}
        {[1, 2, 3, 4, 5].map((v) => {
          const y = PAD.top + ((5 - v) / 4) * (H - PAD.top - PAD.bottom);
          return (
            <g key={v}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="var(--border)" strokeWidth="1" opacity="0.5" />
              <text x={PAD.left - 8} y={y + 3} textAnchor="end" fontSize="9" fill="var(--muted)">
                {v}
              </text>
            </g>
          );
        })}
        {/* first / last date labels */}
        <text x={PAD.left} y={H - 6} fontSize="9" fill="var(--muted)">
          {points[0].date}
        </text>
        <text x={W - PAD.right} y={H - 6} textAnchor="end" fontSize="9" fill="var(--muted)">
          {points[points.length - 1].date}
        </text>

        <path d={path} fill="none" stroke="var(--chart-1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {coords.map((c, i) => (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={hover === i ? 5 : coords.length <= 31 ? 3 : 0}
            fill="var(--chart-1)"
            stroke="var(--surface)"
            strokeWidth="2"
          />
        ))}

        {h && (
          <g>
            <line
              x1={coords[hover!].x}
              x2={coords[hover!].x}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke="var(--muted)"
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.6"
            />
            <g
              transform={`translate(${Math.min(coords[hover!].x + 8, W - 130)}, ${PAD.top + 4})`}
            >
              <rect width="122" height="34" rx="6" fill="var(--surface-raised)" stroke="var(--border)" />
              <text x="8" y="14" fontSize="10" fill="var(--muted)">
                {h.date}
              </text>
              <text x="8" y="27" fontSize="11" fill="var(--foreground)">
                avg {h.avg.toFixed(1)} · {h.count} habit{h.count === 1 ? "" : "s"}
              </text>
            </g>
          </g>
        )}
      </svg>

      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-muted">View as table</summary>
        <div className="mt-2 max-h-48 overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-1 pr-4 font-normal">Date</th>
                <th className="py-1 pr-4 font-normal">Average score</th>
                <th className="py-1 font-normal">Habits scored</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.date} className="border-t border-border/50">
                  <td className="py-1 pr-4 tabular-nums">{p.date}</td>
                  <td className="py-1 pr-4 tabular-nums">{p.avg.toFixed(2)}</td>
                  <td className="py-1 tabular-nums">{p.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
