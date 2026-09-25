import Link from "next/link";
import { notFound } from "next/navigation";
import { Arrow, Breadcrumbs, Callout, Container, Section } from "@/components/ui";
import { JsonLd } from "@/components/content/JsonLd";
import { FaqSection } from "@/components/content/FaqSection";
import { findVocabCompare, memberHref, vocabComparePath, vocabComparisons, type CompareExample } from "@/lib/content/vocabCompare";
import { LEVEL_LABEL } from "@/lib/content/schemas";
import { decodeSlug, isLevel } from "@/components/content/levels";
import { faqJsonLd } from "@/lib/seo/faq";
import { articleJsonLd, breadcrumbJsonLd, pageMetadata } from "@/lib/seo/metadata";

const hasJa = (t: string) => /[぀-ヿ㐀-鿿]/.test(t);
const jaAttrs = (t: string) => (hasJa(t) ? { lang: "ja" } : {});

type Params = { level: string; slug: string };

export function generateStaticParams() {
  return vocabComparisons().map((c) => ({ level: c.level, slug: c.slug }));
}

function load(params: Params) {
  if (!isLevel(params.level)) return undefined;
  return findVocabCompare(params.level, decodeSlug(params.slug));
}

export function generateMetadata({ params }: { params: Params }) {
  const c = load(params);
  if (!c) return {};
  return pageMetadata({
    title: `${c.title}: what is the difference? (JLPT ${LEVEL_LABEL[c.level]})`,
    description: c.summary,
    path: vocabComparePath(c),
  });
}

function Sentence({ e }: { e: CompareExample }) {
  return (
    <li className="py-3.5 first:pt-0 last:pb-0 border-b border-line last:border-0">
      <p lang="ja" className="ja text-lg leading-relaxed text-ink break-words">
        {e.ja}
      </p>
      <p lang="ja" className="ja mt-1 text-sm text-muted break-words">
        {e.reading}
      </p>
      <p className="mt-1 text-sm text-ink-2">{e.en}</p>
      {e.note && <p className="mt-1.5 text-sm text-accent-ink">{e.note}</p>}
    </li>
  );
}

export default function VocabularyComparePage({ params }: { params: Params }) {
  const c = load(params);
  if (!c) notFound();
  const label = LEVEL_LABEL[c.level];
  const base = `/japanese/${c.level}/vocabulary`;

  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Japanese", path: "/japanese" },
    { name: label, path: `/japanese/${c.level}` },
    { name: "Vocabulary", path: base },
    { name: c.title },
  ];

  return (
    <Container>
      <JsonLd
        data={[
          breadcrumbJsonLd([...crumbs.slice(0, 4).map((x) => ({ name: x.name, path: x.path! })), { name: c.title, path: vocabComparePath(c) }]),
          articleJsonLd({
            level: c.level,
            headline: `${c.title}: what is the difference?`,
            description: c.summary,
            path: vocabComparePath(c),
          }),
          faqJsonLd(vocabComparePath(c), c.faq),
        ]}
      />
      <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: label, path: `/japanese/${c.level}` }, { name: "Vocabulary", path: base }, { name: c.title }]} />

      <article className="max-w-content pb-8">
        <h1 lang="ja" className="ja mt-6 text-h1 break-words">
          {c.title}
        </h1>
        <p className="mt-2 text-sm text-muted">JLPT {label} vocabulary · what is the difference?</p>

        {/* The answer, before anything else. A learner who reads only this should be able to leave. */}
        <div className="mt-6">
          <Callout tone="accent">
            <p className="text-lg leading-relaxed">{c.quickAnswer}</p>
          </Callout>
        </div>

        <Section id="each" title="When to use each">
          <div className="grid gap-4 sm:grid-cols-2">
            {c.members.map((m) => {
              const href = memberHref(m);
              return (
                <div key={m.word} className="surface rounded-2xl p-5 min-w-0">
                  <h3 lang="ja" className="ja text-2xl font-semibold tracking-tight break-words">
                    {m.word}
                  </h3>
                  {m.item && (
                    <p lang="ja" className="ja text-sm text-muted">
                      {m.item.reading}
                    </p>
                  )}
                  <p className="mt-3 leading-relaxed text-ink-2">{m.when}</p>
                  <ul className="mt-4">
                    {m.examples.map((e, i) => (
                      <Sentence key={i} e={e} />
                    ))}
                  </ul>
                  {href && (
                    <Link href={href} className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
                      Full entry for {m.word} <Arrow />
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </Section>

        <Section id="contrast" title="Sentences where only one works">
          <ul className="surface rounded-2xl p-5 sm:p-6">
            {c.contrast.map((e, i) => (
              <Sentence key={i} e={e} />
            ))}
          </ul>
        </Section>

        {(c.mistakes ?? []).length > 0 && (
          <Section id="mistakes" title="Common mistakes">
            <ul className="space-y-3">
              {(c.mistakes ?? []).map((m, i) => (
                <li key={i} className="surface rounded-2xl p-5">
                  {/* A mistake is usually a Japanese sentence, but some are a note about the wrong
                      kanji or the wrong reading, written in English. Tagging those `lang="ja"`
                      would hand a screen reader English text in a Japanese voice. */}
                  <p {...jaAttrs(m.wrong)} className={`text-ink-2 line-through decoration-line ${hasJa(m.wrong) ? "ja" : ""}`}>
                    {m.wrong}
                  </p>
                  <p {...jaAttrs(m.right)} className={`mt-1 text-lg text-ink ${hasJa(m.right) ? "ja" : ""}`}>
                    {m.right}
                  </p>
                  <p className="mt-2 text-sm text-ink-2 leading-relaxed">{m.why}</p>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <FaqSection items={c.faq} />
      </article>
    </Container>
  );
}
