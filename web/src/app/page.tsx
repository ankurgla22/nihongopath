import Link from "next/link";
import type { Metadata } from "next";
import { Arrow, Badge, Button, Container } from "@/components/ui";
import { contentStats, getGrammar } from "@/lib/content";
import { LEVELS } from "@/lib/content/schemas";
import { LEVEL_INFO } from "@/components/content/levels";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/seo/site";
import { JsonLd } from "@/components/content/JsonLd";
import { FOUNDATION_TOTAL_LABEL } from "@/components/foundation/kinds";
import { StickyCta } from "@/components/layout/StickyCta";

export const metadata: Metadata = {
  title: `${SITE_NAME} — Learn Japanese from your first kana to JLPT N1`,
  description:
    "A complete Japanese course, a daily study system and JLPT exam preparation for every level in one place. Grammar, vocabulary, kanji, reading and listening lessons with practice, tests and spaced review.",
  alternates: { canonical: SITE_URL },
  openGraph: { title: SITE_NAME, description: SITE_TAGLINE, url: SITE_URL, siteName: SITE_NAME, type: "website" },
};

/* ---------- Inline icons (stroke, currentColor) ---------- */

const ICON_PROPS = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

const Icons = {
  book: (
    <svg {...ICON_PROPS} className="h-5 w-5">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 20.5V5.5M8 7h8M8 11h6" />
    </svg>
  ),
  pencil: (
    <svg {...ICON_PROPS} className="h-5 w-5">
      <path d="m4 20 4-1 11-11-3-3L5 16z" />
      <path d="m13 8 3 3" />
    </svg>
  ),
  clipboard: (
    <svg {...ICON_PROPS} className="h-5 w-5">
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3h6v1M9 11l2 2 4-4" />
    </svg>
  ),
  refresh: (
    <svg {...ICON_PROPS} className="h-5 w-5">
      <path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <path d="M20 4v5h-5" />
    </svg>
  ),
  diagram: (
    <svg {...ICON_PROPS} className="h-5 w-5">
      <rect x="3" y="4" width="7" height="6" rx="1.5" />
      <rect x="14" y="14" width="7" height="6" rx="1.5" />
      <path d="M10 7h4v10" />
    </svg>
  ),
  calendar: (
    <svg {...ICON_PROPS} className="h-5 w-5">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4M8 15h3" />
    </svg>
  ),
  timer: (
    <svg {...ICON_PROPS} className="h-5 w-5">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l3 2M9 2h6" />
    </svg>
  ),
  headphones: (
    <svg {...ICON_PROPS} className="h-5 w-5">
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <rect x="3" y="14" width="5" height="6" rx="1.5" />
      <rect x="16" y="14" width="5" height="6" rx="1.5" />
    </svg>
  ),
  chart: (
    <svg {...ICON_PROPS} className="h-5 w-5">
      <path d="M4 20h16M6 16v-5M11 16V7M16 16v-9" />
    </svg>
  ),
};

const STEPS = [
  { name: "Learn", ja: "学ぶ", icon: Icons.book, text: "Every grammar point, word and kanji is explained in plain English with natural examples and a diagram, not a dictionary line." },
  { name: "Practice", ja: "練習", icon: Icons.pencil, text: "Guided questions right inside the lesson, then independent practice so you can use the pattern, not just recognise it." },
  { name: "Test", ja: "試験", icon: Icons.clipboard, text: "Daily quizzes, weekly tests, level tests and timed mock exams built from the same JLPT-style question bank." },
  { name: "Review", ja: "復習", icon: Icons.refresh, text: "Wrong answers and due items come back automatically through spaced repetition until they are strong." },
];

const FEATURES = [
  { icon: Icons.diagram, title: "Full lessons with diagrams", text: "Meaning, formation, a visual diagram, natural examples, look-alike patterns and common mistakes for every grammar point." },
  { icon: Icons.calendar, title: "180-day daily plan", text: "A day-by-day schedule from kana to your target level, rebalanced around the skills you find hardest." },
  { icon: Icons.refresh, title: "Spaced review", text: "Missed items return after 1, 3, 7 and 14 days until they stick, so nothing you learn quietly fades." },
  { icon: Icons.timer, title: "Mock exams with scaled score", text: "Timed, full-length exams in the official section order, reported as an estimated 0–180 scaled score." },
  { icon: Icons.headphones, title: "Listening lab", text: "Scripted conversations with audio, transcripts and the official JLPT listening question types at every level." },
  { icon: Icons.chart, title: "Progress analytics", text: "Accuracy per skill, projected score over time and a clear picture of what to study next." },
];

