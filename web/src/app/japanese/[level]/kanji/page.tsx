import { notFound } from "next/navigation";
import { Arrow, Breadcrumbs, Button, Container, PageTitle } from "@/components/ui";
import { getKanji } from "@/lib/content";
import { LEVELS, LEVEL_LABEL, type KanjiItem } from "@/lib/content/schemas";
import { isLevel } from "@/components/content/levels";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/content/JsonLd";
import { KanjiGrid } from "@/components/content/ContentCards";

type Params = { level: string };

export function generateStaticParams() {
  return LEVELS.map((level) => ({ level }));
}

export function generateMetadata({ params }: { params: Params }) {
  if (!isLevel(params.level)) return {};
  const label = LEVEL_LABEL[params.level];
  const n = getKanji(params.level).length;
  return pageMetadata({
    title: `JLPT ${label} kanji list: all ${n} characters in study sets`,
    description: `Every JLPT ${label} kanji with meanings, on and kun readings, common words and example sentences, grouped into study sets.`,
    path: `/japanese/${params.level}/kanji`,
  });
}

function byDay(items: KanjiItem[]) {
  const m = new Map<number, KanjiItem[]>();
  for (const k of items) {
    if (!m.has(k.day)) m.set(k.day, []);
    m.get(k.day)!.push(k);
  }
  return Array.from(m.entries()).sort((a, b) => a[0] - b[0]);
}

export default function KanjiIndexPage({ params }: { params: Params }) {
  if (!isLevel(params.level)) notFound();
  const level = params.level;
  const label = LEVEL_LABEL[level];
  const items = getKanji(level);
  if (items.length === 0) notFound();
  const base = `/japanese/${level}/kanji`;
  const days = byDay(items);
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Japanese", path: "/japanese" },
    { name: label, path: `/japanese/${level}` },
    { name: "Kanji", path: base },
  ];

  return (
    <Container wide>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs.map((c, i) => (i === crumbs.length - 1 ? { name: c.name } : c))} />
      <PageTitle
        title={
          <>
            {label} kanji <span className="text-muted font-normal tabular-nums">· {items.length}</span>
          </>
        }
        actions={
          <Button href={`${base}/${items[0].slug}`}>
            Start with Set 1 <Arrow />
          </Button>
        }
      />

      {/* Day rail */}
      <nav aria-label="Jump to set" className="sticky top-16 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2.5 glass border-b border-line/80 mb-8">
        <ol className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {days.map(([day]) => (
            <li key={day} className="shrink-0">
              <a href={`#set-${day}`} className="inline-flex items-center rounded-full border border-line bg-surface px-3 h-8 text-xs font-medium tabular-nums text-ink-2 hover:border-accent/50 hover:text-accent hover:bg-accent-soft/40 transition">
                Set {day}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="space-y-12 mb-20">
        {days.map(([day, list]) => (
          <section key={day} id={`set-${day}`} aria-labelledby={`h-set-${day}`} className="scroll-mt-32">
            <h2 id={`h-set-${day}`} className="text-h2 mb-4">
              Set {day}
            </h2>
            <KanjiGrid base={base} items={list.map((k) => [k.slug, k.character, k.meanings[0], k.enriched])} />
          </section>
        ))}
      </div>
    </Container>
  );
}
