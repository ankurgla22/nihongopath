"use client";
/**
 * Filters an already server-rendered list by text. Children must contain elements with a
 * `data-filter-text` attribute (lower-cased searchable text); optional `data-filter-group`
 * wrappers are hidden when none of their items match. Content stays in the HTML for crawlers.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  placeholder?: string;
  label?: string;
  /** When the list is one page of many: link to a site-wide search that carries the typed text as ?q=. */
  searchAll?: { href: string; label: string };
};

export function FilterList({ children, placeholder = "Filter", label = "Filter list", searchAll }: Props) {
  const [q, setQ] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const needle = q.trim().toLowerCase();
    const items = root.querySelectorAll<HTMLElement>("[data-filter-text]");
    let shown = 0;
    items.forEach((el) => {
      const hit = !needle || (el.dataset.filterText ?? "").includes(needle);
      el.hidden = !hit;
      if (hit) shown++;
    });
    root.querySelectorAll<HTMLElement>("[data-filter-group]").forEach((g) => {
      const any = Array.from(g.querySelectorAll<HTMLElement>("[data-filter-text]")).some((el) => !el.hidden);
      g.hidden = !any;
    });
    setCount(needle ? shown : null);
  }, [q]);

  return (
    <div>
      <div className="sticky top-16 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 glass border-b border-line/80 mb-6">
        <label className="sr-only" htmlFor="filter-list-input">
          {label}
        </label>
        <div className="relative max-w-xl">
          <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            id="filter-list-input"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            className="w-full h-11 rounded-full border border-line bg-surface pl-10 pr-24 text-[15px] text-ink placeholder:text-muted shadow-sm transition focus:border-accent focus:shadow-ring focus:outline-none"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {count !== null && (
              <span className="rounded-full bg-surface-2 border border-line px-2 h-6 inline-flex items-center text-[11px] font-medium text-ink-2 tabular-nums" aria-live="polite">
                {count} {count === 1 ? "match" : "matches"}
              </span>
            )}
            {q && (
              <button type="button" onClick={() => setQ("")} className="h-8 w-8 rounded-full grid place-items-center text-muted hover:bg-surface-2 hover:text-ink transition" aria-label="Clear filter">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
      {searchAll && (
        <p className="-mt-3 mb-5 text-xs text-muted">
          Filtering this page —{" "}
          <a href={searchAll.href + encodeURIComponent(q.trim())} className="text-accent hover:underline underline-offset-4">
            {searchAll.label}
          </a>
        </p>
      )}
      <div ref={ref}>{children}</div>
    </div>
  );
}
