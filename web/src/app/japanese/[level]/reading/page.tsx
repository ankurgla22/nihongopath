import { jsonLdString } from "@/components/content/JsonLd";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getReading } from "@/lib/content";
import { LEVELS, LEVEL_LABEL, LevelSchema } from "@/lib/content/schemas";
import { pageMetadata, breadcrumbJsonLd } from "@/lib/seo/metadata";
import { Arrow, Breadcrumbs, Button, Container, EmptyState, PageTitle, Pill } from "@/components/ui";
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
        title={`${L} Reading Practice`}
        actions={
          passages[0] && (
            <Button href={`/japanese/${level}/reading/${passages[0].slug}`}>
              Start with #1 <Arrow />
            </Button>
          )
        }
      />

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
              <h2 id={`kind-${kind}-title`} className="text-h2 mb-3">
                <span lang="ja" className="ja">{k.ja}</span>
                <span className="text-muted font-normal"> · {k.en}</span>
              </h2>
              <ul className="divide-y divide-line">
                {items.map((r) => (
                  <li key={r.id}>
                    <Link href={`/japanese/${level}/reading/${r.slug}`} className="group flex items-center gap-4 py-3.5 hover:text-accent transition focus-visible:outline-none focus-visible:shadow-ring">
                      <span lang="ja" className="ja min-w-0 flex-1 font-medium leading-snug">{r.title}</span>
                      <span className="shrink-0 text-sm tabular-nums text-muted">{fmtMinutes(r.timeLimitSeconds)}</span>
                      <Arrow className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}

      <div className="mb-12" />
    </Container>
  );
}
