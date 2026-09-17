import Link from "next/link";
import type { Metadata } from "next";
import { getFoundation, getGrammar, getKanji, getListening, getReading, getStrategy, getVocabulary } from "@/lib/content";
import { LEVELS, LEVEL_LABEL, type Level } from "@/lib/content/schemas";
import { pageMetadata } from "@/lib/seo/metadata";
import { Badge, Button, Container, EmptyState, Kbd, PageTitle, SpeakButton } from "@/components/ui";
import { JA_RE } from "@/components/study/helpers";

export const dynamic = "force-dynamic";

type Hit = { href: string; title: string; subtitle?: string; level?: Level };
type Group = { type: string; hits: Hit[] };

const CAP = 50;

function readQuery(sp: Record<string, string | string[] | undefined>) {
  const raw = sp.q;
  const q = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  return q.trim().slice(0, 80);
}

export function generateMetadata({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }): Metadata {
  const q = readQuery(searchParams);
  return pageMetadata({
    title: q ? `Search: ${q}` : "Search",
    description: "Search grammar points, vocabulary, kanji, reading passages, listening exercises and JLPT strategy guides across N5–N1.",
    path: "/search",
    noIndex: Boolean(q),
  });
}

function search(q: string): { groups: Group[]; total: number } {
  const needle = q.toLowerCase();
  const has = (...fields: (string | undefined)[]) => fields.some((f) => f && f.toLowerCase().includes(needle));
  const groups: Group[] = [
    { type: "Foundation", hits: [] },
    { type: "Grammar", hits: [] },
    { type: "Vocabulary", hits: [] },
    { type: "Kanji", hits: [] },
    { type: "Reading", hits: [] },
    { type: "Listening", hits: [] },
    { type: "Strategy", hits: [] },
  ];
  let total = 0;
  const push = (g: Group, hit: Hit) => {
    if (total >= CAP) return;
    g.hits.push(hit);
    total++;
  };

  for (const f of getFoundation()) {
    if (has(f.title, f.summary)) push(groups[0], { href: `/japanese/foundation/${f.slug}`, title: f.title, subtitle: f.summary });
  }
  for (const level of LEVELS) {
    for (const g of getGrammar(level)) {
      if (has(g.title, g.romaji, g.meaning)) push(groups[1], { href: `/japanese/${level}/grammar/${g.slug}`, title: g.title, subtitle: g.meaning, level });
    }
    for (const v of getVocabulary(level)) {
      if (has(v.word, v.reading, v.meaning)) push(groups[2], { href: `/japanese/${level}/vocabulary/${v.slug}`, title: v.word, subtitle: `${v.reading} · ${v.meaning}`, level });
    }
    for (const k of getKanji(level)) {
      if (has(k.character, ...k.meanings)) push(groups[3], { href: `/japanese/${level}/kanji/${k.slug}`, title: k.character, subtitle: k.meanings.join(", "), level });
    }
    for (const r of getReading(level)) {
      if (has(r.title)) push(groups[4], { href: `/japanese/${level}/reading/${r.slug}`, title: r.title, subtitle: "Reading passage", level });
    }
    for (const l of getListening(level)) {
      if (has(l.title, l.setting)) push(groups[5], { href: `/japanese/${level}/listening/${l.slug}`, title: l.title, subtitle: l.setting, level });
    }
  }
  for (const a of getStrategy()) {
    if (has(a.title, a.summary)) push(groups[6], { href: `/jlpt/strategy/${a.slug}`, title: a.title, subtitle: "JLPT strategy" });
  }
  return { groups: groups.filter((g) => g.hits.length > 0), total };
}

const TYPE_TONE: Record<string, "neutral" | "accent" | "ok" | "warn" | "info"> = {
  Foundation: "accent",
  Grammar: "accent",
  Vocabulary: "info",
  Kanji: "warn",
  Reading: "ok",
  Listening: "info",
  Strategy: "neutral",
};

