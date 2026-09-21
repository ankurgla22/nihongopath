import { jsonLdString } from "@/components/content/JsonLd";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getListening } from "@/lib/content";
import { LEVELS, LEVEL_LABEL, LevelSchema } from "@/lib/content/schemas";
import { pageMetadata, breadcrumbJsonLd } from "@/lib/seo/metadata";
import { Arrow, Breadcrumbs, Button, Container, EmptyState, PageTitle, Pill } from "@/components/ui";
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
        title={`${L} Listening Practice`}
        actions={
          exercises[0] && (
            <Button href={`/japanese/${level}/listening/${exercises[0].slug}`}>
              Start with #1 <Arrow />
            </Button>
          )
        }
      />

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
              <h2 id={`kind-${kind}-title`} className="text-h2 mb-3">
                <span lang="ja" className="ja">{k.ja}</span>
                <span className="text-muted font-normal"> · {k.en}</span>
              </h2>
              <ul className="divide-y divide-line">
                {items.map((e) => (
                  <li key={e.id}>
                    <Link href={`/japanese/${level}/listening/${e.slug}`} className="group flex items-center gap-4 py-3.5 hover:text-accent transition focus-visible:outline-none focus-visible:shadow-ring">
                      <span className="min-w-0 flex-1">
                        <span lang="ja" className="ja block font-medium leading-snug">{e.title}</span>
                        <span className="block text-sm text-muted truncate">{e.setting}</span>
                      </span>
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
