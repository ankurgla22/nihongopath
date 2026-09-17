type Item = { label: string; description: string };

/** A gradient scale (politeness, certainty, formality): horizontal rail with markers on desktop, vertical on mobile. */
export function Scale({ title, items }: { title: string; items: Item[] }) {
  const n = Math.max(items.length, 1);
  return (
    <figure className="surface rounded-2xl p-4 sm:p-6">
      <figcaption className="font-semibold tracking-tight mb-5 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
        {title}
      </figcaption>

      {/* Desktop: horizontal rail */}
      <div className="hidden sm:block">
        <div
          aria-hidden
          className="h-2 rounded-full"
          style={{ background: "linear-gradient(90deg, color-mix(in srgb, var(--accent) 15%, var(--line)) 0%, var(--accent) 100%)" }}
        />
        <ol className="grid mt-0" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {items.map((it, i) => (
            <li key={i} className="relative pt-4 px-2 text-center min-w-0">
              <span aria-hidden className="absolute left-1/2 -translate-x-1/2 -top-[9px] h-4 w-4 rounded-full bg-surface border-[3px] border-accent shadow-sm" style={{ borderColor: `color-mix(in srgb, var(--accent) ${Math.round(40 + (60 * i) / Math.max(n - 1, 1))}%, var(--line-strong))` }} />
              <p lang="ja" className="ja font-semibold text-lg text-ink leading-tight break-words">
                {it.label}
              </p>
              <p className="text-xs sm:text-sm text-muted mt-1 leading-snug">{it.description}</p>
            </li>
          ))}
        </ol>
      </div>

      {/* Mobile: vertical rail */}
      <ol className="sm:hidden relative pl-7 space-y-4">
        <span aria-hidden className="absolute left-[9px] top-2 bottom-2 w-1 rounded-full" style={{ background: "linear-gradient(180deg, color-mix(in srgb, var(--accent) 15%, var(--line)) 0%, var(--accent) 100%)" }} />
        {items.map((it, i) => (
          <li key={i} className="relative">
            <span aria-hidden className="absolute -left-7 top-1 h-4 w-4 rounded-full bg-surface border-[3px]" style={{ borderColor: `color-mix(in srgb, var(--accent) ${Math.round(40 + (60 * i) / Math.max(n - 1, 1))}%, var(--line-strong))` }} />
            <p lang="ja" className="ja font-semibold text-lg leading-tight">
              {it.label}
            </p>
            <p className="text-sm text-muted mt-0.5">{it.description}</p>
          </li>
        ))}
      </ol>
    </figure>
  );
}
