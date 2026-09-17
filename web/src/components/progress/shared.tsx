"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { Arrow, Callout, EmptyState as UiEmptyState } from "@/components/ui";
import type { Skill } from "@/lib/firestore/types";

export const SKILL_LABEL: Record<Skill | "review" | "test" | "other", string> = {
  kana: "Kana",
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  kanji: "Kanji",
  reading: "Reading",
  listening: "Listening",
  review: "Review",
  test: "Test",
  other: "Other",
};

export function skillLabel(s: string): string {
  return (SKILL_LABEL as Record<string, string>)[s] ?? s.charAt(0).toUpperCase() + s.slice(1);
}

/** One kanji per skill/task type, used as a compact icon in tiles and timelines. */
const SKILL_GLYPH: Record<string, string> = {
  grammar: "文",
  vocabulary: "語",
  kanji: "漢",
  reading: "読",
  listening: "聴",
  review: "復",
  quiz: "問",
  test: "試",
  "weekly-test": "週",
  "phase-test": "段",
  "mock-exam": "験",
  question: "問",
  other: "他",
};

export function skillGlyph(type: string): string {
  return SKILL_GLYPH[type] ?? "学";
}

/** Small rounded tile with the skill kanji. */
export function SkillGlyph({ type, size = "md", tone = "neutral" }: { type: string; size?: "sm" | "md" | "lg"; tone?: "neutral" | "accent" | "ok" | "warn" }) {
  const sizes = { sm: "h-7 w-7 text-sm rounded-lg", md: "h-9 w-9 text-base rounded-xl", lg: "h-11 w-11 text-lg rounded-xl" };
  const tones = {
    neutral: "bg-surface-2 text-ink-2 border-line",
    accent: "bg-accent-soft text-accent-ink border-transparent",
    ok: "bg-ok-soft text-ok border-transparent",
    warn: "bg-warn-soft text-warn border-transparent",
  };
  return (
    <span aria-hidden className={`ja inline-grid shrink-0 place-items-center border font-semibold ${sizes[size]} ${tones[tone]}`}>
      {skillGlyph(type)}
    </span>
  );
}

/** Circular progress ring (inline SVG). `value` is 0–100. */
export function Ring({
  value,
  size = 120,
  stroke = 10,
  tone = "accent",
  children,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: "accent" | "ok" | "warn" | "info";
  children?: ReactNode;
  label?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = { accent: "stroke-accent", ok: "stroke-ok", warn: "stroke-warn", info: "stroke-info" }[tone];
  return (
    <div className="relative inline-grid place-items-center shrink-0" style={{ width: size, height: size }} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-surface-2" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-line" opacity={0.6} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className={`${color} transition-[stroke-dashoffset] duration-700 ease-out`}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v / 100)}
        />
      </svg>
      {children && <div className="absolute inset-0 grid place-items-center text-center">{children}</div>}
    </div>
  );
}

export function formatMinutes(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

export function formatSeconds(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m ? `${m}m ${r.toString().padStart(2, "0")}s` : `${r}s`;
}

/** "2026-09-17" → "September 17, 2026" (UTC-safe; no timezone shift). */
export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" }): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, { ...opts, timeZone: "UTC" });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function pct(n: number): string {
  return `${Math.round(Math.max(0, Math.min(1, n)) * 100)}%`;
}

/** Skeleton placeholder rows shown while data loads (the label is announced to screen readers only). */
export function LoadingState({ label = "Loading…", rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="py-2 space-y-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="surface rounded-2xl p-5 flex items-center gap-4" aria-hidden>
          <div className="skeleton h-10 w-10 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3.5 w-1/2" />
            <div className="skeleton h-3 w-1/3" />
          </div>
          <div className="skeleton h-6 w-14 rounded-full hidden sm:block" />
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div role="alert" className="py-4">
      <Callout tone="warn" title="Something went wrong">
        {message}
      </Callout>
    </div>
  );
}

export function SignedOutState() {
  return (
    <div className="py-4">
      <Callout tone="warn" title="Not signed in">
        Your browser session has expired. Please log in again to see your data.
      </Callout>
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="py-2">
      <UiEmptyState title={title} action={action}>
        {children}
      </UiEmptyState>
    </div>
  );
}

export function errMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/** A whole-card link row: hover lift, trailing arrow. */
export function LinkCard({ href, children, ariaLabel, className = "" }: { href: string; children: ReactNode; ariaLabel?: string; className?: string }) {
  return (
    <article className={`surface surface-hover rounded-2xl overflow-hidden ${className}`}>
      <Link href={href} aria-label={ariaLabel} className="group flex items-center gap-4 p-4 sm:p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent">
        <div className="min-w-0 flex-1">{children}</div>
        <Arrow className="shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-accent" />
      </Link>
    </article>
  );
}
