import { jsonLdString } from "@/components/content/JsonLd";
import Link from "next/link";
import type { Metadata } from "next";
import { getStrategy } from "@/lib/content";
import { pageMetadata, breadcrumbJsonLd } from "@/lib/seo/metadata";
import { Arrow, Breadcrumbs, Button, Container, EmptyState, PageTitle } from "@/components/ui";

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
    <Container>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd(crumbs.map((c) => ({ name: c.name, path: c.path ?? "/jlpt/strategy" })))) }} />
      <Breadcrumbs items={crumbs} />
      <PageTitle title="Exam strategy" description="How each JLPT question type works and how to approach it under time pressure." />

      <div className="mb-16 max-w-content">
        {articles.length === 0 ? (
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
        ) : (
          <ol className="divide-y divide-line">
            {articles.map((a) => (
              <li key={a.id}>
                <Link href={`/jlpt/strategy/${a.slug}`} className="group flex items-center gap-4 py-4 hover:text-accent transition">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-snug">{a.title}</span>
                    <span className="block text-sm text-muted mt-0.5">{a.summary}</span>
                  </span>
                  <Arrow className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Container>
  );
}
