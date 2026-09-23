import Link from "next/link";
import type { Metadata } from "next";
import { Arrow, Button, Container } from "@/components/ui";
import { getGrammar } from "@/lib/content";
import { LEVELS } from "@/lib/content/schemas";
import { LEVEL_INFO } from "@/components/content/levels";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/seo/site";
import { StickyCta } from "@/components/layout/StickyCta";
import { RedirectIfSignedIn } from "@/components/layout/RedirectIfSignedIn";

export const metadata: Metadata = {
  title: `${SITE_NAME} — Learn Japanese from your first kana to JLPT N1`,
  description:
    "A complete Japanese course and JLPT preparation for every level: grammar, vocabulary, kanji, reading and listening, with practice, tests and spaced review.",
  alternates: { canonical: SITE_URL },
  openGraph: { title: SITE_NAME, description: SITE_TAGLINE, url: SITE_URL, siteName: SITE_NAME, type: "website" },
};

export default function HomePage() {
  // Sample lesson: a beginner-level (N5) full lesson, so first-time visitors see something they can read.
  const n5Grammar = getGrammar("n5");
  const teaser = n5Grammar.find((g) => g.enriched && g.diagram) ?? n5Grammar.find((g) => g.enriched) ?? n5Grammar[0];

  return (
    <>
      <RedirectIfSignedIn />

      {/* ---------- Hero ---------- */}
      <section id="hero">
        <Container className="pt-14 pb-12 sm:pt-20 sm:pb-16">
          <h1 className="animate-rise text-display max-w-2xl">
            Walk the whole road,
            <br />
            <span lang="ja" className="ja text-gradient">
              「日本語の道」
            </span>
            <br />
            one day at a time.
          </h1>
          <p className="animate-rise-2 mt-6 text-lg sm:text-xl text-ink-2 leading-relaxed max-w-xl">
            A complete course from your first kana to N1: learn, practise, test, review — one day at a time.
          </p>
          <div className="animate-rise-3 mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button href="/signup" size="lg">
              Start the daily plan
              <Arrow />
            </Button>
            <Link href="/japanese" className="inline-flex items-center gap-1.5 text-base font-medium text-accent hover:underline">
              Explore the levels <Arrow />
            </Link>
          </div>
        </Container>
      </section>

      {/* ---------- Levels ---------- */}
      <section aria-labelledby="levels" className="border-t border-line">
        <Container className="py-12 sm:py-16">
          <h2 id="levels" className="sr-only">
            Levels
          </h2>
          <ol className="divide-y divide-line">
            <li>
              <Link href="/japanese/foundation" className="group flex items-baseline gap-4 py-4 hover:text-accent transition">
                <span lang="ja" className="ja w-12 shrink-0 text-xl font-semibold text-accent">
                  かな
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">Foundation</span>
                  <span className="block text-sm text-muted">Read kana, count and greet before N5.</span>
                </span>
                <Arrow className="shrink-0 self-center text-muted transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
            {LEVELS.map((level) => {
              const info = LEVEL_INFO[level];
              return (
                <li key={level}>
                  <Link href={`/japanese/${level}`} className="group flex items-baseline gap-4 py-4 hover:text-accent transition">
                    <span className="w-12 shrink-0 text-xl font-semibold">{info.label}</span>
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold">{info.name}</span>
                      <span className="block text-sm text-muted">{info.tagline}</span>
                    </span>
                    <Arrow className="shrink-0 self-center text-muted transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              );
            })}
          </ol>
        </Container>
      </section>

      {/* ---------- Sample lesson ---------- */}
      {teaser && (
        <section aria-labelledby="sample" className="border-t border-line bg-bg-elev">
          <Container className="py-12 sm:py-16">
            <h2 id="sample" className="sr-only">
              Sample lesson
            </h2>
            <Link href={`/japanese/${teaser.level}/grammar/${teaser.slug}`} className="group block surface surface-hover rounded-2xl p-6 sm:p-8">
              <p className="text-sm text-muted">Sample lesson · N5 grammar</p>
              <p lang="ja" className="ja mt-3 text-3xl sm:text-4xl font-semibold tracking-tight">
                {teaser.title}
              </p>
              <p className="mt-1 text-sm text-muted">{teaser.romaji}</p>
              <p className="mt-4 text-ink-2 leading-relaxed">{teaser.meaning}</p>
              <div className="mt-6 rounded-xl bg-surface-2 border border-line p-4">
                <p lang="ja" className="ja text-lg sm:text-xl leading-relaxed">
                  {teaser.examples[0].ja}
                </p>
                <p className="mt-1.5 text-sm text-ink-2">{teaser.examples[0].en}</p>
              </div>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
                Read the full lesson <Arrow className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </Container>
        </section>
      )}

      <StickyCta watchId="hero" />
    </>
  );
}
