type Part = { text: string; role: string; highlight?: boolean };

/** A sentence broken into labelled bracketed chips, with the grammar point highlighted. */
export function SentenceStructure({ parts, translation }: { parts: Part[]; translation: string }) {
  return (
    <figure className="surface rounded-2xl p-4 sm:p-6">
      <ol className="flex flex-wrap items-end gap-x-2 gap-y-4" aria-label="Sentence parts">
        {parts.map((p, i) => (
          <li key={i} className="flex flex-col items-center min-w-0">
            <span
              lang="ja"
              className={`ja relative inline-block px-2.5 py-1 text-xl sm:text-2xl leading-snug rounded-lg ${
                p.highlight ? "font-semibold text-accent-ink bg-accent-soft" : "text-ink"
              }`}
            >
              {p.text}
            </span>
            {/* bracket */}
            <span aria-hidden className={`mt-1 h-2 w-full rounded-b-md border-b-2 border-l-2 border-r-2 ${p.highlight ? "border-accent" : "border-line-strong"}`} />
            <span className={`mt-1.5 text-[11px] uppercase tracking-[0.08em] text-center ${p.highlight ? "text-accent font-semibold" : "text-muted"}`}>{p.role}</span>
          </li>
        ))}
      </ol>
      <figcaption className="mt-5 pt-4 border-t border-line text-sm sm:text-[15px] text-ink-2 flex gap-2">
        <span aria-hidden className="text-muted">=</span>
        <span>{translation}</span>
      </figcaption>
    </figure>
  );
}
