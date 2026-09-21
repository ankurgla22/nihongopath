import { jsonLdString } from "@/components/content/JsonLd";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getStrategy } from "@/lib/content";
import { pageMetadata, breadcrumbJsonLd, articleJsonLd } from "@/lib/seo/metadata";
import { Arrow, Badge, Breadcrumbs, Button, Container } from "@/components/ui";

export function generateStaticParams() {
  return getStrategy().map((a) => ({ slug: a.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const a = getStrategy().find((x) => x.slug === params.slug);
  if (!a) return {};
  return pageMetadata({ title: `${a.title} – JLPT Strategy`, description: a.summary, path: `/jlpt/strategy/${a.slug}` });
}

function slugify(s: string, i: number) {
  const base = s
    .toLowerCase()
    .replace(/[^a-z0-9぀-ヿ一-龯]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base ? `${base}-${i + 1}` : `section-${i + 1}`;
}

export default function StrategyArticlePage({ params }: { params: { slug: string } }) {
  const all = getStrategy();
  const idx = all.findIndex((x) => x.slug === params.slug);
  const a = all[idx];
  if (!a) notFound();
  const prev = idx > 0 ? all[idx - 1] : undefined;
  const next = idx < all.length - 1 ? all[idx + 1] : undefined;
  const path = `/jlpt/strategy/${a.slug}`;
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "JLPT", path: "/jlpt" },
    { name: "Strategy", path: "/jlpt/strategy" },
    { name: a.title },
  ];
  const ids = a.sections.map((s, i) => slugify(s.heading, i));
  // An in-page rail longer than five items is a second page; drop it then.
  const showToc = a.sections.length <= 5;

  return (
    <Container wide>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString([
            breadcrumbJsonLd(crumbs.map((c) => ({ name: c.name, path: c.path ?? path }))),
            articleJsonLd({ headline: a.title, description: a.summary, path }),
          ]),
        }}
      />
      <Breadcrumbs items={crumbs} />

      <header className="pt-8 pb-8 sm:pt-10 animate-rise max-w-content">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent" size="md">
            JLPT strategy
          </Badge>
          <span className="text-xs text-muted">
            Guide {idx + 1} of {all.length}
          </span>
        </div>
        <h1 className="mt-4 text-h1">{a.title}</h1>
        <p className="mt-4 text-lg text-ink-2 leading-relaxed">{a.summary}</p>
      </header>

      <div className={`mb-16 ${showToc ? "grid gap-10 lg:grid-cols-[14rem_1fr] xl:grid-cols-[16rem_1fr]" : ""}`}>
        {showToc && (
        <aside className="hidden lg:block">
          <nav aria-label="On this page" className="sticky top-24">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted mb-3">On this page</p>
            <ol className="border-l border-line space-y-0.5">
              {a.sections.map((s, i) => (
                <li key={ids[i]}>
                  <a href={`#${ids[i]}`} className="block -ml-px border-l-2 border-transparent pl-4 py-1.5 text-sm text-muted hover:text-ink hover:border-line-strong transition">
                    {s.heading}
                  </a>
                </li>
              ))}
            </ol>
            {next && (
              <div className="mt-6">
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted mb-2">Up next</p>
                <Link href={`/jlpt/strategy/${next.slug}`} className="group block surface surface-hover rounded-2xl p-4 text-sm">
                  <span className="font-medium leading-snug block">{next.title}</span>
                  <span className="mt-2 inline-flex items-center gap-1 text-accent font-medium">
                    Read <Arrow className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </div>
            )}
          </nav>
        </aside>
        )}

        <article className="min-w-0 max-w-content">
          {a.sections.map((s, i) => (
            <section key={ids[i]} id={ids[i]} className={`scroll-mt-24 ${i > 0 ? "mt-10 pt-10 border-t border-line" : ""}`}>
              <h2 className="text-h2 mb-4">
                <span className="text-muted tabular-nums font-normal mr-2">{String(i + 1).padStart(2, "0")}</span>
                {s.heading}
              </h2>
              <div className="prose-lesson text-[17px] text-ink-2 leading-[1.75]">
                {s.paragraphs.map((p, pi) => (
                  <p key={pi}>{p}</p>
                ))}
                {s.bullets.length > 0 && (
                  <ul className="surface rounded-2xl p-5 space-y-2.5 text-base">
                    {s.bullets.map((b, bi) => (
                      <li key={bi} className="flex gap-3 leading-relaxed">
                        <span aria-hidden className="mt-[0.65em] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          ))}

          <p className="mt-12 text-sm text-muted border-t border-line pt-5 leading-relaxed">
            These techniques describe how the test is built and how to use your time and knowledge efficiently. They do not replace study and do not guarantee a particular score.
          </p>

          <nav className="mt-8 grid gap-3 sm:grid-cols-2" aria-label="Article navigation">
            {prev ? (
              <Link href={`/jlpt/strategy/${prev.slug}`} className="group surface surface-hover rounded-2xl p-4">
                <span className="text-[11px] uppercase tracking-[0.14em] text-muted inline-flex items-center gap-1">
                  <Arrow className="h-3 w-3 rotate-180" /> Previous
                </span>
                <span className="block mt-1 font-medium leading-snug group-hover:text-accent transition">{prev.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link href={`/jlpt/strategy/${next.slug}`} className="group surface surface-hover rounded-2xl p-4 sm:text-right">
                <span className="text-[11px] uppercase tracking-[0.14em] text-muted inline-flex items-center gap-1">
                  Next <Arrow className="h-3 w-3" />
                </span>
                <span className="block mt-1 font-medium leading-snug group-hover:text-accent transition">{next.title}</span>
              </Link>
            )}
          </nav>
          <div className="mt-6">
            <Button href="/jlpt/strategy" variant="secondary" size="sm">
              All strategy guides
            </Button>
          </div>
        </article>
      </div>
    </Container>
  );
}
