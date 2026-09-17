type Step = { ja: string; en: string };

/** Step-by-step transformation (e.g. 嫌い → 嫌いなわけではない) shown as a vertical flow with arrows. */
export function Transformation({ steps }: { steps: Step[] }) {
  const last = steps.length - 1;
  return (
    <figure className="surface rounded-2xl p-4 sm:p-6">
      <ol className="relative">
        {steps.map((s, i) => {
          const isLast = i === last;
          return (
            <li key={i} className="relative">
              {i > 0 && (
                <div aria-hidden className="flex flex-col items-center py-1 text-muted">
                  <span className="h-4 w-0.5 bg-line-strong" />
                  <svg className="h-3.5 w-3.5 -mt-0.5 text-line-strong" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 20 4 10h16z" />
                  </svg>
                </div>
              )}
              <div
                className={`rounded-xl border px-4 py-3 flex flex-col sm:flex-row sm:items-baseline gap-x-5 gap-y-0.5 ${
                  isLast ? "border-accent/40 bg-accent-soft shadow-sm" : "border-line bg-bg-elev"
                }`}
              >
                <span className={`text-[10px] uppercase tracking-[0.12em] tabular-nums shrink-0 ${isLast ? "text-accent" : "text-muted"}`}>Step {i + 1}</span>
                <span lang="ja" className={`ja text-xl sm:text-2xl leading-snug break-words ${isLast ? "font-semibold text-accent-ink" : "text-ink"}`}>
                  {s.ja}
                </span>
                <span className="text-sm text-muted sm:ml-auto">{s.en}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}