const FACTS = [
  { value: "180", label: "Total points", hint: "Three sections of 0–60" },
  { value: "80–100", label: "To pass", hint: "N5 needs 80, N1 needs 100" },
  { value: "19", label: "Per section", hint: "Sectional minimum" },
  { value: "Jul · Dec", label: "Test dates", hint: "First Sunday of each" },
];

const KANJI_TILES = ["日", "本", "語", "道", "学", "試"];

export default function HomePage() {
  const stats = contentStats();
  const totals = stats.per.reduce(
    (acc, p) => ({ grammar: acc.grammar + p.grammar, vocabulary: acc.vocabulary + p.vocabulary, kanji: acc.kanji + p.kanji }),
    { grammar: 0, vocabulary: 0, kanji: 0 }
  );
  // Sample lesson: a beginner-level (N5) full lesson, so first-time visitors see something they can read.
  const n5Grammar = getGrammar("n5");
  const teaser = n5Grammar.find((g) => g.enriched && g.diagram) ?? n5Grammar.find((g) => g.enriched) ?? n5Grammar[0];

  const todayItems = [
    { name: "Hiragana", ja: "ひらがな", count: 46, unit: "kana", pct: 100, tone: "ok" as const },
    { name: "Pronunciation", ja: "発音", count: 1, unit: "lesson", pct: 60, tone: "accent" as const },
    { name: "Daily quiz", ja: "小テスト", count: 15, unit: "questions", pct: 0, tone: "neutral" as const },
  ];

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: SITE_NAME,
          url: SITE_URL,
          description: SITE_TAGLINE,
        }}
      />

      {/* ---------- Hero ---------- */}
      <section id="hero" className="relative overflow-hidden">
        <Container wide className="pt-14 pb-16 sm:pt-20 sm:pb-24 lg:pt-24">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
            <div className="max-w-2xl">
              <p className="animate-rise text-xs font-medium uppercase tracking-[0.14em] text-accent">Japanese course · daily study system · JLPT prep for every level</p>
              <h1 className="animate-rise-2 mt-4 text-display">
                Walk the whole road,
                <br />
                <span lang="ja" className="ja text-gradient">
                  「日本語の道」
                </span>
                <br />
                one day at a time.
              </h1>
              <p className="animate-rise-3 mt-6 text-lg sm:text-xl text-ink-2 leading-relaxed max-w-xl">
                A complete course from your first kana to N1, with a daily plan that adapts to your weak points.
                <br className="hidden sm:block" /> Every lesson is written so that difficult Japanese feels simple.
              </p>
              <div className="animate-rise-3 mt-8 flex flex-wrap gap-3">
                <Button href="/signup" size="lg">
                  Start the 180-day plan
                  <Arrow />
                </Button>
                <Button href="/japanese" size="lg" variant="secondary">
                  Explore the levels
                </Button>
              </div>
              <dl className="animate-rise-3 mt-10 flex flex-wrap gap-x-8 gap-y-3">
                {[
                  { k: "Grammar points", v: totals.grammar },
                  { k: "Words", v: totals.vocabulary },
                  { k: "Kanji", v: totals.kanji },
                  { k: "Questions", v: stats.questions },
                ].map((s) => (
                  <div key={s.k}>
                    <dd className="text-2xl font-semibold tabular-nums tracking-tight">{s.v.toLocaleString()}</dd>
                    <dt className="text-xs uppercase tracking-wider text-muted">{s.k}</dt>
                  </div>
                ))}
              </dl>
            </div>

            {/* Decorative panel */}
            <div className="relative animate-rise-3 min-h-[22rem] sm:min-h-[26rem]" aria-hidden>
              <div className="absolute inset-0 grid-bg" />
              {/* floating kanji tiles */}
              {KANJI_TILES.map((k, i) => {
                const pos = [
                  "top-2 left-2 sm:left-6",
                  "top-6 right-4 rotate-6",
                  "bottom-10 left-0 -rotate-6",
                  "bottom-2 right-10",
                  "top-1/2 left-1/2 -translate-x-1/2 -translate-y-[9rem] rotate-3 hidden sm:grid",
                  "bottom-16 right-0 -rotate-3 hidden sm:grid",
                ][i];
                return (
                  <span
                    key={k}
                    lang="ja"
                    className={`ja absolute grid place-items-center h-14 w-14 sm:h-16 sm:w-16 rounded-2xl surface text-2xl sm:text-3xl font-semibold text-ink-2 ${pos}`}
                  >
                    {k}
                  </span>
                );
              })}
              {/* stacked "today's study" cards */}
              <div className="absolute left-1/2 top-1/2 w-[min(100%,20rem)] -translate-x-1/2 -translate-y-1/2">
                <div className="absolute inset-x-6 -top-3 h-full rounded-2xl bg-surface-2 border border-line opacity-70" />
                <div className="absolute inset-x-3 -top-1.5 h-full rounded-2xl bg-surface border border-line opacity-90" />
                <div className="relative surface rounded-2xl p-5 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-muted">Example day</p>
                      <p className="font-semibold mt-0.5">Day 1 · Hiragana</p>
                    </div>
                    <Badge tone="accent">Foundation</Badge>
                  </div>
                  <ul className="mt-4 space-y-3">
                    {todayItems.map((it) => (
                      <li key={it.name}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">
                            {it.name} <span lang="ja" className="ja text-muted font-normal">{it.ja}</span>
                          </span>
                          <span className="text-xs text-muted tabular-nums">
                            {it.count} {it.unit}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-surface-2 border border-line/60 overflow-hidden">
                          <div className={`h-full rounded-full ${it.tone === "ok" ? "bg-ok" : it.tone === "accent" ? "accent-gradient" : "bg-line-strong"}`} style={{ width: `${it.pct}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs text-muted">
                    <span>About 110 min · N5 begins on Day 11</span>
                    <span className="inline-flex items-center gap-1 text-accent font-medium">
                      Continue <Arrow className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ---------- How it works ---------- */}
      <section aria-labelledby="how-it-works" className="border-t border-line">
        <Container wide className="py-16 sm:py-20">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted mb-2">How it works</p>
          <h2 id="how-it-works" className="text-h1">
            Teach first, test second.
          </h2>
          <p className="mt-3 text-muted max-w-prose text-lg">Each day follows the same four-part loop, so you always know what to do next.</p>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.name} className="relative surface rounded-2xl p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent-ink">{s.icon}</span>
                  <span className="text-xs text-muted tabular-nums">0{i + 1}</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold">
                  {s.name}{" "}
                  <span lang="ja" className="ja text-muted font-normal text-base ml-1">
                    {s.ja}
                  </span>
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.text}</p>
                {i < STEPS.length - 1 && (
                  <span aria-hidden className="hidden lg:grid absolute -right-4 top-1/2 -translate-y-1/2 z-10 h-7 w-7 place-items-center rounded-full bg-bg border border-line text-muted">
                    <Arrow className="h-3.5 w-3.5" />
                  </span>
                )}
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* ---------- Level path ---------- */}
      <section aria-labelledby="levels" className="border-t border-line bg-bg-elev">
        <Container wide className="py-16 sm:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted mb-2">The path</p>
              <h2 id="levels" className="text-h1">
                Five levels plus Foundation, one road.
              </h2>
              <p className="mt-3 text-muted max-w-prose text-lg">Start where you are. Every level is free to read; sign in to track progress and follow the daily plan.</p>
            </div>
            <Link href="/japanese" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
              All levels <Arrow />
            </Link>
          </div>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <li className="relative">
              <Link href="/japanese/foundation" className="group surface surface-hover rounded-2xl p-5 sm:p-6 flex h-full flex-col border-accent/25 bg-gradient-to-br from-accent-soft/60 to-surface">
                <div className="flex items-start justify-between">
                  <p lang="ja" className="ja text-4xl font-bold tracking-tight text-accent">
                    かな
                  </p>
                  <span className="text-xs text-accent font-medium">Start here</span>
                </div>
                <p className="mt-2 font-semibold">Foundation</p>
                <p className="mt-1 text-sm text-muted leading-relaxed flex-1">Read kana, count and greet before N5.</p>
                <p className="mt-5 border-t border-line pt-4 text-xs text-muted">{FOUNDATION_TOTAL_LABEL}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
                  Open Foundation
                  <Arrow className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
            {LEVELS.map((level, i) => {
              const info = LEVEL_INFO[level];
              const s = stats.per.find((p) => p.level === level)!;
              const last = i === LEVELS.length - 1;
              return (
                <li key={level} className="relative">
                  <Link href={`/japanese/${level}`} className="group surface surface-hover rounded-2xl p-5 sm:p-6 flex h-full flex-col">
                    <div className="flex items-start justify-between">
                      <p className={`text-4xl font-bold tracking-tight ${last ? "text-accent" : "text-ink"}`}>{info.label}</p>
                      <span className="text-xs text-muted">Step {i + 1}</span>
                    </div>
                    <p className="mt-2 font-semibold">{info.name}</p>
                    <p className="mt-1 text-sm text-muted leading-relaxed flex-1">{info.tagline}</p>
                    <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-line pt-4 text-sm">
                      {[
                        { k: "Grammar", v: s.grammar },
                        { k: "Words", v: s.vocabulary },
                        { k: "Kanji", v: s.kanji },
                      ].map((x) => (
                        <div key={x.k}>
                          <dd className="font-semibold tabular-nums">{x.v.toLocaleString()}</dd>
                          <dt className="text-xs text-muted">{x.k}</dt>
                        </div>
                      ))}
                    </dl>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
                      Open {info.label}
                      <Arrow className="transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </Container>
      </section>

      {/* ---------- What you get ---------- */}
      <section aria-labelledby="features" className="border-t border-line">
        <Container wide className="py-16 sm:py-20">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted mb-2">What you get</p>
          <h2 id="features" className="text-h1">
            Everything between day one and the exam room.
          </h2>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <li key={f.title} className="surface surface-hover rounded-2xl p-5 sm:p-6">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface-2 text-ink-2">{f.icon}</span>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted leading-relaxed">{f.text}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* ---------- Sample lesson ---------- */}
      {teaser && (
        <section aria-labelledby="sample" className="border-t border-line bg-bg-elev">
          <Container wide className="py-16 sm:py-20 grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted mb-2">Sample lesson</p>
              <h2 id="sample" className="text-h1">
                See how a lesson reads.
              </h2>
              <p className="mt-3 text-muted text-lg max-w-prose leading-relaxed">
                Every grammar point opens with the meaning in one line, then a diagram, natural examples, the patterns it is confused with and the mistakes learners actually make.
              </p>
              <div className="mt-6">
                <Button href={`/japanese/${teaser.level}/grammar/${teaser.slug}`} variant="outline">
                  Open this lesson <Arrow />
                </Button>
              </div>
            </div>
            <Link href={`/japanese/${teaser.level}/grammar/${teaser.slug}`} className="group block surface surface-hover rounded-2xl p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="accent">{teaser.level.toUpperCase()}</Badge>
                <Badge>Grammar</Badge>
                {teaser.enriched && <Badge tone="ok">Full lesson</Badge>}
              </div>
              <p lang="ja" className="ja mt-5 text-3xl sm:text-4xl font-semibold tracking-tight">
                {teaser.title}
              </p>
              <p className="mt-1 text-sm text-muted">{teaser.romaji}</p>
              <p className="mt-4 text-ink-2 leading-relaxed">{teaser.meaning}</p>
              <div className="mt-6 rounded-xl bg-surface-2 border border-line p-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted mb-2">Example</p>
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

      {/* ---------- JLPT facts ---------- */}
      <section aria-labelledby="facts" className="border-t border-line">
        <Container wide className="py-16 sm:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted mb-2">
                <span lang="ja" className="ja">
                  日本語能力試験
                </span>{" "}
                · JLPT N5 to N1
              </p>
              <h2 id="facts" className="text-h1">
                Built around the real exam.
              </h2>
              <p className="mt-3 text-muted max-w-prose text-lg">Our mock exams use the same section structure, timing and scaled scoring, so nothing on test day is a surprise.</p>
            </div>
            <Link href="/jlpt" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
              About the JLPT <Arrow />
            </Link>
          </div>
          <dl className="mt-10 grid gap-4 grid-cols-2 lg:grid-cols-4">
            {FACTS.map((f) => (
              <div key={f.label} className="surface rounded-2xl p-5">
                <dd className="text-3xl sm:text-4xl font-semibold tabular-nums tracking-tight text-accent">{f.value}</dd>
                <dt className="mt-1.5 font-medium">{f.label}</dt>
                <p className="text-xs text-muted mt-0.5">{f.hint}</p>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      <StickyCta watchId="hero" />

      {/* ---------- Final CTA ---------- */}
      <section className="border-t border-line">
        <Container wide className="py-12 sm:py-16">
          <div className="relative overflow-hidden accent-gradient rounded-2xl px-6 py-12 sm:px-12 sm:py-16 text-center text-white shadow-lg">
            <span aria-hidden lang="ja" className="ja absolute -right-4 -bottom-8 text-[10rem] leading-none font-bold text-white/10 select-none">
              道
            </span>
            <div className="relative">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/80">Ready for day one?</p>
              <h2 className="mt-3 text-h1 text-white">Start your 180 days today.</h2>
              <p className="mt-3 text-white/85 max-w-prose mx-auto">Create a free account to get your daily plan, or start reading any lesson right now.</p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link href="/signup" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ink px-6 text-base font-medium text-bg shadow-md hover:shadow-lg transition active:scale-[0.98]">
                  Create free account <Arrow />
                </Link>
                <Link href="/japanese" className="inline-flex h-12 items-center justify-center rounded-full border border-white/50 px-6 text-base font-medium text-white hover:bg-white/10 transition active:scale-[0.98]">
                  See all levels
                </Link>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
