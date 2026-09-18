import { notFound } from "next/navigation";
import { Arrow, Badge, Breadcrumbs, Button, Container, PageTitle } from "@/components/ui";
import { GrammarCards } from "@/components/content/ContentCards";
import { getGrammar } from "@/lib/content";
import { LEVELS, LEVEL_LABEL, type GrammarLesson } from "@/lib/content/schemas";
import { isLevel } from "@/components/content/levels";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/content/JsonLd";

type Params = { level: string };

export function generateStaticParams() {
  return LEVELS.map((level) => ({ level }));
}

export function generateMetadata({ params }: { params: Params }) {
  if (!isLevel(params.level)) return {};
  const label = LEVEL_LABEL[params.level];
  const n = getGrammar(params.level).length;
  return pageMetadata({
    title: `JLPT ${label} grammar list: all ${n} patterns explained`,
    description: `Every JLPT ${label} grammar point with meaning, formation, natural examples, common mistakes and JLPT tips. Study in order or jump to any pattern.`,
    path: `/japanese/${params.level}/grammar`,
  });
}

function groupInTens(items: GrammarLesson[]) {
  const groups: { from: number; to: number; items: GrammarLesson[] }[] = [];
  for (let i = 0; i < items.length; i += 10) {
    const chunk = items.slice(i, i + 10);
    groups.push({ from: i + 1, to: i + chunk.length, items: chunk });
  }
  return groups;
}

export default function GrammarIndexPage({ params }: { params: Params }) {
  if (!isLevel(params.level)) notFound();
  const level = params.level;
  const label = LEVEL_LABEL[level];
  const lessons = getGrammar(level);
  if (lessons.length === 0) notFound();
  const enriched = lessons.filter((g) => g.enriched).length;
  // When every lesson is a full lesson the badge carries no information, so hide it.
  const showFullBadge = enriched > 0 && enriched < lessons.length;
  const base = `/japanese/${level}/grammar`;
  const groups = groupInTens(lessons);
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Japanese", path: "/japanese" },
    { name: label, path: `/japanese/${level}` },
    { name: "Grammar", path: base },
  ];

  return (
    <Container wide>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs.map((c, i) => (i === crumbs.length - 1 ? { name: c.name } : c))} />
      <PageTitle
        eyebrow={`JLPT ${label} · Grammar`}
        title={
          <>
            {label} grammar <span className="text-muted font-normal tabular-nums">· {lessons.length}</span>
          </>
        }
        description={
          <>
            {lessons.length} patterns in study order.{" "}
            {showFullBadge ? (
              <>
                <Badge tone="ok">Full lesson</Badge> marks the {enriched} with a diagram, mistakes, quiz and JLPT tips; the rest have meaning, formation, examples and usage notes.
              </>
            ) : enriched === lessons.length ? (
              "Every lesson has a diagram, examples, common mistakes, a quick check and JLPT tips."
            ) : (
              "Each entry has meaning, formation, natural examples and usage notes."
            )}
          </>
        }
        actions={
          <>
            <Button href={`${base}/${lessons[0].slug}`}>
              Start with lesson 1 <Arrow />
            </Button>
            <Button href={`/japanese/${level}`} variant="secondary">
              {label} overview
            </Button>
          </>
        }
      />

      <div className="lg:grid lg:grid-cols-[6.5rem_1fr] lg:gap-10 mb-20">
        {/* Number rail: sticky on desktop, horizontal chips on mobile */}
        <nav aria-label="Jump to lessons" className="lg:sticky lg:top-24 lg:self-start mb-6 lg:mb-0">
          <p className="hidden lg:block text-[11px] uppercase tracking-[0.14em] text-muted mb-3">Lessons</p>
          <ol className="flex lg:flex-col gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0 pb-1 lg:pb-0">
            {groups.map((g) => (
              <li key={g.from} className="shrink-0">
                <a
                  href={`#g-${g.from}`}
                  className="inline-flex items-center justify-center lg:justify-start lg:w-full rounded-full lg:rounded-lg border border-line bg-surface px-3 h-8 text-xs font-medium tabular-nums text-ink-2 hover:border-accent/50 hover:text-accent hover:bg-accent-soft/40 transition whitespace-nowrap"
                >
                  {g.from}–{g.to}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-12 min-w-0">
          {groups.map((g, gi) => (
            <section key={g.from} id={`g-${g.from}`} aria-labelledby={`h-g-${g.from}`} className="scroll-mt-24">
              <div className="flex items-baseline gap-3 mb-3">
                <h2 id={`h-g-${g.from}`} className="text-h2 tabular-nums">
                  Lessons {g.from}–{g.to}
                </h2>
                <span className="text-xs text-muted">Set {gi + 1} of {groups.length}</span>
              </div>
              <GrammarCards base={base} start={g.from} items={g.items.map((l) => [l.slug, l.order, l.title, l.meaning, showFullBadge && l.enriched])} />
            </section>
          ))}
        </div>
      </div>
    </Container>
  );
}
