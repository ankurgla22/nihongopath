"use client";
import { useId } from "react";
import type { WeekPoint } from "@/lib/engine/progress";
import { formatDate, formatMinutes } from "./shared";

/**
 * Accessible inline SVG: bars for study minutes per week and a line for
 * quiz accuracy. No chart library. A visually hidden table carries the same
 * data for screen readers; the SVG itself is aria-hidden.
 */
export function WeeklyChart({ series }: { series: WeekPoint[] }) {
  const id = useId();
  const gradId = `${id}-bar`.replace(/:/g, "");
  const W = 640;
  const H = 268;
  const pad = { top: 24, right: 44, bottom: 46, left: 44 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const n = Math.max(1, series.length);
  const slot = innerW / n;
  const barW = Math.max(10, Math.min(36, slot * 0.55));

  const maxMinutesRaw = Math.max(...series.map((p) => p.minutes), 0);
  // Round the axis top up to a friendly number (at least 60 minutes).
  const step = maxMinutesRaw > 600 ? 300 : maxMinutesRaw > 240 ? 120 : 60;
  const maxMinutes = Math.max(step, Math.ceil(maxMinutesRaw / step) * step);
  const yMin = (m: number) => pad.top + innerH - (m / maxMinutes) * innerH;
  const yAcc = (a: number) => pad.top + innerH - a * innerH;
  const xCenter = (i: number) => pad.left + slot * i + slot / 2;

  const minuteTicks = Array.from({ length: maxMinutes / step + 1 }, (_, i) => i * step);
  const accTicks = [0, 0.5, 1];

  const withAnswers = series.filter((p) => p.total > 0);
  const linePath = series
    .map((p, i) => (p.total > 0 ? `${xCenter(i).toFixed(1)},${yAcc(p.accuracy).toFixed(1)}` : null))
    .filter((s): s is string => s !== null)
    .map((pt, i) => `${i === 0 ? "M" : "L"}${pt}`)
    .join(" ");

  return (
    <figure className="m-0">
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted mb-3">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm accent-gradient" />
          Study minutes
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0.5 w-4 rounded bg-ok" />
          Quiz accuracy
        </span>
      </figcaption>
      {/* The chart scrolls inside this box on narrow screens; the page itself never widens. */}
      <div className="w-full max-w-full overflow-x-auto overflow-y-hidden no-scrollbar">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" style={{ minWidth: `${Math.max(280, Math.min(W, n * 72))}px` }} aria-hidden="true" focusable="false" role="presentation">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" />
              <stop offset="100%" stopColor="#e2643a" />
            </linearGradient>
          </defs>
          {/* horizontal gridlines + minute labels (left axis) */}
          {minuteTicks.map((m) => (
            <g key={m}>
              <line x1={pad.left} x2={W - pad.right} y1={yMin(m)} y2={yMin(m)} className="stroke-line" strokeWidth={1} strokeDasharray={m === 0 ? undefined : "3 4"} />
              <text x={pad.left - 8} y={yMin(m)} textAnchor="end" dominantBaseline="middle" className="fill-muted" fontSize={10}>
                {m}m
              </text>
            </g>
          ))}
          {/* accuracy labels (right axis) */}
          {accTicks.map((a) => (
            <text key={a} x={W - pad.right + 8} y={yAcc(a)} textAnchor="start" dominantBaseline="middle" className="fill-muted" fontSize={10}>
              {Math.round(a * 100)}%
            </text>
          ))}
          {/* bars */}
          {series.map((p, i) => {
            const h = Math.max(0, pad.top + innerH - yMin(p.minutes));
            const x = xCenter(i) - barW / 2;
            const y = yMin(p.minutes);
            const r = Math.min(6, barW / 2, h);
            const path = h > 0 ? `M${x},${y + h} V${y + r} a${r},${r} 0 0 1 ${r},-${r} h${barW - 2 * r} a${r},${r} 0 0 1 ${r},${r} V${y + h} Z` : "";
            return (
              <g key={p.weekStart}>
                {h > 0 ? <path d={path} fill={`url(#${gradId})`} opacity={0.95} /> : <rect x={x} y={pad.top + innerH - 2} width={barW} height={2} rx={1} className="fill-line-strong" />}
                {p.minutes > 0 && (
                  <text x={xCenter(i)} y={y - 6} textAnchor="middle" className="fill-ink" fontSize={10} fontWeight={600}>
                    {formatMinutes(p.minutes)}
                  </text>
                )}
                <text x={xCenter(i)} y={H - pad.bottom + 16} textAnchor="middle" className="fill-ink" fontSize={11} fontWeight={500}>
                  {p.weekLabel}
                </text>
                <text x={xCenter(i)} y={H - pad.bottom + 30} textAnchor="middle" className="fill-muted" fontSize={10}>
                  {formatDate(p.weekStart, { month: "short", day: "numeric" })}
                </text>
              </g>
            );
          })}
          {/* accuracy line + points */}
          {withAnswers.length > 1 && <path d={linePath} fill="none" className="stroke-ok" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />}
          {series.map((p, i) =>
            p.total > 0 ? (
              <g key={`pt-${p.weekStart}`}>
                <circle cx={xCenter(i)} cy={yAcc(p.accuracy)} r={4.5} className="fill-ok stroke-surface" strokeWidth={2} />
                <text x={xCenter(i)} y={yAcc(p.accuracy) - 9} textAnchor="middle" className="fill-ok" fontSize={10} fontWeight={600}>
                  {Math.round(p.accuracy * 100)}%
                </text>
              </g>
            ) : null
          )}
        </svg>
      </div>
      {/* Wrapped in a clipped box: a table ignores the 1px sr-only width and would widen the page. */}
      <div className="sr-only">
        <table aria-labelledby={`${id}-cap`}>
        <caption id={`${id}-cap`}>Weekly study minutes and quiz accuracy</caption>
        <thead>
          <tr>
            <th scope="col">Week</th>
            <th scope="col">Starting</th>
            <th scope="col">Study time</th>
            <th scope="col">Active days</th>
            <th scope="col">Quiz accuracy</th>
          </tr>
        </thead>
        <tbody>
          {series.map((p) => (
            <tr key={p.weekStart}>
              <th scope="row">{p.weekLabel}</th>
              <td>{formatDate(p.weekStart)}</td>
              <td>{formatMinutes(p.minutes)}</td>
              <td>{p.activeDays}</td>
              <td>{p.total > 0 ? `${Math.round(p.accuracy * 100)}% (${p.correct} of ${p.total})` : "No quizzes"}</td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </figure>
  );
}