const POPULAR = ["わけではない", "に違いない", "影響", "経験", "聴解"];

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-5 w-5">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export default function SearchPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const q = readQuery(searchParams);
  const result = q ? search(q) : null;

  return (
    <Container>
      <PageTitle eyebrow="Search" title="Find anything across N5–N1" description="Grammar, vocabulary, kanji, reading, listening and JLPT strategy. Search in Japanese, romaji or English." />

      <form action="/search" method="get" role="search" className="flex flex-col sm:flex-row gap-3">
        <label htmlFor="q" className="sr-only">
          Search term
        </label>
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">
            <SearchIcon />
          </span>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="e.g. わけではない, 影響, 経, author's opinion"
            maxLength={80}
            className="h-14 w-full rounded-2xl border border-line bg-surface pl-12 pr-16 text-base sm:text-lg shadow-sm placeholder:text-muted/70 focus:border-accent focus:shadow-ring transition"
            autoComplete="off"
            autoFocus={!q}
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 hidden sm:inline-flex">
            <Kbd>Enter</Kbd>
          </span>
        </div>
        <Button type="submit" size="lg" className="sm:h-14 sm:px-7">
          Search
        </Button>
      </form>

      {q && result && (
        <section className="mt-8 mb-16" aria-live="polite">
          <p className="text-sm text-muted">
            {result.total === 0 ? (
              <>No results for &ldquo;{q}&rdquo;.</>
            ) : (
              <>
                <span className="font-semibold text-ink tabular-nums">
                  {result.total}
                  {result.total >= CAP ? "+" : ""}
                </span>{" "}
                result{result.total === 1 ? "" : "s"} for &ldquo;<span className="text-ink">{q}</span>&rdquo;
                {result.total >= CAP && " · showing the first 50; try a more specific term"}
              </>
            )}
          </p>

          {result.total === 0 && (
            <div className="mt-5">
              <EmptyState
                title={`Nothing matched “${q}”`}
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button href="/japanese/n2/grammar" variant="secondary" size="sm">
                      N2 grammar
                    </Button>
                    <Button href="/japanese/n2/vocabulary" variant="secondary" size="sm">
                      N2 vocabulary
                    </Button>
                    <Button href="/japanese/n2/kanji" variant="secondary" size="sm">
                      N2 kanji
                    </Button>
                    <Button href="/jlpt/strategy" variant="secondary" size="sm">
                      Strategy guides
                    </Button>
                  </div>
                }
              >
                Try searching in Japanese (kanji or kana), romaji for grammar, or an English meaning.
              </EmptyState>
            </div>
          )}

          {result.groups.map((g) => (
            <div key={g.type} className="mt-8">
              <h2 className="sticky top-16 z-10 glass -mx-4 sm:-mx-6 px-4 sm:px-6 py-2.5 border-y border-line text-sm font-semibold flex items-center gap-2">
                <Badge tone={TYPE_TONE[g.type]}>{g.type}</Badge>
                <span className="text-muted font-normal tabular-nums">{g.hits.length}</span>
              </h2>
              <ul className="mt-3 surface rounded-2xl divide-y divide-line overflow-hidden">
                {g.hits.map((h) => (
                  <li key={h.href} className="relative">
                    <Link href={h.href} className={`group flex items-center gap-4 px-4 sm:px-5 py-3.5 hover:bg-surface-2 transition ${JA_RE.test(h.title) ? "pr-12 sm:pr-14" : ""}`}>
                      <span className="min-w-0 flex-1">
                        <span lang="ja" className="ja font-medium text-lg block leading-snug">
                          {h.title}
                        </span>
                        {h.subtitle && <span className="text-sm text-muted block truncate mt-0.5">{h.subtitle}</span>}
                      </span>
                      {h.level && <Badge tone="accent">{LEVEL_LABEL[h.level]}</Badge>}
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-4 w-4 text-muted shrink-0 transition-transform group-hover:translate-x-0.5">
                        <path d="m9 6 6 6-6 6" />
                      </svg>
                    </Link>
                    {JA_RE.test(h.title) && <SpeakButton text={h.title} size="xs" className="absolute right-4 sm:right-5 top-1/2 -translate-y-1/2" />}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {!q && (
        <section className="mt-10 mb-16" aria-labelledby="popular">
          <p id="popular" className="text-[11px] uppercase tracking-[0.14em] text-muted">
            Popular starting points
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {POPULAR.map((term) => (
              <li key={term}>
                <Link href={`/search?q=${encodeURIComponent(term)}`} lang="ja" className="ja inline-flex items-center h-9 rounded-full border border-line bg-surface px-4 text-sm hover:bg-surface-2 hover:border-line-strong transition">
                  {term}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-8 grid gap-3 sm:grid-cols-3 text-sm">
            {[
              { k: "Japanese", ex: "影響, わけではない", note: "Kanji or kana" },
              { k: "Romaji", ex: "wake dewa nai", note: "For grammar patterns" },
              { k: "English", ex: "influence, author's opinion", note: "Meanings and topics" },
            ].map((t) => (
              <div key={t.k} className="surface rounded-2xl p-4">
                <p className="font-semibold">{t.k}</p>
                <p className="mt-1 text-muted">{t.note}</p>
                <p className="mt-2 text-ink-2">{t.ex}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </Container>
  );
}
