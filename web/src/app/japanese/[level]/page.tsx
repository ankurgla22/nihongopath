import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Arrow, Badge, Breadcrumbs, Button, Callout, Container } from "@/components/ui";
import { getGrammar, getKanji, getListening, getReading, getVocabulary } from "@/lib/content";
import { LEVELS, LEVEL_LABEL } from "@/lib/content/schemas";
import { LEVEL_INFO, isLevel } from "@/components/content/levels";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/content/JsonLd";

type Params = { level: string };

export function generateStaticParams() {
  return LEVELS.map((level) => ({ level }));
}

export function generateMetadata({ params }: { params: Params }) {
  if (!isLevel(params.level)) return {};
  const info = LEVEL_INFO[params.level];
  return pageMetadata({
    title: `JLPT ${info.label} course: grammar, vocabulary, kanji, reading and listening`,
    description: `${info.tagline} ${info.description}`,
    path: `/japanese/${params.level}`,
  });
}

const ICON = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, className: "h-5 w-5" };

const ICONS: Record<string, ReactNode> = {
  grammar: (
    <svg {...ICON}>
      <rect x="3" y="4" width="7" height="6" rx="1.5" />
      <rect x="14" y="14" width="7" height="6" rx="1.5" />
      <path d="M10 7h4v10" />
    </svg>
  ),
  vocabulary: (
    <svg {...ICON}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 20.5V5.5M8 7h8M8 11h6" />
    </svg>
  ),
  kanji: (
    <svg {...ICON}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 9h8M12 9v7M9 16h6" />
    </svg>
  ),
  reading: (
    <svg {...ICON}>
      <path d="M5 4h14v16H5z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  ),
  listening: (
    <svg {...ICON}>
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <rect x="3" y="14" width="5" height="6" rx="1.5" />
      <rect x="16" y="14" width="5" height="6" rx="1.5" />
    </svg>
  ),
  tests: (
    <svg {...ICON}>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3h6v1M9 11l2 2 4-4" />
    </svg>
  ),
  "mock-exams": (
    <svg {...ICON}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l3 2M9 2h6" />
    </svg>
  ),
};

export default function LevelHubPage({ params }: { params: Params }) {
  if (!isLevel(params.level)) notFound();
  const level = params.level;
  const info = LEVEL_INFO[level];
  const label = LEVEL_LABEL[level];
  const base = `/japanese/${level}`;

  const grammar = getGrammar(level);
  const vocab = getVocabulary(level);
  const kanji = getKanji(level);
  const reading = getReading(level);
  const listening = getListening(level);
  const enrichedGrammar = grammar.filter((g) => g.enriched).length;

  const sections = [
    { key: "grammar", href: `${base}/grammar`, name: "Grammar", ja: "文法", count: grammar.length, unit: "patterns", text: "Meaning, formation, diagrams, examples, mistakes and JLPT tips.", first: grammar[0] ? `${base}/grammar/${grammar[0].slug}` : undefined },
    { key: "vocabulary", href: `${base}/vocabulary`, name: "Vocabulary", ja: "語彙", count: vocab.length, unit: "words", text: "Words in context with readings, examples and collocations.", first: vocab[0] ? `${base}/vocabulary/${vocab[0].slug}` : undefined },
    { key: "kanji", href: `${base}/kanji`, name: "Kanji", ja: "漢字", count: kanji.length, unit: "characters", text: "Readings, common words, look-alikes and memory aids, grouped by day.", first: kanji[0] ? `${base}/kanji/${kanji[0].slug}` : undefined },
    { key: "reading", href: `${base}/reading`, name: "Reading", ja: "読解", count: reading.length, unit: "passages", text: "Short, medium and long passages with strategy notes and questions.", first: reading[0] ? `${base}/reading/${reading[0].slug}` : undefined },
    { key: "listening", href: `${base}/listening`, name: "Listening", ja: "聴解", count: listening.length, unit: "exercises", text: "Scripted conversations with audio and comprehension questions.", first: listening[0] ? `${base}/listening/${listening[0].slug}` : undefined },
    { key: "tests", href: `${base}/tests`, name: "Tests", ja: "テスト", count: null, unit: "", text: "Weekly and phase tests built from the question bank.", first: undefined },
    { key: "mock-exams", href: `${base}/mock-exams`, name: "Mock exams", ja: "模擬試験", count: null, unit: "", text: "Timed, full-length exams with the real section structure.", first: undefined },
  ];

  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Japanese", path: "/japanese" },
    { name: label, path: base },
  ];

  const idx = LEVELS.indexOf(level);
  const nextLevel = LEVELS[idx + 1];

  return (
    <Container wide>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs.map((c, i) => (i === crumbs.length - 1 ? { name: c.name } : c))} />

      {/* Hero */}
      <header className="pt-10 pb-10 sm:pt-14 animate-rise">
        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="accent" size="md">
                JLPT {label}
              </Badge>
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
                {info.name} · Step {idx + 1} of 4
              </span>
            </div>
            <h1 className="mt-4 text-display">
              <span className="text-gradient">{label}</span>
              <span className="block text-h1 mt-2 font-semibold text-ink-2">{info.tagline}</span>
            </h1>
            <p className="mt-5 text-lg text-ink-2 leading-relaxed max-w-2xl">{info.description}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              {grammar[0] && (
                <Button href={`${base}/grammar/${grammar[0].slug}`}>
                  Start from lesson #1 <Arrow />
                </Button>
              )}
              <Button href="/signup" variant="secondary">
                Get the daily plan
              </Button>
            </div>
          </div>
          <div className="surface rounded-2xl p-5 sm:p-6">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted">What you&rsquo;ll be able to do</p>
            <ul className="mt-3 space-y-2.5">
              {info.youWillLearn.map((t) => (
                <li key={t} className="flex gap-3 text-sm leading-relaxed">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-4 w-4 mt-1 shrink-0 text-ok">
                    <path d="m5 12 4 4L19 6" />
                  </svg>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </header>

      {/* Progression rail */}
      <nav aria-label="Levels" className="surface rounded-2xl p-2 sm:p-3 overflow-x-auto no-scrollbar">
        <ol className="flex min-w-max items-stretch gap-1">
          {LEVELS.map((lv, i) => {
            const li = LEVEL_INFO[lv];
            const current = lv === level;
            return (
              <li key={lv} className="flex items-center">
                <Link href={`/japanese/${lv}`} aria-current={current ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-2 sm:px-4 transition ${current ? "bg-ink text-bg" : "hover:bg-surface-2"}`}>
                  <span className={`grid h-9 w-9 place-items-center rounded-full text-sm font-semibold ${current ? "bg-bg/15 text-bg" : "bg-surface-2 border border-line"}`}>{li.label}</span>
                  <span className="text-sm">
                    <span className="block font-medium">{li.name}</span>
                    <span className={`block text-xs ${current ? "text-bg/70" : "text-muted"}`}>{current ? "You are here" : `Step ${i + 1}`}</span>
                  </span>
                </Link>
                {i < LEVELS.length - 1 && <Arrow className="mx-1 text-line-strong shrink-0" />}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Skills grid */}
      <section aria-labelledby="sections" className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted mb-1">Course content</p>
            <h2 id="sections" className="text-h2">
              Study {label}
            </h2>
          </div>
          {enrichedGrammar > 0 && (
            <p className="text-sm text-muted">
              <Badge tone="ok">Full lesson</Badge> marks {enrichedGrammar} grammar points with diagram, mistakes, quiz and JLPT tips.
            </p>
          )}
        </div>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((s) => (
            <li key={s.href} className="surface surface-hover rounded-2xl p-5 sm:p-6 flex flex-col">
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent-ink">{ICONS[s.key]}</span>
                <span lang="ja" className="ja text-sm text-muted">
                  {s.ja}
                </span>
              </div>
              <h3 className="mt-4 text-lg font-semibold">
                <Link href={s.href} className="hover:text-accent transition">
                  {s.name}
                </Link>
              </h3>
              {s.count !== null && (
                <p className="text-sm text-muted mt-0.5">
                  {s.count > 0 ? (
                    <>
                      <span className="text-ink font-semibold tabular-nums">{s.count.toLocaleString()}</span> {s.unit}
                    </>
                  ) : (
                    "Coming soon"
                  )}
                </p>
              )}
              <p className="mt-2 text-sm text-muted leading-relaxed flex-1">{s.text}</p>
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3 text-sm">
                <Link href={s.href} className="font-medium text-ink-2 hover:text-ink">
                  Browse
                </Link>
                {s.first ? (
                  <Link href={s.first} className="inline-flex items-center gap-1.5 font-medium text-accent hover:underline">
                    Start from #1 <Arrow className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <Link href={s.href} className="inline-flex items-center gap-1.5 font-medium text-accent hover:underline">
                    Open <Arrow className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Exam note + CTA */}
      <div className="mt-12 mb-16 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Callout
          tone="info"
          title={`About the ${label} exam`}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-5 w-5 text-info">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8h.01M11 12h1v4h1" />
            </svg>
          }
        >
          {info.examNote}{" "}
          <Link href="/jlpt" className="font-medium text-accent hover:underline">
            JLPT format and strategy
          </Link>
          .
        </Callout>
        <div className="rounded-2xl border border-accent/20 bg-accent-soft p-5 sm:p-6 flex flex-col">
          <p className="font-semibold">Study with a daily plan</p>
          <p className="mt-1.5 text-sm text-ink-2 leading-relaxed flex-1">Sign in to get a day-by-day plan, track every lesson you finish and review weak items automatically.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button href="/signup" size="sm">
              Create a free account
            </Button>
            {nextLevel && (
              <Button href={`/japanese/${nextLevel}`} size="sm" variant="ghost">
                Next: {LEVEL_LABEL[nextLevel]} <Arrow className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </Container>
  );
}
