import Link from "next/link";
import { notFound } from "next/navigation";
import { Arrow, Breadcrumbs, Container, JaText, Section } from "@/components/ui";
import { JsonLd } from "@/components/content/JsonLd";
import { UpdatedOn } from "@/components/content/UpdatedOn";
import { FaqSection } from "@/components/content/FaqSection";
import { comparePairs, findPair, pairFor, pairPath, type ComparePair } from "@/lib/content/compare";
import { LEVEL_LABEL, type GrammarLesson } from "@/lib/content/schemas";
import { decodeSlug, isLevel } from "@/components/content/levels";
import { faqJsonLd, type Faq } from "@/lib/seo/faq";
import { articleJsonLd, asSentence, breadcrumbJsonLd, pageMetadata } from "@/lib/seo/metadata";

type Params = { level: string; a: string; b: string };

export function generateStaticParams() {
  return comparePairs().map((p) => ({ level: p.level, a: p.a.slug, b: p.b.slug }));
}

function load(params: Params) {
  if (!isLevel(params.level)) return undefined;
  return findPair(params.level, decodeSlug(params.a), decodeSlug(params.b));
}

export function generateMetadata({ params }: { params: Params }) {
  const p = load(params);
  if (!p) return {};
  const L = LEVEL_LABEL[p.level];
  return pageMetadata({
    title: `${p.a.title} vs ${p.b.title}: the difference (JLPT ${L} grammar)`,
    description: `${p.a.title} vs ${p.b.title}. ${asSentence(p.abDiff ?? p.baDiff ?? `${p.a.title} means ${p.a.meaning}`)} Meaning, formation and examples of both, side by side.`,
    path: pairPath(p),
  });
}

/** Questions a learner actually types, answered only with the authors' own difference text. */
function faqFor(p: ComparePair): Faq[] {
  const items: Faq[] = [];
  if (p.abDiff) items.push({ q: `What is the difference between ${p.a.title} and ${p.b.title}?`, a: asSentence(p.abDiff) });
  if (p.baDiff) items.push({ q: `When do you use ${p.b.title} instead of ${p.a.title}?`, a: asSentence(p.baDiff) });
  return items;
}

function Side({ g, examples }: { g: GrammarLesson; examples: number }) {
  const L = LEVEL_LABEL[g.level];
  return (
    <div className="surface rounded-2xl p-5 min-w-0">
      <h3 lang="ja" className="ja text-2xl font-semibold tracking-tight">
        {g.title}
      </h3>
      <p className="text-sm text-muted">
        {g.romaji} · JLPT {L}
      </p>
      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="text-[11px] uppercase tracking-[0.14em] text-muted">Meaning</dt>
          <dd className="mt-1 text-ink leading-relaxed">{g.meaning}</dd>
        </div>
        {g.formation.length > 0 && (
          <div>
            <dt className="text-[11px] uppercase tracking-[0.14em] text-muted">Formation</dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">
              {g.formation.map((f) => (
                <code key={f} className="rounded-lg border border-line bg-surface-2 px-2 py-1 text-[13px] not-italic">
                  {f}
                </code>
              ))}
            </dd>
          </div>
        )}
      </dl>
      <ol className="mt-4 space-y-3 border-t border-line pt-4">
        {g.examples.slice(0, examples).map((ex, i) => (
          <li key={i}>
            <JaText ja={ex.ja} reading={ex.reading} en={ex.en} size="base" />
          </li>
        ))}
      </ol>
      <p className="mt-4 text-sm">
        <Link href={`/japanese/${g.level}/grammar/${g.slug}`} className="font-medium text-accent hover:underline">
          Full lesson on {g.title} <Arrow className="inline h-3.5 w-3.5" />
        </Link>
      </p>
    </div>
  );
}

