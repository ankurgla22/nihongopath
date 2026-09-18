import Link from "next/link";
import { Arrow, Badge, Breadcrumbs, Button, Callout, Container } from "@/components/ui";
import { getFoundation } from "@/lib/content";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/content/JsonLd";
import { FOUNDATION_KIND } from "@/components/foundation/kinds";

export const metadata = pageMetadata({
  title: "Foundation: hiragana, katakana, pronunciation, numbers and greetings (start here)",
  description:
    "Eight beginner lessons to do before JLPT N5: the hiragana and katakana charts with sound, mora timing and pitch, numbers and counters, dates and time, and 40 essential greetings.",
  path: "/japanese/foundation",
});

export default function FoundationIndexPage() {
  const lessons = getFoundation();
  const minutes = lessons.reduce((n, l) => n + l.minutes, 0);
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Japanese", path: "/japanese" },
    { name: "Foundation", path: "/japanese/foundation" },
  ];

  return (
    <Container wide>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs.map((c, i) => (i === crumbs.length - 1 ? { name: c.name } : c))} />

      {/* Hero */}
      <header className="pt-10 pb-10 sm:pt-14 animate-rise grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent" size="md">
              Start here
            </Badge>
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Before N5</span>
          </div>
          <h1 className="mt-4 text-display max-w-2xl">
            First the <span lang="ja" className="ja text-gradient">かな</span>, then everything else.
          </h1>
          <p className="mt-5 text-lg text-ink-2 leading-relaxed max-w-2xl">
            Every lesson from N5 upward is written in Japanese script. These eight short lessons come first: read both kana scripts, hear how Japanese is timed, count, tell the
            date and time, and greet people. About {Math.round(minutes / 60)} hours in total, then you are ready for N5.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button href={`/japanese/foundation/${lessons[0]?.slug ?? ""}`} size="lg">
              Start lesson 1 <Arrow />
            </Button>
            <Button href="/japanese/n5" size="lg" variant="secondary">
              Skip to N5
            </Button>
          </div>
        </div>
        <div className="relative hidden lg:block min-h-[16rem]" aria-hidden>
          <div className="absolute inset-0 grid-bg" />
          <div className="absolute inset-0 grid grid-cols-3 gap-3 place-items-center">
            {["あ", "カ", "ん", "ッ", "三", "時"].map((k, i) => (
              <span key={k} lang="ja" className={`ja grid place-items-center h-20 w-20 rounded-2xl surface text-4xl font-medium ${i % 2 ? "text-accent rotate-3" : "text-ink-2 -rotate-2"}`}>
                {k}
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* Lesson list */}
      <ol className="grid gap-3 md:grid-cols-2">
        {lessons.map((l, i) => {
          const kind = FOUNDATION_KIND[l.kind];
          return (
            <li key={l.id}>
              <Link href={`/japanese/foundation/${l.slug}`} className="group surface surface-hover rounded-2xl p-5 sm:p-6 flex gap-4 h-full">
                <span className="shrink-0 grid h-11 w-11 place-items-center rounded-xl bg-surface-2 border border-line text-sm font-semibold tabular-nums text-ink-2 group-hover:bg-accent-soft group-hover:text-accent-ink group-hover:border-accent/20 transition">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1 flex flex-col">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={kind.tone}>{kind.label}</Badge>
                    <span className="text-xs text-muted tabular-nums">{l.minutes} min</span>
                  </span>
                  <span className="mt-2 font-semibold text-lg leading-snug group-hover:text-accent transition">{l.title}</span>
                  <span className="mt-1.5 text-sm text-muted leading-relaxed line-clamp-3 flex-1">{l.summary}</span>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
                    Lesson {l.order} of {lessons.length}
                    <Arrow className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>

      <div className="mt-12 mb-16">
        <Callout tone="info" title="How to use these lessons">
          Do them in order. Tap any kana tile to hear it. Finish each lesson with the 20-question check and repeat any lesson you score under 90% on. Sign in to mark lessons
          learned and have them come back for review.{" "}
          <Link href="/japanese/n5" className="font-medium text-accent hover:underline">
            After lesson 8, continue to N5
          </Link>
          .
        </Callout>
      </div>
    </Container>
  );
}
