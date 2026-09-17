import { jsonLdString } from "@/components/content/JsonLd";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getReading } from "@/lib/content";
import { LEVELS, LEVEL_LABEL, LevelSchema } from "@/lib/content/schemas";
import { pageMetadata, breadcrumbJsonLd } from "@/lib/seo/metadata";
import { Arrow, Badge, Breadcrumbs, Button, Callout, Container, EmptyState, PageTitle, Pill } from "@/components/ui";
import { READING_KIND_LABEL, READING_KIND_ORDER, fmtMinutes } from "@/components/reading/labels";

export function generateStaticParams() {
  return LEVELS.map((level) => ({ level }));
}

export function generateMetadata({ params }: { params: { level: string } }): Metadata {
  const p = LevelSchema.safeParse(params.level);
  if (!p.success) return {};
  const L = LEVEL_LABEL[p.data];
  return pageMetadata({
    title: `${L} Reading Practice (読解)`,
    description: `JLPT ${L} reading passages with time limits, strategy notes, vocabulary and questions explained: short, medium, long, integrated and information-retrieval texts.`,
    path: `/japanese/${p.data}/reading`,
  });
}

/** One glyph per passage kind, used as the section icon. */
const KIND_GLYPH: Record<(typeof READING_KIND_ORDER)[number], string> = {
  short: "短",
  medium: "中",
  long: "長",
  integrated: "統",
  info: "検",
};

function ClockIcon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export default function ReadingIndexPage({ params }: { params: { level: string } }) {
  const p = LevelSchema.safeParse(params.level);
  if (!p.success) notFound();
  const level = p.data;
  const L = LEVEL_LABEL[level];
  const passages = getReading(level);

  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Japanese", path: "/japanese" },
    { name: L, path: `/japanese/${level}` },
    { name: "Reading" },
  ];

  const kindsPresent = READING_KIND_ORDER.filter((kind) => passages.some((r) => r.kind === kind));

  return (
    <Container>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd(crumbs.map((c) => ({ name: c.name, path: c.path ?? `/japanese/${level}/reading` })))) }} />
      <Breadcrumbs items={crumbs} />
      <PageTitle
        eyebrow={`${L} · 読解`}
        title={`${L} Reading Practice`}
        description="Timed passages in the JLPT format. Each one comes with strategy notes, a vocabulary list, and questions whose answers are explained in full."
      />

      <div className="animate-rise-2">
        <Callout
          tone="accent"
          title="How to use these passages"
          icon={
            <svg className="h-5 w-5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z" />
            </svg>
          }
        >
          Read the strategy notes first, start the timer, read the passage once for the main idea, then answer. After checking, re-read the parts you missed and note why the distractors were wrong.
        </Callout>
      </div>

      {kindsPresent.length > 1 && (
        <nav aria-label="Passage types" className="mt-6 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto no-scrollbar">
          <ul className="flex gap-2 w-max">
            {kindsPresent.map((kind) => {
              const k = READING_KIND_LABEL[kind];
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

      {passages.length === 0 ? (
        <div className="mt-8">
          <EmptyState title={`Passages for ${L} are on the way.`} action={<Button href={`/japanese/${level}/grammar`} variant="secondary">Continue with {L} grammar</Button>}>
            In the meantime, read the{" "}
            <Link href="/jlpt/strategy" className="text-accent underline">JLPT reading strategy guides</Link>.
          </EmptyState>
        </div>
      ) : (
        READING_KIND_ORDER.map((kind) => {
          const items = passages.filter((r) => r.kind === kind);
          if (items.length === 0) return null;
          const k = READING_KIND_LABEL[kind];
          return (
            <section key={kind} id={`kind-${kind}`} className="mt-12 scroll-mt-24" aria-labelledby={`kind-${kind}-title`}>
              <div className="flex items-start gap-3.5 mb-4">
                <span aria-hidden className="ja shrink-0 h-11 w-11 rounded-2xl bg-accent-soft text-accent-ink grid place-items-center text-lg font-semibold">
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
                {items.map((r) => (
                  <li key={r.id}>
                    <Link href={`/japanese/${level}/reading/${r.slug}`} className="group block h-full surface surface-hover rounded-2xl p-5 focus-visible:outline-none focus-visible:shadow-ring">
                      <div className="flex flex-wrap items-center gap-1.5 mb-3">
                        <Badge tone="accent">{L}</Badge>
                        <Badge>
                          <ClockIcon />
                          {fmtMinutes(r.timeLimitSeconds)}
                        </Badge>
                        <Badge>{r.questionIds.length} {r.questionIds.length === 1 ? "question" : "questions"}</Badge>
                      </div>
                      <p lang="ja" className="ja font-semibold text-lg leading-snug text-ink">{r.title}</p>
                      <div className="mt-3 flex items-center justify-between text-xs text-muted">
                        <span className="tabular-nums">{r.paragraphs.join("").length.toLocaleString()} characters</span>
                        <span className="inline-flex items-center gap-1 text-accent opacity-0 -translate-x-1 transition group-hover:opacity-100 group-hover:translate-x-0 group-focus-visible:opacity-100">
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
        <Button href={`/japanese/${level}/listening`} variant="secondary" size="sm">{L} listening</Button>
        <Button href="/jlpt/strategy" variant="secondary" size="sm">Reading strategy guides</Button>
        <Button href={`/japanese/${level}`} variant="ghost" size="sm">{L} hub <Arrow /></Button>
      </nav>
    </Container>
  );
}
