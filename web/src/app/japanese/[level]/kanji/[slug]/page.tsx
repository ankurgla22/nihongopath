import Link from "next/link";
import { notFound } from "next/navigation";
import { Callout, Container, JaText, Section, SpeakButton, Speakable } from "@/components/ui";
import { findKanji, getKanji, getVocabulary } from "@/lib/content";
import { LEVELS, LEVEL_LABEL, type Level, type VocabItem } from "@/lib/content/schemas";
import { decodeSlug, isLevel } from "@/components/content/levels";
import { articleJsonLd, breadcrumbJsonLd, pageMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/content/JsonLd";
import { LessonNavBottom, LessonNavTop } from "@/components/content/LessonNav";
import { SaveButton } from "@/components/content/SaveButton";
import { MarkComplete } from "@/components/content/MarkComplete";
import { LessonQuiz } from "@/components/quiz/LessonQuiz";
import { QuickCheckNote } from "@/components/content/QuickCheckNote";
import { generateKanjiDrill } from "@/lib/drill/generate";

type Params = { level: string; slug: string };

export function generateStaticParams() {
  // Pre-render enriched kanji; the rest render on first request and are cached.
  return LEVELS.flatMap((level) => getKanji(level).filter((k) => k.enriched).map((k) => ({ level, slug: k.slug })));
}

export function generateMetadata({ params }: { params: Params }) {
  if (!isLevel(params.level)) return {};
  const k = findKanji(params.level, decodeSlug(params.slug));
  if (!k) return {};
  const label = LEVEL_LABEL[params.level];
  const readings = [...k.onyomi, ...k.kunyomi].join(", ");
  return pageMetadata({
    title: `${k.character} kanji: ${k.meanings.join(", ")} — readings, words and examples (JLPT ${label})`,
    description: `The kanji ${k.character} means "${k.meanings.join(", ")}" and is read ${readings}. Common words: ${k.words
      .slice(0, 3)
      .map((w) => `${w.word} (${w.reading})`)
      .join(", ")}. JLPT ${label}, set ${k.day}.`,
    path: `/japanese/${params.level}/kanji/${k.slug}`,
  });
}

/** Vocabulary containing this character: same level first, then other levels, capped. */
function vocabUsing(char: string, level: Level, cap = 12): { item: VocabItem; level: Level }[] {
  const out: { item: VocabItem; level: Level }[] = [];
  const order: Level[] = [level, ...LEVELS.filter((l) => l !== level)];
  for (const l of order) {
    for (const v of getVocabulary(l)) {
      if (v.word.includes(char)) out.push({ item: v, level: l });
      if (out.length >= cap) return out;
    }
  }
  return out;
}

function ReadingChips({ items }: { items: string[] }) {
  if (items.length === 0) return <span className="text-sm text-muted">none</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {items.map((r) => (
        <Speakable key={r} text={r} className="inline-flex items-center rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-lg leading-none text-ink" />
      ))}
    </span>
  );
}

