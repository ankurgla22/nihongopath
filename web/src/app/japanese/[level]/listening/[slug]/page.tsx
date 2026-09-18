import { jsonLdString } from "@/components/content/JsonLd";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { findListening, getListening, getQuestionMap } from "@/lib/content";
import { LEVELS, LEVEL_LABEL, LevelSchema, type Question } from "@/lib/content/schemas";
import { pageMetadata, breadcrumbJsonLd, articleJsonLd } from "@/lib/seo/metadata";
import { Badge, Breadcrumbs, Button, Card, Container, Section, SpeakButton } from "@/components/ui";
import { LISTENING_KIND_LABEL } from "@/components/listening/labels";
import { ListeningPractice } from "@/components/listening/ListeningPractice";

export function generateStaticParams() {
  return LEVELS.flatMap((level) => getListening(level).map((e) => ({ level, slug: e.slug })));
}

export function generateMetadata({ params }: { params: { level: string; slug: string } }): Metadata {
  const p = LevelSchema.safeParse(params.level);
  if (!p.success) return {};
  const e = findListening(p.data, params.slug);
  if (!e) return {};
  const L = LEVEL_LABEL[p.data];
  const k = LISTENING_KIND_LABEL[e.kind];
  return pageMetadata({
    title: `${e.title} – ${L} Listening (${k.ja})`,
    description: `JLPT ${L} listening exercise "${e.title}" (${k.en}): ${e.setting}. Audio, transcript, vocabulary, ${e.questionIds.length} questions with explanations, and shadowing practice.`,
    path: `/japanese/${p.data}/listening/${e.slug}`,
  });
}

