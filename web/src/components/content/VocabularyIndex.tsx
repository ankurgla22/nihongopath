import Link from "next/link";
import { notFound } from "next/navigation";
import { Arrow, Breadcrumbs, Button, Container, PageTitle } from "@/components/ui";
import { getVocabulary } from "@/lib/content";
import { LEVEL_LABEL, type Level, type VocabItem } from "@/lib/content/schemas";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/content/JsonLd";
import { VocabCards } from "@/components/content/ContentCards";

/** Words per index page. 1,800 N2 words in one document was a 4.6 MB HTML page. */
export const VOCAB_PAGE_SIZE = 150;

export function vocabPageCount(level: Level): number {
  return Math.max(1, Math.ceil(getVocabulary(level).length / VOCAB_PAGE_SIZE));
}

export function vocabPagePath(level: Level, page: number): string {
  const base = `/japanese/${level}/vocabulary`;
  return page <= 1 ? base : `${base}/page/${page}`;
}

/** Page 1's canonical is the base URL; every other page is canonical to itself. */
export function vocabPageMetadata(level: Level, page: number) {
  const label = LEVEL_LABEL[level];
  const n = getVocabulary(level).length;
  const pages = vocabPageCount(level);
  if (page < 1 || page > pages) return {};
  const from = (page - 1) * VOCAB_PAGE_SIZE + 1;
  const to = Math.min(n, page * VOCAB_PAGE_SIZE);
  if (page === 1) {
    return pageMetadata({
      title: `JLPT ${label} vocabulary list: ${n.toLocaleString()} words with readings and examples`,
      description: `The complete JLPT ${label} vocabulary list grouped by theme. Every word has a reading, part of speech, meaning and a natural example sentence.`,
      path: vocabPagePath(level, 1),
    });
  }
  return pageMetadata({
    title: `${label} Vocabulary — page ${page} of ${pages}`,
    description: `JLPT ${label} vocabulary words ${from} to ${to} of ${n.toLocaleString()}, with readings, part of speech, meanings and example sentences. Page ${page} of ${pages}.`,
    path: vocabPagePath(level, page),
  });
}

/** Group by theme when present (a header is shown whenever the theme changes); otherwise by blocks of 50 in study order. */
function group(items: VocabItem[], hasTheme: boolean) {
  const groups: [string, VocabItem[]][] = [];
  for (const v of items) {
    const key = hasTheme ? v.theme ?? "Other" : `Words ${Math.floor((v.order - 1) / 50) * 50 + 1}–${Math.floor((v.order - 1) / 50) * 50 + 50}`;
    const last = groups[groups.length - 1];
    if (last && last[0] === key) last[1].push(v);
    else groups.push([key, [v]]);
  }
  return groups;
}

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9぀-ヿ一-龯]+/g, "-")
      .replace(/^-|-$/g, "") || "group"
  );
}

/** 1 … p-1 p p+1 … N (all pages when there are few). */
function pageWindow(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const keep = new Set([1, 2, page - 1, page, page + 1, pages - 1, pages].filter((p) => p >= 1 && p <= pages));
  const out: (number | "…")[] = [];
  for (let p = 1; p <= pages; p++) {
    if (keep.has(p)) out.push(p);
    else if (out[out.length - 1] !== "…") out.push("…");
  }
  return out;
}

function Pager({ level, page, pages, total, className = "" }: { level: Level; page: number; pages: number; total: number; className?: string }) {
  if (pages <= 1) return null;
  const pill = "inline-flex items-center justify-center rounded-full border h-10 min-w-10 px-3 text-sm tabular-nums transition";
  const idle = `${pill} border-line bg-surface text-ink-2 hover:border-accent/50 hover:text-accent hover:bg-accent-soft/40`;
  const off = `${pill} border-line/60 text-muted/60 cursor-not-allowed`;
  return (
    <div className={className}>
      <nav aria-label="Vocabulary pages" className="flex flex-wrap items-center gap-1.5">
        {page > 1 ? (
          <Link href={vocabPagePath(level, page - 1)} rel="prev" className={idle}>
            ← Prev
          </Link>
        ) : (
          <span aria-disabled="true" className={off}>
            ← Prev
          </span>
        )}
        <ol className="flex flex-wrap items-center gap-1.5">
          {pageWindow(page, pages).map((p, i) =>
            p === "…" ? (
              <li key={`e${i}`} aria-hidden className="px-1 text-muted">
                …
              </li>
            ) : (
              <li key={p}>
                <Link
                  href={vocabPagePath(level, p)}
                  aria-current={p === page ? "page" : undefined}
                  aria-label={`Page ${p}: words ${(p - 1) * VOCAB_PAGE_SIZE + 1} to ${Math.min(total, p * VOCAB_PAGE_SIZE)}`}
                  className={p === page ? `${pill} border-accent bg-accent-soft text-accent-ink font-medium` : idle}
                >
                  {p}
                </Link>
              </li>
            ),
          )}
        </ol>
        {page < pages ? (
          <Link href={vocabPagePath(level, page + 1)} rel="next" className={idle}>
            Next →
          </Link>
        ) : (
          <span aria-disabled="true" className={off}>
            Next →
          </span>
        )}
      </nav>
    </div>
  );
}

/** One page of the vocabulary index. Shared by /japanese/[level]/vocabulary (page 1) and …/vocabulary/page/[n]. */
export function VocabularyIndex({ level, page }: { level: Level; page: number }) {
  const label = LEVEL_LABEL[level];
  const all = getVocabulary(level);
  if (all.length === 0) notFound();
  const pages = vocabPageCount(level);
  if (page < 1 || page > pages) notFound();
  const base = vocabPagePath(level, 1);
  const from = (page - 1) * VOCAB_PAGE_SIZE;
  const items = all.slice(from, from + VOCAB_PAGE_SIZE);
  const hasTheme = all.some((v) => v.theme);
  const groups = group(items, hasTheme);
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Learn Japanese", path: "/japanese" },
    { name: label, path: `/japanese/${level}` },
    { name: "Vocabulary", path: base },
    ...(page > 1 ? [{ name: `Page ${page}`, path: vocabPagePath(level, page) }] : []),
  ];

  return (
    <Container>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs.map((c, i) => (i === crumbs.length - 1 ? { name: c.name } : c))} />
      <PageTitle
        title={
          <>
            {label} vocabulary <span className="text-muted font-normal tabular-nums">· {all.length.toLocaleString()}</span>
          </>
        }
        actions={
          <Button href={`${base}/${items[0].slug}`}>
            Start with word {from + 1} <Arrow />
          </Button>
        }
      />

      <nav aria-label="Groups on this page" className="mb-8 flex flex-wrap gap-1.5 text-sm">
        {groups.map(([name, list]) => (
          <a key={name} href={`#${slugify(name)}`} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 h-8 text-ink-2 hover:border-accent/50 hover:text-accent hover:bg-accent-soft/40 transition">
            {name}
            <span className="text-[11px] tabular-nums text-muted">{list.length}</span>
          </a>
        ))}
      </nav>

      <div className="space-y-12 mb-10">
        {groups.map(([name, list]) => (
          <section key={name} id={slugify(name)} aria-labelledby={`h-${slugify(name)}`} className="scroll-mt-24">
            <h2 id={`h-${slugify(name)}`} className="text-h2 mb-3.5">
              {name}
            </h2>
            <VocabCards base={base} items={list.map((v) => [v.slug, v.order, v.word, v.reading, v.meaning, v.pos])} />
          </section>
        ))}
      </div>

      <Pager level={level} page={page} pages={pages} total={all.length} className="mb-20" />
    </Container>
  );
}
