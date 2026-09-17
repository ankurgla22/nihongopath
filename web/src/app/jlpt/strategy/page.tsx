import { jsonLdString } from "@/components/content/JsonLd";
import Link from "next/link";
import type { Metadata } from "next";
import { getStrategy } from "@/lib/content";
import { pageMetadata, breadcrumbJsonLd } from "@/lib/seo/metadata";
import { Arrow, Breadcrumbs, Button, Callout, Container, EmptyState, PageTitle, Stat } from "@/components/ui";

export const metadata: Metadata = pageMetadata({
  title: "JLPT Strategy Guides",
  description:
    "Practical, question-type-specific strategies for the JLPT: vocabulary and grammar questions, reading time management, finding the author's opinion, listening and note-taking, eliminating wrong answers and handling unknown words.",
  path: "/jlpt/strategy",
});

export default function StrategyIndexPage() {
  const articles = getStrategy();
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "JLPT", path: "/jlpt" },
    { name: "Strategy" },
  ];
  return (
    <Container wide>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd(crumbs.map((c) => ({ name: c.name, path: c.path ?? "/jlpt/strategy" })))) }} />
      <Breadcrumbs items={crumbs} />
      <PageTitle
        eyebrow="JLPT · Strategy"
        title="Exam strategy"
        description="The JLPT rewards language ability, but it also rewards knowing the format. These guides explain how each question type works and how to approach it under time pressure."
      />

      <div className="grid gap-10 lg:grid-cols-[14rem_1fr] xl:grid-cols-[16rem_1fr] mb-16">
        <aside className="hidden lg:block">
          <nav aria-label="Guides" className="sticky top-24">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted mb-3">Guides</p>
            <ol className="border-l border-line space-y-0.5">
              {articles.map((a, i) => (
                <li key={a.id}>
                  <a href={`#guide-${i + 1}`} className="block -ml-px border-l-2 border-transparent pl-4 py-1.5 text-sm text-muted hover:text-ink hover:border-line-strong transition">
                    {a.title}
                  </a>
                </li>
              ))}
            </ol>
            <div className="mt-6 grid gap-2">
              <Stat label="Pass mark" value="90" hint="of 180 scaled points" tone="accent" />
              <Stat label="Per section" value="19" hint="minimum of 60" />
            </div>
          </nav>
        </aside>

        <div className="min-w-0 max-w-content">
          <Callout tone="neutral">
            These are factual study and test-taking methods drawn from the published test format. They help you use what you know efficiently; they are not a substitute for learning the language and are not a guarantee of any result.
          </Callout>

          {articles.length === 0 ? (
            <div className="mt-8">
              <EmptyState
                title="Strategy articles are being written."
                action={
                  <Button href="/jlpt" variant="secondary" size="sm">
                    Read the JLPT guide
                  </Button>
                }
              >
                Until then, the JLPT guide covers the test structure, scoring and dates.
              </EmptyState>
            </div>
          ) : (
            <ol className="mt-8 grid gap-4 sm:grid-cols-2">
              {articles.map((a, i) => (
                <li key={a.id} id={`guide-${i + 1}`} className="scroll-mt-24">
                  <Link href={`/jlpt/strategy/${a.slug}`} className="group surface surface-hover rounded-2xl p-5 sm:p-6 flex h-full flex-col">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] uppercase tracking-[0.14em] text-muted">Guide {i + 1}</span>
                      <span className="text-xs text-muted tabular-nums">{a.sections.length} sections</span>
                    </div>
                    <h2 className="mt-3 text-h2 leading-snug group-hover:text-accent transition">{a.title}</h2>
                    <p className="text-sm text-muted mt-2 leading-relaxed flex-1">{a.summary}</p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
                      Read guide <Arrow className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}

          <nav className="mt-12 flex flex-wrap gap-3" aria-label="Related">
            <Button href="/jlpt" variant="secondary">
              About the JLPT
            </Button>
            <Button href="/japanese/n2/reading" variant="secondary">
              N2 reading practice
            </Button>
            <Button href="/japanese/n2/listening" variant="secondary">
              N2 listening practice
            </Button>
          </nav>
        </div>
      </div>
    </Container>
  );
}