/** Chat-style transcript: each speaker gets a side and an avatar initial. */
function Transcript({ script }: { script: { speaker: string; line: string }[] }) {
  const speakers: string[] = [];
  for (const l of script) if (!speakers.includes(l.speaker)) speakers.push(l.speaker);
  const avatarTone = ["bg-accent-soft text-accent-ink", "bg-info-soft text-info", "bg-ok-soft text-ok", "bg-warn-soft text-warn"];
  return (
    <Card padding="p-4 sm:p-6">
      <dl className="space-y-4">
        {script.map((l, i) => {
          const si = speakers.indexOf(l.speaker);
          const right = si % 2 === 1;
          const tone = avatarTone[si % avatarTone.length];
          return (
            <div key={i} className={`flex items-end gap-2.5 ${right ? "flex-row-reverse" : ""}`}>
              <dt className="shrink-0">
                <span aria-hidden className={`ja h-8 w-8 rounded-full grid place-items-center text-xs font-semibold ${tone}`}>
                  {l.speaker.trim().charAt(0)}
                </span>
                <span lang="ja" className="sr-only">{l.speaker}</span>
              </dt>
              <dd className={`max-w-[85%] sm:max-w-[75%] ${right ? "text-right" : ""}`}>
                <p lang="ja" className="ja text-[11px] text-muted mb-1 px-1">{l.speaker}</p>
                <span className={`flex items-end gap-1.5 ${right ? "flex-row-reverse" : ""}`}>
                  <p
                    lang="ja"
                    className={`ja inline-block text-left text-base sm:text-lg leading-relaxed px-4 py-2.5 rounded-2xl border ${
                      right ? "bg-accent-soft border-accent/10 rounded-br-md" : "bg-surface-2 border-line rounded-bl-md"
                    }`}
                  >
                    {l.line}
                  </p>
                  <SpeakButton text={l.line} size="xs" className="mb-1" />
                </span>
              </dd>
            </div>
          );
        })}
      </dl>
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
              <span lang="ja" className="ja text-base font-medium text-ink">{v.word}</span>
              {v.reading && (
                <span lang="ja" className="ja block text-xs text-muted">{v.reading}</span>
              )}
            </dt>
            <SpeakButton text={v.word} size="xs" className="self-center" />
            <dd className="text-sm text-ink-2 ml-auto text-right">{v.meaning}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

export default function ListeningDetailPage({ params }: { params: { level: string; slug: string } }) {
  const p = LevelSchema.safeParse(params.level);
  if (!p.success) notFound();
  const level = p.data;
  const e = findListening(level, params.slug);
  if (!e) notFound();
  const L = LEVEL_LABEL[level];
  const k = LISTENING_KIND_LABEL[e.kind];
  const qmap = getQuestionMap();
  const questions = e.questionIds.map((id) => qmap.get(id)).filter((q): q is Question => Boolean(q));

  const all = getListening(level);
  const idx = all.findIndex((x) => x.id === e.id);
  const prev = idx > 0 ? all[idx - 1] : undefined;
  const next = idx >= 0 && idx < all.length - 1 ? all[idx + 1] : undefined;

  const path = `/japanese/${level}/listening/${e.slug}`;
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Japanese", path: "/japanese" },
    { name: L, path: `/japanese/${level}` },
    { name: "Listening", path: `/japanese/${level}/listening` },
    { name: e.title },
  ];

  const transcript = (
    <Section id="transcript" title="Transcript" intro="Read the script carefully. Anything you did not catch is what to shadow.">
      <Transcript script={e.script} />
    </Section>
  );

  const vocabulary = (
    <Section id="vocabulary" title="Vocabulary in this exercise">
      {e.vocab.length === 0 ? <p className="text-sm text-muted">No vocabulary list for this exercise.</p> : <VocabGrid vocab={e.vocab} />}
    </Section>
  );

  return (
    <Container>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString([
            breadcrumbJsonLd(crumbs.map((c) => ({ name: c.name, path: c.path ?? path }))),
            articleJsonLd({ headline: e.title, description: `${L} listening exercise: ${e.setting}`, path, inLanguage: "ja" }),
          ]),
        }}
      />
      <Breadcrumbs items={crumbs} />

      <article className="pb-8">
        <header className="pt-8 pb-8 animate-rise">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-accent mb-3">
            {L} · <span lang="ja" className="ja normal-case tracking-normal">{k.ja}</span> · {k.en}
          </p>
          <h1 lang="ja" className="ja text-h1">
            {e.title}
          </h1>
          <div className="flex flex-wrap items-center gap-1.5 mt-4">
            <Badge tone="accent" size="md">{L}</Badge>
            <Badge size="md">{e.script.length} lines</Badge>
            <Badge size="md">{questions.length} {questions.length === 1 ? "question" : "questions"}</Badge>
          </div>
          <div className="mt-5 surface rounded-2xl px-4 py-3.5 sm:px-5">
            <p className="text-sm">
              <span className="text-[11px] uppercase tracking-[0.14em] text-muted mr-2">Setting</span>
              <span className="text-ink">{e.setting}</span>
            </p>
            <p className="mt-1.5 text-sm text-muted">{k.hint}</p>
          </div>
        </header>

        <ListeningPractice audioSrc={e.audioSrc} lines={e.script} questions={questions} transcript={transcript} vocabulary={vocabulary} />

        <nav className="mt-14 grid gap-3 sm:grid-cols-[1fr_auto_1fr] items-stretch" aria-label="Exercise navigation">
          <div>
            {prev && (
              <Link href={`/japanese/${level}/listening/${prev.slug}`} className="group block h-full surface surface-hover rounded-2xl p-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted">← Previous</p>
                <p lang="ja" className="ja font-medium mt-1 group-hover:text-accent transition">{prev.title}</p>
              </Link>
            )}
          </div>
          <div className="flex items-center justify-center">
            <Button href={`/japanese/${level}/listening`} variant="secondary" size="sm">All {L} listening</Button>
          </div>
          <div>
            {next && (
              <Link href={`/japanese/${level}/listening/${next.slug}`} className="group block h-full surface surface-hover rounded-2xl p-4 sm:text-right">
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
