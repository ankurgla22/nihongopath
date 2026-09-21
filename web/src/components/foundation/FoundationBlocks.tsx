import { Callout, JaText, Speakable } from "@/components/ui";
import type { FoundationBlock } from "@/lib/content/schemas";
import { KanaTile } from "./KanaTile";

/** Server component: renders the blocks of one Foundation lesson section. */
export function FoundationBlocks({ blocks }: { blocks: FoundationBlock[] }) {
  return (
    <div className="space-y-6">
      {blocks.map((b, i) => (
        <Block key={i} block={b} />
      ))}
    </div>
  );
}

function Block({ block }: { block: FoundationBlock }) {
  switch (block.kind) {
    case "text":
      return (
        <div className="prose-lesson text-ink-2 leading-relaxed max-w-prose">
          {block.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      );

    case "kana-chart": {
      const cols = Math.max(...block.rows.map((r) => r.length));
      const hasLabels = Boolean(block.rowLabels && block.rowLabels.length === block.rows.length);
      return (
        <figure className="surface rounded-2xl p-3 sm:p-5">
          <figcaption className="flex items-center justify-between gap-3 mb-3 px-1">
            <span className="font-semibold">{block.title}</span>
            <span className="text-xs text-muted hidden sm:inline">Tap a tile to hear it</span>
          </figcaption>
          <div className="overflow-x-auto no-scrollbar -mx-1 px-1">
            <div
              className="grid gap-1.5 sm:gap-2 min-w-[18rem]"
              style={{ gridTemplateColumns: `${hasLabels ? "2.25rem " : ""}repeat(${cols}, minmax(0, 1fr))` }}
              role="table"
              aria-label={block.title}
            >
              {block.rows.map((row, r) => (
                <div key={r} role="row" className="contents">
                  {hasLabels && (
                    <div role="rowheader" lang="ja" className="ja flex items-center justify-center text-[11px] sm:text-xs font-medium uppercase tracking-wider text-muted">
                      {block.rowLabels![r]}
                    </div>
                  )}
                  {Array.from({ length: cols }, (_, c) => {
                    const cell = row[c];
                    return cell ? (
                      <div key={c} role="cell">
                        <KanaTile kana={cell.kana} romaji={cell.romaji} />
                      </div>
                    ) : (
                      <div key={c} role="cell" aria-hidden className="rounded-xl border border-dashed border-line/70" />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </figure>
      );
    }

    case "table":
      return (
        <div className="surface rounded-2xl overflow-hidden">
          {block.title && <p className="px-4 pt-4 pb-2 font-semibold">{block.title}</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-2/70 text-left">
                  {block.columns.map((c, i) => (
                    <th key={i} scope="col" className="px-4 py-2.5 text-[11px] uppercase tracking-[0.12em] text-muted font-medium whitespace-nowrap">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, r) => (
                  <tr key={r} className={`border-t border-line ${r % 2 === 1 ? "bg-surface-2/40" : ""}`}>
                    {row.map((cell, c) => (
                      <td key={c} lang={hasJa(cell) ? "ja" : undefined} className={`px-4 py-2.5 align-top leading-relaxed ${hasJa(cell) ? "ja" : ""} ${c === 0 ? "font-medium text-ink whitespace-nowrap" : "text-ink-2"}`}>
                        {c === 0 && hasJa(cell) ? <Speakable text={cell} /> : cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );

    case "list":
      return (
        <div>
          {block.title && <p className="font-semibold mb-2.5">{block.title}</p>}
          <ol className="space-y-2.5">
            {block.items.map((it, i) => (
              <li key={i} className="flex gap-3 leading-relaxed text-ink-2">
                <span className="mt-0.5 h-5 w-5 rounded-full bg-accent-soft text-accent-ink grid place-items-center text-[11px] font-bold shrink-0 tabular-nums" aria-hidden>
                  {i + 1}
                </span>
                <span lang={hasJa(it) ? "ja" : undefined} className={hasJa(it) ? "ja" : ""}>
                  {it}
                </span>
              </li>
            ))}
          </ol>
        </div>
      );

    case "words":
      return (
        <div className="surface rounded-2xl overflow-hidden">
          {block.title && <p className="px-5 pt-4 pb-1 font-semibold">{block.title}</p>}
          <ol className="divide-y divide-line">
            {block.items.map((w, i) => (
              <li key={i} className="px-5 py-3">
                <JaText ja={w.ja} reading={w.reading} en={w.en} size="lg" />
              </li>
            ))}
          </ol>
        </div>
      );

    case "callout":
      return (
        <Callout tone={block.tone} title={block.title}>
          <span lang={hasJa(block.text) ? "ja" : undefined}>{block.text}</span>
        </Callout>
      );
  }
}

function hasJa(s: string) {
  return /[぀-ヿ一-鿿]/.test(s);
}
