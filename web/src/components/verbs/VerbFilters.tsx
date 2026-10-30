"use client";

import { useEffect, useState } from "react";

const LEVELS = [
  ["all", "All levels"],
  ["n5", "N5"],
  ["n4", "N4"],
] as const;
const GROUPS = [
  ["all", "All groups"],
  ["1", "Group 1"],
  ["2", "Group 2"],
  ["3", "Group 3"],
] as const;

const pill = "inline-flex items-center rounded-full border px-3 h-8 text-sm transition";
const idle = `${pill} border-line bg-surface text-ink-2 hover:border-accent/50 hover:text-accent hover:bg-accent-soft/40`;
const on = `${pill} border-accent bg-accent-soft text-accent-ink font-medium`;

/**
 * Filters the server-rendered verb table in place: each row carries data-level and data-group, and
 * search matches the row's own text (every form, including the hidden "More forms" cells). Keeping
 * the rows in the HTML means the verbs are not sent a second time as client props, and the full
 * table is there for search engines and no-JS readers.
 */
export function VerbFilters({ tableId, total }: { tableId: string; total: number }) {
  const [q, setQ] = useState("");
  const [level, setLevel] = useState<(typeof LEVELS)[number][0]>("all");
  const [group, setGroup] = useState<(typeof GROUPS)[number][0]>("all");
  const [more, setMore] = useState(false);
  const [shown, setShown] = useState(total);

  useEffect(() => {
    const table = document.getElementById(tableId);
    if (!table) return;
    table.dataset.more = String(more);
    // Spaces are ignored on both sides, so "benkyousuru" finds "benkyou suru".
    const needle = q.toLowerCase().replace(/\s+/g, "");
    let n = 0;
    table.querySelectorAll<HTMLTableRowElement>("tbody tr").forEach((tr) => {
      const text = (tr.textContent ?? "").toLowerCase().replace(/\s+/g, "");
      const ok = (level === "all" || tr.dataset.level === level) && (group === "all" || tr.dataset.group === group) && (!needle || text.includes(needle));
      tr.hidden = !ok;
      if (ok) n++;
    });
    setShown(n);
  }, [tableId, q, level, group, more]);

  return (
    <div className="mb-4 space-y-3">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search: 食べる, taberu, eat, 食べます…"
        aria-label="Search verbs"
        className="w-full sm:max-w-md h-10 rounded-xl border border-line bg-surface px-3.5 text-sm placeholder:text-muted focus:outline-none focus:border-accent"
      />
      <div className="flex flex-wrap items-center gap-1.5">
        {LEVELS.map(([k, label]) => (
          <button key={k} type="button" aria-pressed={level === k} onClick={() => setLevel(k)} className={level === k ? on : idle}>
            {label}
          </button>
        ))}
        <span aria-hidden className="mx-1 h-5 w-px bg-line" />
        {GROUPS.map(([k, label]) => (
          <button key={k} type="button" aria-pressed={group === k} onClick={() => setGroup(k)} className={group === k ? on : idle}>
            {label}
          </button>
        ))}
        <span aria-hidden className="mx-1 h-5 w-px bg-line" />
        <button type="button" aria-pressed={more} onClick={() => setMore(!more)} className={more ? on : idle}>
          {more ? "Fewer forms" : "More forms"}
        </button>
      </div>
      <p className="text-sm text-muted" aria-live="polite">
        {shown === total ? `${total} verbs` : shown === 0 ? "No verbs match. Try the dictionary form, the romaji or the English meaning." : `${shown} of ${total} verbs`}
      </p>
    </div>
  );
}
