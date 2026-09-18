import Link from "next/link";
import { Arrow, Badge, Breadcrumbs, Button, Callout, Container } from "@/components/ui";
import { contentStats } from "@/lib/content";
import { LEVELS } from "@/lib/content/schemas";
import { LEVEL_INFO } from "@/components/content/levels";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/content/JsonLd";
import { FOUNDATION_TOTAL_LABEL } from "@/components/foundation/kinds";

export const metadata = pageMetadata({
  title: "Learn Japanese: Foundation, N5, N4, N3, N2 and N1 courses",
  description:
    "The full learning path from your first kana to JLPT N1: grammar, vocabulary, kanji, reading and listening for every level, with practice questions and tests.",
  path: "/japanese",
});

const ICON = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, className: "h-5 w-5" };

const SKILLS = [
  {
    key: "grammar",
    name: "Grammar",
    ja: "文法",
    text: "Meaning, formation, diagram, examples, mistakes and JLPT tips for every pattern.",
    icon: (
      <svg {...ICON}>
        <rect x="3" y="4" width="7" height="6" rx="1.5" />
        <rect x="14" y="14" width="7" height="6" rx="1.5" />
        <path d="M10 7h4v10" />
      </svg>
    ),
  },
  {
    key: "vocabulary",
    name: "Vocabulary",
    ja: "語彙",
    text: "Words in context with collocations, related words and memory tips.",
    icon: (
      <svg {...ICON}>
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
        <path d="M4 20.5V5.5M8 7h8M8 11h6" />
      </svg>
    ),
  },
  {
    key: "kanji",
    name: "Kanji",
    ja: "漢字",
    text: "Readings, common words, look-alike kanji and example sentences.",
    icon: (
      <svg {...ICON}>
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="M8 9h8M12 9v7M9 16h6" />
      </svg>
    ),
  },
  {
    key: "reading",
    name: "Reading",
    ja: "読解",
    text: "Short to long passages with strategy notes and timed questions.",
    icon: (
      <svg {...ICON}>
        <path d="M5 4h14v16H5z" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </svg>
    ),
  },
  {
    key: "listening",
    name: "Listening",
    ja: "聴解",
    text: "Scripted conversations with audio, vocabulary and comprehension questions.",
    icon: (
      <svg {...ICON}>
        <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
        <rect x="3" y="14" width="5" height="6" rx="1.5" />
        <rect x="16" y="14" width="5" height="6" rx="1.5" />
      </svg>
    ),
  },
] as const;

