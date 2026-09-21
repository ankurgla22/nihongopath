import Link from "next/link";
import type { ReactNode } from "react";
import { Arrow, Breadcrumbs } from "@/components/ui";

export type NavLink = { href: string; title: string; subtitle?: string };

/**
 * "Where am I?": breadcrumbs plus a sticky bar with "N of M" and the actions (Save / Mark learned).
 * Lesson meta lives here only: no level or type chips. Render above the article.
 */
export function LessonNavTop({
  crumbs,
  index,
  total,
  unit = "Lesson",
  actions,
}: {
  crumbs: { name: string; path?: string }[];
  index: number;
  total: number;
  unit?: string;
  actions?: ReactNode;
}) {
  const pct = total > 0 ? Math.round((index / total) * 100) : 0;
  return (
    <div className="animate-rise">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <Breadcrumbs items={crumbs} />
      </div>
      <div className="mt-3 surface rounded-2xl px-3.5 py-2.5 sm:px-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative h-8 w-8 shrink-0 rounded-full grid place-items-center" aria-hidden>
            <svg viewBox="0 0 36 36" className="absolute inset-0 h-full w-full -rotate-90">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--line)" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(pct / 100) * 97.4} 97.4`} />
            </svg>
            <span className="text-[10px] font-semibold tabular-nums text-ink-2">{index}</span>
          </div>
          <p className="text-sm text-muted whitespace-nowrap">
            {unit} <span className="text-ink font-semibold tabular-nums">{index}</span> <span className="opacity-70">of</span> <span className="tabular-nums">{total}</span>
          </p>
        </div>
        {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

function NavCard({ link, direction, fallback }: { link?: NavLink; direction: "prev" | "next"; fallback?: { href: string; label: string } }) {
  const isNext = direction === "next";
  const align = isNext ? "sm:text-right sm:items-end" : "";
  if (!link) {
    if (!fallback) return <div className="hidden sm:block" aria-hidden />;
    return (
      <Link href={fallback.href} className={`group surface surface-hover rounded-2xl p-5 flex flex-col gap-1 ${align} bg-accent-soft/40 border-accent/30`}>
        <span className="text-[11px] uppercase tracking-[0.14em] text-accent">You finished this list</span>
        <span className="text-lg font-semibold inline-flex items-center gap-2 group-hover:text-accent transition">
          Back to {fallback.label}
          <Arrow className="transition group-hover:translate-x-0.5" />
        </span>
      </Link>
    );
  }
  return (
    <Link href={link.href} className={`group surface surface-hover rounded-2xl p-5 flex flex-col gap-1 min-w-0 ${align} ${isNext ? "border-accent/30 bg-gradient-to-br from-accent-soft/50 to-surface" : ""}`}>
      <span className={`text-[11px] uppercase tracking-[0.14em] inline-flex items-center gap-1.5 ${isNext ? "text-accent" : "text-muted"}`}>
        {!isNext && <Arrow className="h-3.5 w-3.5 rotate-180 transition group-hover:-translate-x-0.5" />}
        {isNext ? "Next" : "Previous"}
        {isNext && <Arrow className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />}
      </span>
      <span lang="ja" className="ja block text-xl sm:text-2xl font-semibold tracking-tight text-ink group-hover:text-accent transition truncate w-full">
        {link.title}
      </span>
      {link.subtitle && <span className="block text-sm text-muted truncate w-full">{link.subtitle}</span>}
    </Link>
  );
}

/** "Continue": previous / next as two large cards plus a link back to the index. Render below the article. */
export function LessonNavBottom({ prev, next, indexHref, indexLabel }: { prev?: NavLink; next?: NavLink; indexHref: string; indexLabel: string }) {
  return (
    <nav aria-label="Lesson navigation" className="mt-14 border-t border-line pt-8">
      <div className="flex items-center justify-end mb-4">
        <Link href={indexHref} className="text-sm text-accent hover:underline underline-offset-4">
          All {indexLabel}
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <NavCard link={prev} direction="prev" />
        <NavCard link={next} direction="next" fallback={{ href: indexHref, label: indexLabel }} />
      </div>
    </nav>
  );
}
