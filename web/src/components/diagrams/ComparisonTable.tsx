type Row = { label: string; cells: string[] };

/** Side-by-side comparison of similar grammar. Zebra rows, rounded frame; scrolls horizontally on narrow screens. */
export function ComparisonTable({ title, columns, rows }: { title?: string; columns: string[]; rows: Row[] }) {
  return (
    <figure className="surface rounded-2xl overflow-hidden">
      {title && (
        <figcaption className="px-4 sm:px-5 pt-4 pb-3 border-b border-line flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
          <span className="font-semibold tracking-tight">{title}</span>
        </figcaption>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-surface-2">
              <th scope="col" className="text-left px-4 sm:px-5 py-2.5 text-[11px] uppercase tracking-[0.12em] font-medium text-muted w-32">
                <span className="sr-only">Aspect</span>
              </th>
              {columns.map((c, i) => (
                <th key={i} scope="col" lang="ja" className="ja text-left px-4 sm:px-5 py-2.5 font-semibold text-base text-ink whitespace-nowrap">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={`border-t border-line align-top ${i % 2 === 1 ? "bg-surface-2/50" : ""}`}>
                <th scope="row" className="text-left px-4 sm:px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted whitespace-nowrap">
                  {r.label}
                </th>
                {r.cells.map((cell, j) => (
                  <td key={j} lang="ja" className="ja px-4 sm:px-5 py-3 leading-relaxed min-w-[10rem] text-ink-2">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
