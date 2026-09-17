type Branch = { suffix: string; result: string; label: string };

/** Root word with branches for each suffix, rendered as a tree with CSS connector lines. */
export function ConjugationTree({ root, rootLabel, branches }: { root: string; rootLabel?: string; branches: Branch[] }) {
  return (
    <figure className="surface rounded-2xl p-4 sm:p-6 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-stretch">
        {/* root node */}
        <div className="shrink-0 flex sm:flex-col items-center sm:items-end sm:justify-center">
          <div className="rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-center">
            <p lang="ja" className="ja text-2xl sm:text-3xl font-semibold text-accent-ink leading-tight">
              {root}
            </p>
            {rootLabel && <p className="text-xs text-muted mt-0.5">{rootLabel}</p>}
          </div>
        </div>
        {/* trunk: vertical on mobile, horizontal on desktop */}
        <div aria-hidden className="mx-auto h-5 w-0.5 bg-line-strong sm:hidden" />
        <div aria-hidden className="hidden sm:block w-6 shrink-0 self-center h-0.5 bg-line-strong" />

        {/* branches */}
        <ol className="relative flex-1 min-w-0 pl-5 sm:pl-6 space-y-2.5">
          {/* vertical spine */}
          <span aria-hidden className="absolute left-0 top-4 bottom-4 w-0.5 bg-line-strong rounded-full sm:top-6 sm:bottom-6" />
          {branches.map((b, i) => (
            <li key={i} className="relative">
              {/* horizontal connector */}
              <span aria-hidden className="absolute -left-5 sm:-left-6 top-1/2 w-5 sm:w-6 h-0.5 bg-line-strong" />
              <span aria-hidden className="absolute -left-[3px] top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-accent ring-2 ring-surface" />
              <div className="rounded-xl border border-line bg-bg-elev px-3.5 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
                <span lang="ja" className="ja inline-flex items-center rounded-md bg-accent-soft text-accent-ink px-2 py-0.5 text-sm font-semibold whitespace-nowrap">
                  + {b.suffix}
                </span>
                <span aria-hidden className="text-muted">→</span>
                <span lang="ja" className="ja text-lg sm:text-xl font-semibold text-ink break-words">
                  {b.result}
                </span>
                <span className="text-sm text-muted basis-full sm:basis-auto sm:ml-auto">{b.label}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </figure>
  );
}
