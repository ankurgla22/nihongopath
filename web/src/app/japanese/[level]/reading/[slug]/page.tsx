import { jsonLdString } from "@/components/content/JsonLd";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { findReading, getQuestionMap, getReading } from "@/lib/content";
import { LEVELS, LEVEL_LABEL, LevelSchema, type Question } from "@/lib/content/schemas";
import { pageMetadata, breadcrumbJsonLd, articleJsonLd } from "@/lib/seo/metadata";
import { Badge, Breadcrumbs, Button, Callout, Card, Container, Section, SpeakButton } from "@/components/ui";
import { READING_KIND_LABEL, fmtMinutes } from "@/components/reading/labels";
import { ReadingPractice } from "@/components/reading/ReadingPractice";
import { renderFurigana, stripFurigana } from "@/lib/content/furigana";
import { FuriganaSetting } from "@/components/content/FuriganaSetting";

export function generateStaticParams() {
  return LEVELS.flatMap((level) => getReading(level).map((r) => ({ level, slug: r.slug })));
}

export function generateMetadata({ params }: { params: { level: string; slug: string } }): Metadata {
  const p = LevelSchema.safeParse(params.level);
  if (!p.success) return {};
  const r = findReading(p.data, params.slug);
  if (!r) return {};
  const L = LEVEL_LABEL[p.data];
  const k = READING_KIND_LABEL[r.kind];
  return pageMetadata({
    title: `${r.title} – ${L} ${k.en} (${k.ja})`,
    description: `JLPT ${L} reading practice: "${r.title}" (${k.en}, ${fmtMinutes(r.timeLimitSeconds)}). Passage, vocabulary, strategy notes and ${r.questionIds.length} questions with full explanations.`,
    path: `/japanese/${p.data}/reading/${r.slug}`,
  });
}

/** The reading "paper": a wide, well-leaded block with a subtle paper feel. */
function Paper({ paragraphs, label }: { paragraphs: string[]; label?: string }) {
  return (
    <Card padding="p-0" className="relative overflow-hidden">
      <div aria-hidden className="absolute inset-x-0 top-0 h-1 accent-gradient opacity-80" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-bg-elev/60 to-transparent pointer-events-none" />
      {label && (
        <p className="relative px-6 sm:px-10 pt-6 text-[11px] uppercase tracking-[0.14em] text-muted">{label}</p>
      )}
      <div lang="ja" className={`relative ja mx-auto max-w-prose px-6 sm:px-10 ${label ? "pt-4" : "pt-8"} pb-8 sm:pb-10 space-y-6 text-lg sm:text-xl leading-loose text-ink`}>
        {paragraphs.map((para, i) => (
          <p key={i} className="text-justify [text-indent:1em]">
            {renderFurigana(para)}
            <span className="flex justify-end mt-1 [text-indent:0]">
              <SpeakButton text={stripFurigana(para)} size="xs" />
            </span>
          </p>
        ))}
      </div>
    </Card>
  );
}

