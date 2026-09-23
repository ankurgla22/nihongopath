import { jsonLdString } from "@/components/content/JsonLd";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getQuestions } from "@/lib/content";
import { LEVELS, LEVEL_LABEL, LevelSchema, type Question } from "@/lib/content/schemas";
import { pageMetadata, breadcrumbJsonLd } from "@/lib/seo/metadata";
import { Arrow, Badge, Breadcrumbs, Button, Container, EmptyState, PageTitle, Section } from "@/components/ui";
import { LessonQuiz } from "@/components/quiz/LessonQuiz";

export function generateStaticParams() {
  return LEVELS.map((level) => ({ level }));
}

export function generateMetadata({ params }: { params: { level: string } }): Metadata {
  const p = LevelSchema.safeParse(params.level);
  if (!p.success) return {};
  const L = LEVEL_LABEL[p.data];
  return pageMetadata({
    title: `${L} Tests and Quizzes`,
    description: `How daily quizzes, weekly tests and phase tests work for JLPT ${L}, plus a free 10-question sample quiz with explanations.`,
    path: `/japanese/${p.data}/tests`,
  });
}

/** Deterministic spread of up to `n` questions across skills, so the static page is stable between builds. */
function sampleQuestions(all: Question[], n: number): Question[] {
  const pool = [...all].sort((a, b) => a.id.localeCompare(b.id));
  if (pool.length <= n) return pool;
  const bySkill = new Map<string, Question[]>();
  for (const q of pool) bySkill.set(q.skill, [...(bySkill.get(q.skill) ?? []), q]);
  const out: Question[] = [];
  const lists = Array.from(bySkill.values());
  let i = 0;
  while (out.length < n) {
    const list = lists[i % lists.length];
    const pick = list.shift();
    if (pick) out.push(pick);
    if (lists.every((l) => l.length === 0)) break;
    i++;
  }
  return out;
}

const ICON = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, className: "h-5 w-5" };

const LAYERS = [
  {
    cadence: "Every day",
    name: "Daily quiz",
    ja: "毎日",
    timing: "5–8 min",
    count: "~10 questions",
    tone: "ok" as const,
    text: "Drawn from that day's grammar, vocabulary and kanji, plus a few review items due from earlier days. Every wrong answer is explained and added to your review queue.",
    icon: (
      <svg {...ICON}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
  {
    cadence: "Every 7 days",
    name: "Weekly test",
    ja: "週末",
    timing: "20–25 min",
    count: "25–30 questions",
    tone: "info" as const,
    text: "Covers the whole week, mixed across skills and in JLPT formats. Scored per skill so you can see whether reading or listening needs more time next week.",
    icon: (
      <svg {...ICON}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </svg>
    ),
  },
  {
    cadence: "End of each phase",
    name: "Phase test",
    ja: "段階",
    timing: "Timed",
    count: "JLPT-style sections",
    tone: "accent" as const,
    text: "A longer test at the end of each of the nine phases of the daily plan. Estimates a scaled score, so you can watch your projected result move toward the pass mark.",
    icon: (
      <svg {...ICON}>
        <path d="M4 20h16M6 16v-5M11 16V7M16 16v-9" />
      </svg>
    ),
  },
];

export default function TestsPage({ params }: { params: { level: string } }) {
  const p = LevelSchema.safeParse(params.level);
  if (!p.success) notFound();
  const level = p.data;
  const L = LEVEL_LABEL[level];
  const levelQuestions = getQuestions().filter((q) => q.level === level);
  const sample = sampleQuestions(levelQuestions, 10);

  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Japanese", path: "/japanese" },
    { name: L, path: `/japanese/${level}` },
    { name: "Tests" },
  ];

  return (
    <Container>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd(crumbs.map((c) => ({ name: c.name, path: c.path ?? `/japanese/${level}/tests` })))) }} />
      <Breadcrumbs items={crumbs} />
      <PageTitle
        eyebrow={`${L} · Practice`}
        title={`${L} tests and quizzes`}
        description="Three layers of testing keep what you learn from fading: a short quiz every day, a weekly test across everything studied that week, and a full-length phase test at the end of each stage of the course."
        actions={
          <Button href="#sample-quiz" variant="secondary" size="sm">
            Try the sample quiz
          </Button>
        }
      />

      <ol className="grid gap-4 sm:grid-cols-3">
        {LAYERS.map((l, i) => (
          <li key={l.name} className="surface surface-hover rounded-2xl p-5 sm:p-6 flex flex-col">
            <div className="flex items-center justify-between">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface-2 text-ink-2">{l.icon}</span>
              <span className="text-xs text-muted tabular-nums">0{i + 1}</span>
            </div>
            <p className="mt-4 text-[11px] uppercase tracking-[0.14em] text-muted">{l.cadence}</p>
            <h2 className="mt-1 text-lg font-semibold">
              {l.name}{" "}
              <span lang="ja" className="ja text-muted font-normal text-base">
                {l.ja}
              </span>
            </h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone={l.tone}>{l.timing}</Badge>
              <Badge>{l.count}</Badge>
            </div>
            <p className="text-sm text-muted mt-3 leading-relaxed flex-1">{l.text}</p>
          </li>
        ))}
      </ol>

      <Section id="how-it-works" title="How results are used" eyebrow="Feedback loop">
        <ul className="surface rounded-2xl divide-y divide-line">
          {[
            "Each question is tagged to the grammar point, word or kanji it tests, so a wrong answer links straight back to the lesson.",
            "Items you miss enter a spaced-repetition review queue and come back after 1, 3, 7 and 14 days until you get them right consistently.",
            "Accuracy per skill feeds your daily plan: weak skills get extra minutes, strong skills get trimmed.",
            "All results are kept in your test history so you can see the trend over the full course.",
          ].map((t, i) => (
            <li key={t} className="flex gap-4 px-5 py-4 text-sm leading-relaxed text-ink-2">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink text-xs font-semibold tabular-nums">{i + 1}</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button href="/daily-study">
            Go to today&apos;s study <Arrow />
          </Button>
          <Button href={`/japanese/${level}/mock-exams`} variant="secondary">
            {L} mock exams
          </Button>
        </div>
        <p className="text-xs text-muted mt-3">Daily study, weekly tests and phase tests require a free account so your progress can be saved.</p>
      </Section>

      <Section id="sample-quiz" title={`Sample ${L} quiz`} eyebrow="Free · no account" intro={sample.length > 0 ? `${sample.length} questions from the ${L} question bank. Nothing is saved.` : undefined}>
        {sample.length === 0 ? (
          <EmptyState
            title={`The ${L} question bank is being written.`}
            action={
              <Button href={`/japanese/${level}/grammar`} variant="secondary" size="sm">
                {L} grammar lessons
              </Button>
            }
          >
            Try the quizzes inside individual{" "}
            <Link href={`/japanese/${level}/grammar`} className="text-accent font-medium hover:underline">
              {L} grammar lessons
            </Link>{" "}
            in the meantime.
          </EmptyState>
        ) : (
          <LessonQuiz questions={sample} title={`${L} sample quiz`} />
        )}
      </Section>
      <div className="mb-16" />
    </Container>
  );
}
