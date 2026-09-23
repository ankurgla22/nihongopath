import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { Callout, Container, JaText, Section, SpeakButton, Speakable } from "@/components/ui";
import { findVocab, getKanji, getVocabulary } from "@/lib/content";
import { LEVELS, LEVEL_LABEL, type KanjiItem, type Level } from "@/lib/content/schemas";
import { decodeSlug, isLevel } from "@/components/content/levels";
import { articleJsonLd, breadcrumbJsonLd, pageMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/content/JsonLd";
import { LessonNavBottom, LessonNavTop } from "@/components/content/LessonNav";
import { SaveButton } from "@/components/content/SaveButton";
import { MarkComplete } from "@/components/content/MarkComplete";
import { LessonQuiz } from "@/components/quiz/LessonQuiz";
import { QuickCheckNote } from "@/components/content/QuickCheckNote";
import { generateVocabDrill } from "@/lib/drill/generate";
import { UpdatedOn } from "@/components/content/UpdatedOn";

type Params = { level: string; slug: string };

export function generateStaticParams() {
  // Pre-render enriched entries; the remaining ~4,700 words render on first request and are cached.
  return LEVELS.flatMap((level) => getVocabulary(level).filter((v) => v.enriched).map((v) => ({ level, slug: v.slug })));
}

export function generateMetadata({ params }: { params: Params }) {
  if (!isLevel(params.level)) return {};
  const v = findVocab(params.level, decodeSlug(params.slug));
  if (!v) return {};
  const label = LEVEL_LABEL[params.level];
  return pageMetadata({
    title: `${v.word}（${v.reading}） meaning: ${v.meaning} — JLPT ${label} vocabulary`,
    description: `${v.word} (${v.reading}) is a JLPT ${label} ${v.pos.toLowerCase()} meaning "${v.meaning}". Example: ${v.examples[0]?.ja ?? ""} ${v.examples[0]?.en ?? ""}`,
    path: `/japanese/${params.level}/vocabulary/${v.slug}`,
  });
}

const KANJI_RE = /[一-龯㐀-䶿]/;

/** Find each kanji in the word, preferring the same level, then any level. */
function kanjiInWord(word: string, level: Level): { char: string; item?: KanjiItem; level?: Level }[] {
  const chars = Array.from(new Set(Array.from(word).filter((c) => KANJI_RE.test(c))));
  const order: Level[] = [level, ...LEVELS.filter((l) => l !== level)];
  return chars.map((char) => {
    for (const l of order) {
      const item = getKanji(l).find((k) => k.character === char);
      if (item) return { char, item, level: l };
    }
    return { char };
  });
}

function WordList({ label, words, render }: { label: string; words: string[]; render: (w: string) => ReactNode }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[6rem_1fr] sm:items-baseline">
      <dt className="text-[11px] uppercase tracking-[0.14em] text-muted">{label}</dt>
      <dd className="flex flex-wrap gap-x-5 gap-y-1.5 text-lg">
        {words.map((w) => (
          <span key={w}>{render(w)}</span>
        ))}
      </dd>
    </div>
  );
}