export default function JapaneseIndexPage() {
  const stats = contentStats();
  return (
    <Container wide>
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Japanese", path: "/japanese" }])} />
      <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Japanese" }]} />

      {/* Hero */}
      <header className="pt-10 pb-10 sm:pt-14 sm:pb-12 animate-rise">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent" size="md">
            N5 → N1
          </Badge>
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Learning path</span>
        </div>
        <h1 className="mt-4 text-display max-w-3xl">
          From zero to <span className="text-gradient">N1</span>, in order.
        </h1>
        <p className="mt-5 text-lg text-ink-2 leading-relaxed max-w-2xl">
          Five levels plus Foundation, each with grammar, vocabulary, kanji, reading and listening. Work through them in order, or jump to the level you are preparing for.
        </p>
      </header>

      {/* Progression rail */}
      <nav aria-label="Levels" className="surface rounded-2xl p-2 sm:p-3">
        <ol className="flex flex-wrap items-stretch gap-x-1 gap-y-1">
          <li className="flex items-center">
            <Link href="/japanese/foundation" className="flex items-center gap-3 rounded-xl px-3 py-2 sm:px-4 hover:bg-surface-2 transition">
              <span lang="ja" className="ja grid h-9 w-9 place-items-center rounded-full bg-accent-soft border border-accent/20 text-sm font-semibold text-accent-ink">
                かな
              </span>
              <span className="text-sm">
                <span className="block font-medium">Foundation</span>
                <span className="block text-xs text-muted">Start here</span>
              </span>
            </Link>
            <Arrow className="mx-1 text-line-strong shrink-0" />
          </li>
          {LEVELS.map((level, i) => {
            const info = LEVEL_INFO[level];
            return (
              <li key={level} className="flex items-center">
                <Link href={`/japanese/${level}`} className="flex items-center gap-3 rounded-xl px-3 py-2 sm:px-4 hover:bg-surface-2 transition">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-surface-2 border border-line text-sm font-semibold">{info.label}</span>
                  <span className="text-sm">
                    <span className="block font-medium">{info.name}</span>
                    <span className="block text-xs text-muted">Step {i + 1} of {LEVELS.length}</span>
                  </span>
                </Link>
                {i < LEVELS.length - 1 && <Arrow className="mx-1 text-line-strong shrink-0" />}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Level cards */}
      <ol className="mt-8 grid gap-4 md:grid-cols-2">
        <li className="rounded-2xl border border-accent/20 bg-accent-soft p-6 sm:p-7 flex flex-col md:col-span-2 md:flex-row md:items-center md:gap-8">
          <div className="flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p lang="ja" className="ja text-4xl font-bold tracking-tight text-accent">
                  かな
                </p>
                <h2 className="text-h2 mt-1">
                  <Link href="/japanese/foundation" className="hover:text-accent transition">
                    Foundation — start here
                  </Link>
                </h2>
              </div>
              <Badge tone="accent">Start</Badge>
            </div>
            <p className="mt-3 text-ink-2 leading-relaxed">
              Hiragana and katakana with sound, pronunciation, numbers, dates and greetings. Do this first if you cannot yet read kana.
            </p>
            <p className="mt-2 text-sm text-muted">{FOUNDATION_TOTAL_LABEL}</p>
          </div>
          <Link href="/japanese/foundation" className="mt-5 md:mt-0 inline-flex items-center gap-1.5 rounded-full px-4 h-10 text-sm font-medium bg-surface border border-line text-accent hover:bg-surface-2 transition shrink-0">
            Open Foundation <Arrow className="h-3.5 w-3.5" />
          </Link>
        </li>
        {LEVELS.map((level, i) => {
          const info = LEVEL_INFO[level];
          const s = stats.per.find((p) => p.level === level)!;
          const counts = [
            { k: "Grammar", v: s.grammar },
            { k: "Words", v: s.vocabulary },
            { k: "Kanji", v: s.kanji },
            ...(s.reading > 0 ? [{ k: "Reading", v: s.reading }] : []),
            ...(s.listening > 0 ? [{ k: "Listening", v: s.listening }] : []),
          ];
          return (
            <li key={level} className="surface surface-hover rounded-2xl p-6 sm:p-7 flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`text-4xl font-bold tracking-tight ${level === "n2" ? "text-accent" : ""}`}>{info.label}</p>
                  <h2 className="text-h2 mt-1">
                    <Link href={`/japanese/${level}`} className="hover:text-accent transition">
                      {info.name}
                    </Link>
                  </h2>
                </div>
                <Badge>Step {i + 1} of {LEVELS.length}</Badge>
              </div>
              <p className="mt-3 text-muted leading-relaxed flex-1">{info.description}</p>
              <dl className="mt-5 grid grid-cols-3 sm:grid-cols-5 gap-3 border-t border-line pt-4">
                {counts.map((c) => (
                  <div key={c.k}>
                    <dd className="font-semibold tabular-nums">{c.v.toLocaleString()}</dd>
                    <dt className="text-xs text-muted">{c.k}</dt>
                  </div>
                ))}
              </dl>
              <nav aria-label={`${info.label} sections`} className="mt-5 flex flex-wrap gap-2">
                {SKILLS.map((sk) => (
                  <Link key={sk.key} href={`/japanese/${level}/${sk.key}`} className="inline-flex items-center rounded-full border border-line bg-surface px-3 h-8 text-sm text-ink-2 hover:border-line-strong hover:bg-surface-2 transition">
                    {sk.name}
                  </Link>
                ))}
                <Link href={`/japanese/${level}`} className="inline-flex items-center gap-1.5 rounded-full px-3 h-8 text-sm font-medium text-accent hover:bg-accent-soft transition">
                  Open {info.label} <Arrow className="h-3.5 w-3.5" />
                </Link>
              </nav>
            </li>
          );
        })}
      </ol>

      {/* Skills */}
      <section className="mt-16" aria-labelledby="skills">
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted mb-2">Five skills</p>
        <h2 id="skills" className="text-h1">
          What each lesson gives you
        </h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SKILLS.map((sk) => (
            <li key={sk.key} className="surface rounded-2xl p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface-2 text-ink-2">{sk.icon}</span>
                <span lang="ja" className="ja text-muted">
                  {sk.ja}
                </span>
              </div>
              <h3 className="mt-4 font-semibold">{sk.name}</h3>
              <p className="mt-1.5 text-sm text-muted leading-relaxed">{sk.text}</p>
            </li>
          ))}
          <li className="rounded-2xl border border-accent/20 bg-accent-soft p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface text-accent">
                <svg {...ICON}>
                  <rect x="5" y="4" width="14" height="17" rx="2" />
                  <path d="M9 4V3h6v1M9 11l2 2 4-4" />
                </svg>
              </span>
              <span lang="ja" className="ja text-accent-ink">
                試験
              </span>
            </div>
            <h3 className="mt-4 font-semibold">Tests and mock exams</h3>
            <p className="mt-1.5 text-sm text-ink-2 leading-relaxed">
              {stats.questions.toLocaleString()} JLPT-style questions feed lesson quizzes, weekly tests and full timed mock exams.
            </p>
          </li>
        </ul>
      </section>

      <div className="mt-12 mb-16">
        <Callout tone="info" title="Preparing for the exam?">
          The JLPT guide covers the five levels, the N2 section structure and timing, scoring and test dates.{" "}
          <Link href="/jlpt" className="font-medium text-accent hover:underline">
            Read about the JLPT format and strategy
          </Link>
          .
        </Callout>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button href="/signup">
            Start the 180-day plan <Arrow />
          </Button>
          <Button href="/japanese/n2" variant="secondary">
            Browse N2
          </Button>
        </div>
      </div>
    </Container>
  );
}
