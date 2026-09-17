import { jsonLdString } from "@/components/content/JsonLd";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getListening } from "@/lib/content";
import { LEVELS, LEVEL_LABEL, LevelSchema } from "@/lib/content/schemas";
import { pageMetadata, breadcrumbJsonLd } from "@/lib/seo/metadata";
import { Arrow, Badge, Breadcrumbs, Button, Callout, Container, EmptyState, PageTitle, Pill } from "@/components/ui";
import { LISTENING_KIND_LABEL, LISTENING_KIND_ORDER } from "@/components/listening/labels";

export function generateStaticParams() {
  return LEVELS.map((level) => ({ level }));
}

export function generateMetadata({ params }: { params: { level: string } }): Metadata {
  const p = LevelSchema.safeParse(params.level);
  if (!p.success) return {};
  const L = LEVEL_LABEL[p.data];
  return pageMetadata({
    title: `${L} Listening Practice (聴解)`,
    description: `JLPT ${L} listening exercises with audio, transcript, vocabulary, questions with explanations, replay, playback speed and shadowing practice.`,
    path: `/japanese/${p.data}/listening`,
  });
}

const KIND_GLYPH: Record<(typeof LISTENING_KIND_ORDER)[number], string> = {
  task: "課",
  point: "点",
  summary: "概",
  integrated: "統",
  "quick-response": "即",
};

const ROUTINE = ["Listen once without the transcript, as in the exam.", "Answer, then check the explanations.", "Read the transcript and find what you missed.", "Listen again while reading, then shadow each line aloud.", "Review the vocabulary and come back tomorrow."];

function SpeakerIcon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 10v4h3l4 4V6L7 10H4zM15 9a3 3 0 0 1 0 6M18 6a7 7 0 0 1 0 12" />
    </svg>
  );
}

export default function ListeningIndexPage({ params }: { params: { level: string } }) {
  const p = LevelSchema.safeParse(params.level);
  if (!p.success) notFound();
  const level = p.data;
  const L = LEVEL_LABEL[level];
  const exercises = getListening(level);

  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Japanese", path: "/japanese" },
    { name: L, path: `/japanese/${level}` },
    { name: "Listening" },
  ];

  const kindsPresent = LISTENING_KIND_ORDER.filter((kind) => exercises.some((e) => e.kind === kind));

  return (
    <Container>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd(crumbs.map((c) => ({ name: c.name, path: c.path ?? `/japanese/${level}/listening` })))) }} />
      <Breadcrumbs items={crumbs} />
      <PageTitle
        eyebrow={`${L} · 聴解`}
        title={`${L} Listening Practice`}
        description="Every exercise follows the same routine: listen once, answer, check, read the transcript, listen again, shadow, then review the vocabulary."
      />

      <div className="animate-rise-2">
        <Callout
          tone="accent"
          title="The listening routine"
          icon={
            <svg className="h-5 w-5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 12a8 8 0 0 1 16 0v5a2 2 0 0 1-2 2h-1v-6h3M4 12v5a2 2 0 0 0 2 2h1v-6H4" />
            </svg>
          }
        >
          <ol className="grid gap-1.5 sm:grid-cols-2">
            {ROUTINE.map((step, i) => (
              <li key={i} className="flex gap-2.5">
                <span aria-hidden className="shrink-0 h-5 w-5 rounded-full bg-accent text-white text-[11px] font-semibold grid place-items-center tabular-nums mt-px">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </Callout>
      </div>

      {kindsPresent.length > 1 && (
        <nav aria-label="Exercise types" className="mt-6 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto no-scrollbar">
          <ul className="flex gap-2 w-max">
            {kindsPresent.map((kind) => {
              const k = LISTENING_KIND_LABEL[kind];
              return (
                <li key={kind}>
                  <Pill href={`#kind-${kind}`}>
                    <span lang="ja" className="ja mr-1.5">{k.ja}</span>
                    <span className="text-muted">{k.en}</span>
                  </Pill>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {exercises.length === 0 ? (
        <div className="mt-8">
          <EmptyState title={`Listening exercises for ${L} are on the way.`} action={<Button href={`/japanese/${level}/reading`} variant="secondary">Practise {L} reading</Button>}>
            Meanwhile, read the{" "}
            <Link href="/jlpt/strategy" className="text-accent underline">listening strategy guide</Link>.
          </EmptyState>
        </div>
      ) : (
        LISTENING_KIND_ORDER.map((kind) => {
          const items = exercises.filter((e) => e.kind === kind);
          if (items.length === 0) return null;
          const k = LISTENING_KIND_LABEL[kind];
          return (
            <section key={kind} id={`kind-${kind}`} className="mt-12 scroll-mt-24" aria-labelledby={`kind-${kind}-title`}>
              <div className="flex items-start gap-3.5 mb-4">
                <span aria-hidden className="ja shrink-0 h-11 w-11 rounded-2xl bg-info-soft text-info grid place-items-center text-lg font-semibold">
                  {KIND_GLYPH[kind]}
                </span>
                <div className="min-w-0">
                  <h2 id={`kind-${kind}-title`} className="text-h2">
                    <span lang="ja" className="ja">{k.ja}</span>
                    <span className="text-muted font-normal"> · {k.en}</span>
                  </h2>
                  <p className="text-sm text-muted mt-1">{k.hint}</p>
                </div>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2">
                {items.map((e) => (
                  <li key={e.id}>
                    <Link href={`/japanese/${level}/listening/${e.slug}`} className="group block h-full surface surface-hover rounded-2xl p-5 focus-visible:outline-none focus-visible:shadow-ring">
                      <div className="flex flex-wrap items-center gap-1.5 mb-3">
                        <Badge tone="accent">{L}</Badge>
                        <Badge>
                          <SpeakerIcon />
                          {e.script.length} lines
                        </Badge>
                        <Badge>{e.questionIds.length} {e.questionIds.length === 1 ? "question" : "questions"}</Badge>
                        {!e.audioSrc && <Badge tone="info">Browser speech</Badge>}
                      </div>
                      <p lang="ja" className="ja font-semibold text-lg leading-snug text-ink">{e.title}</p>
                      <div className="mt-3 flex items-end justify-between gap-3 text-xs text-muted">
                        <span className="line-clamp-2">{e.setting}</span>
                        <span className="shrink-0 inline-flex items-center gap-1 text-accent opacity-0 -translate-x-1 transition group-hover:opacity-100 group-hover:translate-x-0 group-focus-visible:opacity-100">
                          Open <Arrow />
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}

      <nav className="mt-14 mb-12 flex flex-wrap gap-2" aria-label="Related">
        <Button href={`/japanese/${level}/reading`} variant="secondary" size="sm">{L} reading</Button>
        <Button href="/jlpt/strategy" variant="secondary" size="sm">Listening strategy guide</Button>
        <Button href={`/japanese/${level}`} variant="ghost" size="sm">{L} hub <Arrow /></Button>
      </nav>
    </Container>
  );
}