function VocabGrid({ vocab }: { vocab: { word: string; reading: string; meaning: string }[] }) {
  return (
    <Card padding="p-2 sm:p-3">
      <dl className="grid gap-1 sm:grid-cols-2">
        {vocab.map((v, i) => (
          <div key={i} className="flex items-baseline gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-2 transition">
            <dt className="shrink-0 min-w-0">
              <span lang="ja" className="ja text-base font-medium text-ink">{renderFurigana(v.word)}</span>
              {v.reading && (
                <span lang="ja" className="ja block text-xs text-muted">{v.reading}</span>
              )}
            </dt>
            <SpeakButton text={stripFurigana(v.word)} size="xs" className="self-center" />
            <dd className="text-sm text-ink-2 ml-auto text-right">{v.meaning}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function LightbulbIcon() {
  return (
    <svg className="h-5 w-5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z" />
    </svg>
  );
}

export default function ReadingDetailPage({ params }: { params: { level: string; slug: string } }) {
  const p = LevelSchema.safeParse(params.level);
  if (!p.success) notFound();
  const level = p.data;
  const r = findReading(level, params.slug);
  if (!r) notFound();
  const L = LEVEL_LABEL[level];
  const k = READING_KIND_LABEL[r.kind];
  const qmap = getQuestionMap();
  const questions = r.questionIds.map((id) => qmap.get(id)).filter((q): q is Question => Boolean(q));

  const all = getReading(level);
  const idx = all.findIndex((x) => x.id === r.id);
  const prev = idx > 0 ? all[idx - 1] : undefined;
  const next = idx >= 0 && idx < all.length - 1 ? all[idx + 1] : undefined;

  const path = `/japanese/${level}/reading/${r.slug}`;
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Japanese", path: "/japanese" },
    { name: L, path: `/japanese/${level}` },
    { name: "Reading", path: `/japanese/${level}/reading` },
    { name: r.title },
  ];

  const charCount = stripFurigana(r.paragraphs.join("")).length + stripFurigana(r.paragraphsB?.join("") ?? "").length;

  return (
    <Container>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString([
            breadcrumbJsonLd(crumbs.map((c) => ({ name: c.name, path: c.path ?? path }))),
            articleJsonLd({ headline: r.title, description: `${L} ${k.en} reading passage`, path, inLanguage: "ja" }),
          ]),
        }}
      />
      <Breadcrumbs items={crumbs} />
      <FuriganaSetting />

      <article className="pb-8">
        <header className="pt-8 pb-8 animate-rise">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-accent mb-3">
            {L} · <span lang="ja" className="ja normal-case tracking-normal">{k.ja}</span> · {k.en}
          </p>
          <h1 lang="ja" className="ja text-h1">
            {r.title}
          </h1>
          <div className="flex flex-wrap items-center gap-1.5 mt-4">
            <Badge tone="accent" size="md">{L}</Badge>
            <Badge size="md">Time limit {fmtMinutes(r.timeLimitSeconds)}</Badge>
            <Badge size="md">{questions.length} {questions.length === 1 ? "question" : "questions"}</Badge>
            <Badge size="md">{charCount.toLocaleString()} characters</Badge>
          </div>
        </header>

        {r.strategyNotes.length > 0 && (
          <div className="animate-rise-2">
            <Callout tone="accent" title="Strategy notes: read these before the passage" icon={<LightbulbIcon />}>
              <ul className="space-y-1.5">
                {r.strategyNotes.map((n, i) => (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden className="text-accent mt-[3px]">•</span>
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            </Callout>
          </div>
        )}

        <Section
          id="passage"
          title={r.kind === "integrated" ? "Text A" : "Passage"}
          intro={r.kind === "integrated" ? "Two texts on the same theme. Compare their positions." : k.hint}
          actions={<SpeakButton text={stripFurigana(r.paragraphs.join("。"))} size="md" label className="shrink-0" />}
        >
          <Paper paragraphs={r.paragraphs} label={r.kind === "integrated" ? "A" : undefined} />
        </Section>

        {r.kind === "integrated" && r.paragraphsB && r.paragraphsB.length > 0 && (
          <Section id="passage-b" title="Text B" actions={<SpeakButton text={stripFurigana(r.paragraphsB.join("。"))} size="md" label className="shrink-0" />}>
            <Paper paragraphs={r.paragraphsB} label="B" />
          </Section>
        )}

        {r.vocab.length > 0 && (
          <Section id="vocabulary" title="Vocabulary in this passage" intro="Words worth knowing before you start the timer.">
            <VocabGrid vocab={r.vocab} />
          </Section>
        )}

        <Section id="questions" title="Questions" intro={`Aim to finish within ${fmtMinutes(r.timeLimitSeconds)}. After checking, every answer is explained.`}>
          <ReadingPractice questions={questions} timeLimitSeconds={r.timeLimitSeconds} />
        </Section>

        <nav className="mt-14 grid gap-3 sm:grid-cols-[1fr_auto_1fr] items-stretch" aria-label="Passage navigation">
          <div>
            {prev && (
              <Link href={`/japanese/${level}/reading/${prev.slug}`} className="group block h-full surface surface-hover rounded-2xl p-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted">← Previous</p>
                <p lang="ja" className="ja font-medium mt-1 group-hover:text-accent transition">{prev.title}</p>
              </Link>
            )}
          </div>
          <div className="flex items-center justify-center">
            <Button href={`/japanese/${level}/reading`} variant="secondary" size="sm">All {L} reading</Button>
          </div>
          <div>
            {next && (
              <Link href={`/japanese/${level}/reading/${next.slug}`} className="group block h-full surface surface-hover rounded-2xl p-4 sm:text-right">
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted">Next →</p>
                <p lang="ja" className="ja font-medium mt-1 group-hover:text-accent transition">{next.title}</p>
              </Link>
            )}
          </div>
        </nav>
      </article>
    </Container>
  );
}