export default function ComparePage({ params }: { params: Params }) {
  const p = load(params);
  if (!p) notFound();
  const L = LEVEL_LABEL[p.level];
  const path = pairPath(p);
  const faq = faqFor(p);
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Japanese", path: "/japanese" },
    { name: L, path: `/japanese/${p.level}` },
    { name: "Grammar", path: `/japanese/${p.level}/grammar` },
    { name: `${p.a.title} vs ${p.b.title}`, path },
  ];

  // Other comparisons that involve either side, so a reader can keep going.
  const related = [p.a, p.b]
    .flatMap((g) => g.similarGrammar.filter((s) => s.id).map((s) => pairFor(g, s.id!)))
    .filter((x): x is ComparePair => Boolean(x) && !(x!.a.id === p.a.id && x!.b.id === p.b.id))
    .filter((x, i, arr) => arr.findIndex((y) => y.a.id === x.a.id && y.b.id === x.b.id) === i)
    .slice(0, 8);

  return (
    <Container>
      <JsonLd
        data={[
          breadcrumbJsonLd(crumbs),
          articleJsonLd({
            level: p.level,
            headline: `${p.a.title} vs ${p.b.title} — JLPT ${L} grammar comparison`,
            description: p.abDiff ?? p.baDiff ?? `${p.a.title} compared with ${p.b.title}`,
            path,
          }),
          ...(faq.length ? [faqJsonLd(path, faq)] : []),
        ]}
      />
      <Breadcrumbs items={crumbs.map((c, i) => (i === crumbs.length - 1 ? { name: c.name } : c))} />

      <article className="pb-8 min-w-0">
        <header className="mt-8 animate-rise">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-accent">JLPT {L} grammar comparison</p>
          <h1 className="mt-2 text-h1">
            <span lang="ja" className="ja">
              {p.a.title}
            </span>{" "}
            <span className="text-muted font-normal">vs</span>{" "}
            <span lang="ja" className="ja">
              {p.b.title}
            </span>
          </h1>
          <UpdatedOn className="mt-4" />
        </header>

        <Section id="difference" title="The difference">
          <div className="surface rounded-2xl divide-y divide-line">
            {p.abDiff && (
              <div className="p-5">
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted">
                  From the <span lang="ja" className="ja normal-case tracking-normal text-ink">{p.a.title}</span> lesson
                </p>
                <p className="mt-2 text-lg leading-relaxed text-ink">
                  <span lang="ja" className="ja font-semibold">
                    {p.b.title}
                  </span>
                  : {p.abDiff}
                </p>
              </div>
            )}
            {p.baDiff && (
              <div className="p-5">
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted">
                  From the <span lang="ja" className="ja normal-case tracking-normal text-ink">{p.b.title}</span> lesson
                </p>
                <p className="mt-2 text-lg leading-relaxed text-ink">
                  <span lang="ja" className="ja font-semibold">
                    {p.a.title}
                  </span>
                  : {p.baDiff}
                </p>
              </div>
            )}
          </div>
        </Section>

        <Section id="side-by-side" title="Side by side">
          <div className="grid gap-4 md:grid-cols-2">
            <Side g={p.a} examples={2} />
            <Side g={p.b} examples={2} />
          </div>
        </Section>

        {faq.length > 0 && <FaqSection items={faq} />}

        {related.length > 0 && (
          <Section id="related" title="Related comparisons">
            <ul className="grid gap-2 sm:grid-cols-2 text-sm">
              {related.map((r) => (
                <li key={`${r.a.id}|${r.b.id}`}>
                  <Link href={pairPath(r)} className="inline-flex items-center gap-2 text-ink-2 hover:text-accent transition">
                    <Arrow className="h-3.5 w-3.5 text-accent" />
                    <span lang="ja" className="ja">
                      {r.a.title}
                    </span>
                    <span className="text-muted">vs</span>
                    <span lang="ja" className="ja">
                      {r.b.title}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </article>
      <div className="h-12" />
    </Container>
  );
}