export default function KanjiDetailPage({ params }: { params: Params }) {
  if (!isLevel(params.level)) notFound();
  const level = params.level;
  const items = getKanji(level);
  const idx = items.findIndex((k) => k.slug === decodeSlug(params.slug));
  if (idx < 0) notFound();
  const k = items[idx];
  const prev = items[idx - 1];
  const next = items[idx + 1];
  const label = LEVEL_LABEL[level];
  const base = `/japanese/${level}/kanji`;
  const href = `${base}/${k.slug}`;
  const vocab = vocabUsing(k.character, level);
  // Two generated questions (meaning + reading where possible); the seed is the item id so the page is stable.
  const quickCheck = generateKanjiDrill([k], items, { seed: k.id }).slice(0, 2);

  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Japanese", path: "/japanese" },
    { name: label, path: `/japanese/${level}` },
    { name: "Kanji", path: base },
    { name: k.character },
  ];

  const similarLink = (ch: string) => {
    for (const l of [level, ...LEVELS.filter((x) => x !== level)]) {
      const hit = getKanji(l).find((x) => x.character === ch);
      if (hit) return `/japanese/${l}/kanji/${hit.slug}`;
    }
    return null;
  };

  return (
    <Container>
      <JsonLd
        data={[
          breadcrumbJsonLd([...crumbs.slice(0, 4).map((c) => ({ name: c.name, path: c.path! })), { name: k.character, path: href }]),
          articleJsonLd({ headline: `${k.character} — ${k.meanings.join(", ")} (JLPT ${label} kanji)`, description: `Readings, words and examples for ${k.character}.`, path: href, inLanguage: "ja" }),
        ]}
      />
      <LessonNavTop
        crumbs={crumbs}
        index={idx + 1}
        total={items.length}
        unit="Kanji"
        actions={
          <>
            <SaveButton contentId={k.id} type="kanji" title={k.character} href={href} />
            <MarkComplete contentId={k.id} type="kanji" level={level} href={href} />
          </>
        }
      />

      <article className="pb-8">
        <header className="mt-8 grid gap-6 sm:grid-cols-[auto_1fr] sm:items-start animate-rise">
          {/* Character tile with a radical-like frame */}
          <div className="relative mx-auto sm:mx-0 w-44 h-44 sm:w-52 sm:h-52 rounded-2xl surface shadow-md overflow-hidden">
            <div aria-hidden className="absolute inset-0 grid-bg opacity-70" />
            {/* crosshair guides */}
            <span aria-hidden className="absolute left-1/2 top-3 bottom-3 w-px border-l border-dashed border-line-strong/70" />
            <span aria-hidden className="absolute top-1/2 left-3 right-3 h-px border-t border-dashed border-line-strong/70" />
            {/* corner brackets */}
            <span aria-hidden className="absolute top-2.5 left-2.5 h-3.5 w-3.5 border-t-2 border-l-2 border-accent rounded-tl-sm" />
            <span aria-hidden className="absolute top-2.5 right-2.5 h-3.5 w-3.5 border-t-2 border-r-2 border-accent rounded-tr-sm" />
            <span aria-hidden className="absolute bottom-2.5 left-2.5 h-3.5 w-3.5 border-b-2 border-l-2 border-accent rounded-bl-sm" />
            <span aria-hidden className="absolute bottom-2.5 right-2.5 h-3.5 w-3.5 border-b-2 border-r-2 border-accent rounded-br-sm" />
            <span lang="ja" className="ja absolute inset-0 grid place-items-center text-[7rem] sm:text-[8.5rem] font-medium leading-none text-ink">
              {k.character}
            </span>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <h1 className="text-h1">
                <span lang="ja" className="ja">
                  {k.character}
                </span>
                <span className="text-muted font-normal mx-2">·</span>
                <span className="text-ink-2 font-semibold">{k.meanings.join(", ")}</span>
              </h1>
              <SpeakButton text={k.kunyomi[0] ?? k.onyomi[0] ?? k.character} size="md" label />
            </div>
            <dl className="mt-5 surface rounded-2xl divide-y divide-line">
              <div className="grid grid-cols-[5.5rem_1fr] items-center gap-3 px-4 py-3">
                <dt className="text-[11px] uppercase tracking-[0.14em] text-muted">On-yomi</dt>
                <dd>
                  <ReadingChips items={k.onyomi} />
                </dd>
              </div>
              <div className="grid grid-cols-[5.5rem_1fr] items-center gap-3 px-4 py-3">
                <dt className="text-[11px] uppercase tracking-[0.14em] text-muted">Kun-yomi</dt>
                <dd>
                  <ReadingChips items={k.kunyomi} />
                </dd>
              </div>
            </dl>
          </div>
        </header>

        <Section id="words" title="Common words">
          <div className="surface rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="sr-only">
                <tr>
                  <th scope="col">Word</th>
                  <th scope="col">Reading</th>
                  <th scope="col">Meaning</th>
                </tr>
              </thead>
              <tbody>
                {k.words.map((w, i) => (
                  <tr key={i} className={`border-t border-line first:border-0 ${i % 2 === 1 ? "bg-surface-2/50" : ""}`}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Speakable text={w.word} className="text-xl font-semibold tracking-tight text-ink" />
                    </td>
                    <td lang="ja" className="ja px-3 py-3 text-sm text-muted whitespace-nowrap">
                      {w.reading}
                    </td>
                    <td className="px-4 py-3 text-ink-2 w-full">{w.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {k.examples.length > 0 && (
          <Section id="examples" title="Example sentences">
            <ol className="surface rounded-2xl p-5 sm:p-6">
              {k.examples.map((ex, i) => (
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
        )}

        {k.similarKanji.length > 0 && (
          <Section id="similar" title="Similar-looking kanji" intro="Do not confuse these on the exam.">
            <ul className="grid gap-3 sm:grid-cols-2">
              {k.similarKanji.map((s, i) => {
                const l = similarLink(s.character);
                const inner = (
                  <>
                    <span className="flex items-center gap-2 shrink-0">
                      <span lang="ja" className="ja h-14 w-14 rounded-xl bg-surface-2 border border-line grid place-items-center text-3xl text-ink">
                        {k.character}
                      </span>
                      <span className="text-muted text-xs" aria-hidden>
                        vs
                      </span>
                      <span lang="ja" className="ja h-14 w-14 rounded-xl bg-accent-soft border border-accent/20 grid place-items-center text-3xl font-medium text-accent-ink">
                        {s.character}
                      </span>
                    </span>
                    <span className="text-sm leading-relaxed text-ink-2 min-w-0">{s.note}</span>
                  </>
                );
                const cls = "surface rounded-2xl p-3.5 flex items-center gap-4 h-full";
                return (
                  <li key={i}>
                    {l ? (
                      <Link href={l} className={`${cls} surface-hover`}>
                        {inner}
                      </Link>
                    ) : (
                      <div className={cls}>{inner}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Section>
        )}

        {k.commonMistakes.length > 0 && (
          <Section id="mistakes" title="Common mistakes">
            <ul className="space-y-2.5">
              {k.commonMistakes.map((m, i) => (
                <li key={i} className="flex gap-3 leading-relaxed text-ink-2">
                  <span className="mt-0.5 h-5 w-5 rounded-full bg-accent-soft text-accent grid place-items-center text-[11px] font-bold shrink-0" aria-hidden>
                    !
                  </span>
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {k.memoryAid && (
          <Section id="memory" title="Memory aid">
            <Callout
              tone="accent"
              title="Picture it"
              icon={
                <svg className="h-5 w-5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.6 1 1.3 1 2.5h6c0-1.2.3-1.9 1-2.5A6 6 0 0 0 12 3z" />
                </svg>
              }
            >
              {k.memoryAid}
            </Callout>
          </Section>
        )}

        {vocab.length > 0 && (
          <Section id="vocab" title="Vocabulary using this kanji">
            <ul className="grid gap-2 sm:grid-cols-2">
              {vocab.map(({ item, level: vl }) => (
                <li key={item.id}>
                  <Link href={`/japanese/${vl}/vocabulary/${item.slug}`} className="group surface surface-hover rounded-2xl flex items-center gap-3 px-4 py-3 h-full min-w-0">
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2 min-w-0">
                        <span lang="ja" className="ja text-lg font-semibold tracking-tight text-ink group-hover:text-accent transition truncate">
                          {item.word}
                        </span>
                        <span lang="ja" className="ja text-sm text-muted truncate">
                          {item.reading}
                        </span>
                      </span>
                      <span className="block text-sm text-ink-2 truncate">{item.meaning}</span>
                    </span>
                  </Link>
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
        prev={prev ? { href: `${base}/${prev.slug}`, title: prev.character, subtitle: prev.meanings.join(", ") } : undefined}
        next={next ? { href: `${base}/${next.slug}`, title: next.character, subtitle: next.meanings.join(", ") } : undefined}
        indexHref={base}
        indexLabel={`${label} kanji`}
      />
      <div className="h-12" />
    </Container>
  );
}