export default function VocabularyDetailPage({ params }: { params: Params }) {
  if (!isLevel(params.level)) notFound();
  const level = params.level;
  const items = getVocabulary(level);
  const idx = items.findIndex((v) => v.slug === decodeSlug(params.slug));
  if (idx < 0) notFound();
  const v = items[idx];
  const prev = items[idx - 1];
  const next = items[idx + 1];
  const label = LEVEL_LABEL[level];
  const base = `/japanese/${level}/vocabulary`;
  const href = `${base}/${v.slug}`;
  const kanji = kanjiInWord(v.word, level);
  // Two generated questions (meaning + reading where possible); the seed is the item id so the page is stable.
  const quickCheck = generateVocabDrill([v], items, { seed: v.id }).slice(0, 2);

  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Japanese", path: "/japanese" },
    { name: label, path: `/japanese/${level}` },
    { name: "Vocabulary", path: base },
    { name: v.word },
  ];

  // A word with its own page links there (that page has Listen); any other word plays on tap.
  const wordLink = (w: string) => {
    const hit = items.find((x) => x.word === w);
    return hit ? (
      <Link href={`${base}/${hit.slug}`} lang="ja" className="ja text-ink underline-offset-4 decoration-line hover:text-accent hover:underline transition">
        {w}
      </Link>
    ) : (
      <Speakable text={w} className="text-ink-2" />
    );
  };

  return (
    <Container>
      <JsonLd
        data={[
          breadcrumbJsonLd([...crumbs.slice(0, 4).map((c) => ({ name: c.name, path: c.path! })), { name: v.word, path: href }]),
          articleJsonLd({ headline: `${v.word}（${v.reading}）— JLPT ${label} vocabulary`, description: v.meaning, path: href, inLanguage: "ja" }),
        ]}
      />
      <LessonNavTop
        crumbs={crumbs}
        index={idx + 1}
        total={items.length}
        unit="Word"
        actions={
          <>
            <SaveButton contentId={v.id} type="vocabulary" title={v.word} href={href} />
            <MarkComplete contentId={v.id} type="vocabulary" level={level} href={href} />
          </>
        }
      />

      <article className="pb-8">
        {/* Hero */}
        <header className="mt-8 surface rounded-2xl p-6 sm:p-8 relative overflow-hidden animate-rise">
          <div aria-hidden className="absolute inset-0 grid-bg opacity-60 pointer-events-none" />
          <div className="relative">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              <h1 lang="ja" className="ja text-5xl sm:text-6xl md:text-7xl font-semibold tracking-tight leading-none text-ink break-words">
                {v.word}
              </h1>
              <SpeakButton text={v.word} size="md" label />
            </div>
            {v.reading !== v.word && (
              <p lang="ja" className="ja mt-3 text-2xl sm:text-3xl text-muted">
                {v.reading}
              </p>
            )}
            <p className="mt-4 text-xl sm:text-2xl leading-snug text-ink-2 max-w-prose">{v.meaning}</p>
          </div>
          <UpdatedOn className="mt-4" />
        </header>

        <Section id="examples" title="Examples">
          <ol className="surface rounded-2xl p-5 sm:p-6">
            {v.examples.map((ex, i) => (
              <li key={i} className="group grid grid-cols-[1.75rem_1fr] gap-x-3 py-4 first:pt-0 last:pb-0 border-b border-line last:border-0">
                <span className="text-[11px] font-semibold tabular-nums text-muted pt-2.5 group-hover:text-accent transition" aria-hidden>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <JaText ja={ex.ja} reading={ex.reading} en={ex.en} size="xl" note={ex.note} />
                </div>
              </li>
            ))}
          </ol>
        </Section>

        {v.collocations.length > 0 && (
          <Section id="collocations" title="Common patterns">
            <dl className="surface rounded-2xl p-5 sm:p-6 divide-y divide-line">
              {v.collocations.map((c, i) => (
                <div key={i} className="py-2.5 first:pt-0 last:pb-0 flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
                  <dt>
                    <Speakable text={c.ja} className="text-lg font-semibold tracking-tight text-ink break-words" />
                  </dt>
                  <dd className="text-sm text-muted">{c.en}</dd>
                </div>
              ))}
            </dl>
          </Section>
        )}

        {(v.related.length > 0 || v.synonyms.length > 0 || v.antonyms.length > 0) && (
          <Section id="related" title="Related words">
            <dl className="surface rounded-2xl p-5 sm:p-6 space-y-4">
              {v.synonyms.length > 0 && <WordList label="Synonyms" words={v.synonyms} render={wordLink} />}
              {v.antonyms.length > 0 && <WordList label="Antonyms" words={v.antonyms} render={wordLink} />}
              {v.related.length > 0 && <WordList label="Related" words={v.related} render={wordLink} />}
            </dl>
          </Section>
        )}

        {v.memoryTip && (
          <Section id="memory" title="Memory tip">
            <Callout
              tone="accent"
              icon={
                <svg className="h-5 w-5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.6 1 1.3 1 2.5h6c0-1.2.3-1.9 1-2.5A6 6 0 0 0 12 3z" />
                </svg>
              }
            >
              {v.memoryTip}
            </Callout>
          </Section>
        )}

        {kanji.length > 0 && (
          <Section id="kanji" title="Kanji in this word">
            <ul className="grid gap-3 sm:grid-cols-2">
              {kanji.map(({ char, item, level: kl }) => (
                <li key={char}>
                  {item && kl ? (
                    <Link href={`/japanese/${kl}/kanji/${item.slug}`} className="group surface surface-hover rounded-2xl flex items-center gap-4 p-3.5 h-full">
                      <span lang="ja" className="ja shrink-0 h-16 w-16 rounded-xl bg-surface-2 border border-line grid place-items-center text-4xl font-medium text-ink group-hover:bg-accent-soft group-hover:text-accent-ink group-hover:border-accent/20 transition">
                        {char}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-semibold truncate group-hover:text-accent transition">{item.meanings.join(", ")}</span>
                        <span lang="ja" className="ja block text-sm text-muted truncate">
                          {[...item.onyomi, ...item.kunyomi].join("・")}
                        </span>
                      </span>
                    </Link>
                  ) : (
                    <div className="surface rounded-2xl flex items-center gap-4 p-3.5 h-full">
                      <span lang="ja" className="ja shrink-0 h-16 w-16 rounded-xl bg-surface-2 border border-line grid place-items-center text-4xl font-medium">
                        {char}
                      </span>
                      <span className="text-sm text-muted">Not in the N5–N1 kanji lists</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {quickCheck.length > 0 && (
          <Section id="quick-check" title="Quick check">
            <QuickCheckNote />
            <LessonQuiz questions={quickCheck} title="Quick check" />
          </Section>
        )}
      </article>

      <LessonNavBottom
        prev={prev ? { href: `${base}/${prev.slug}`, title: prev.word, subtitle: prev.meaning } : undefined}
        next={next ? { href: `${base}/${next.slug}`, title: next.word, subtitle: next.meaning } : undefined}
        indexHref={base}
        indexLabel={`${label} vocabulary`}
      />
      <div className="h-12" />
    </Container>
  );
}
