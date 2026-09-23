import Link from "next/link";
import { Arrow, Breadcrumbs, Container, PageTitle, Section } from "@/components/ui";
import { JsonLd } from "@/components/content/JsonLd";
import { UpdatedOn } from "@/components/content/UpdatedOn";
import { contentStats, getCurriculum, getFoundation } from "@/lib/content";
import { LEVELS, LEVEL_LABEL, type Level } from "@/lib/content/schemas";
import { LEVEL_INFO } from "@/components/content/levels";
import { MASTERED_INTERVAL_DAYS, MASTERED_STREAK } from "@/lib/engine/srs";
import { breadcrumbJsonLd, courseId, pageMetadata } from "@/lib/seo/metadata";
import { LAST_MODIFIED, SITE_URL } from "@/lib/seo/site";

export const metadata = pageMetadata({
  title: "Curriculum overview: Foundation to JLPT N1, what you study at each level",
  description:
    "The whole Nihongo Path curriculum on one page: the six levels in order, what each one teaches, what every level contains, how the 270-day plan is built and how spaced review works.",
  path: "/japanese/curriculum",
});

const fmt = (n: number) => n.toLocaleString("en-US");

const SKILLS: { name: string; what: string }[] = [
  { name: "Grammar", what: "One lesson per pattern: meaning, formation, a diagram, natural examples with readings, similar patterns, common mistakes, JLPT tips and a quiz." },
  { name: "Vocabulary", what: "Words in context, with readings, example sentences and collocations, grouped so that a day's words belong together." },
  { name: "Kanji", what: "Readings, common words, look-alike characters and memory aids, grouped by day." },
  { name: "Reading", what: "Short, medium and long passages in the JLPT question formats, with strategy notes, questions and explanations." },
  { name: "Listening", what: "Scripted conversations with a recording, a full transcript, vocabulary, comprehension questions and shadowing practice." },
  { name: "Tests and mock exams", what: "Weekly and phase tests drawn from the question bank, and timed full-length mock exams in the official section structure." },
];

/** Share of study minutes per task type across the whole plan, computed from the plan itself. */
function taskMix(days: ReturnType<typeof getCurriculum>["days"]) {
  const minutes: Record<string, number> = {};
  let total = 0;
  for (const d of days) for (const t of d.tasks) {
    minutes[t.type] = (minutes[t.type] ?? 0) + t.minutes;
    total += t.minutes;
  }
  const label: Record<string, string> = { "weekly-test": "weekly tests", "mock-exam": "mock exams", "phase-test": "phase tests", quiz: "daily quizzes", kana: "kana" };
  return {
    total,
    perDay: Math.round(total / days.length),
    mix: Object.entries(minutes)
      .sort((a, b) => b[1] - a[1])
      .map(([type, m]) => ({ type: label[type] ?? type, pct: Math.round((100 * m) / total) })),
  };
}

export default function CurriculumPage() {
  const stats = contentStats();
  const per = Object.fromEntries(stats.per.map((p) => [p.level, p])) as Record<Level, (typeof stats.per)[number]>;
  const foundation = getFoundation();
  const foundationMinutes = foundation.reduce((n, l) => n + l.minutes, 0);
  const plan = getCurriculum();
  const mix = taskMix(plan.days);

  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Japanese", path: "/japanese" },
    { name: "Curriculum", path: "/japanese/curriculum" },
  ];

  return (
    <Container>
      <JsonLd
        data={[
          breadcrumbJsonLd(crumbs),
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            "@id": `${SITE_URL}/japanese/curriculum`,
            url: `${SITE_URL}/japanese/curriculum`,
            name: "Nihongo Path curriculum overview",
            inLanguage: "en",
            dateModified: LAST_MODIFIED,
            isPartOf: { "@id": `${SITE_URL}/#website` },
            publisher: { "@id": `${SITE_URL}/#organization` },
            // The page describes the ordered course list declared on /japanese.
            mainEntity: { "@id": `${SITE_URL}/japanese#courses` },
            hasPart: ["foundation" as const, ...LEVELS].map((l) => ({ "@type": "Course", "@id": courseId(l) })),
          },
        ]}
      />
      <Breadcrumbs items={crumbs.map((c, i) => (i === crumbs.length - 1 ? { name: c.name } : c))} />
      <PageTitle
        title="The curriculum, on one page"
        description="Six levels in a fixed order, the same five skills at every level, a day-by-day plan that schedules them, and spaced review that decides what comes back. This page explains how the pieces fit."
      />

      <div className="max-w-content">
        <Section id="path" title="The path" intro="Each level assumes the one before it. Start where your current level ends.">
          <ol className="surface rounded-2xl divide-y divide-line">
            <li className="p-5">
              <h3 className="font-semibold">
                <Link href="/japanese/foundation" className="hover:text-accent transition">
                  Foundation
                </Link>{" "}
                <span className="text-muted font-normal">· before N5</span>
              </h3>
              <p className="mt-1 text-sm text-ink-2 leading-relaxed">
                Hiragana, katakana, pronunciation, numbers and counters, dates and time, greetings. {foundation.length} lessons, about {Math.round(foundationMinutes / 60)} hours.
                Do this first if you cannot yet read kana.
              </p>
            </li>
            {LEVELS.map((level) => {
              const info = LEVEL_INFO[level];
              const c = per[level];
              return (
                <li key={level} className="p-5">
                  <h3 className="font-semibold">
                    <Link href={`/japanese/${level}`} className="hover:text-accent transition">
                      JLPT {LEVEL_LABEL[level]}: {info.name}
                    </Link>
                  </h3>
                  <p className="mt-1 text-sm text-ink-2 leading-relaxed">{info.tagline}</p>
                  <p className="mt-1 text-sm text-muted">
                    {fmt(c.grammar)} grammar · {fmt(c.vocabulary)} vocabulary · {fmt(c.kanji)} kanji · {fmt(c.reading)} reading · {fmt(c.listening)} listening
                  </p>
                </li>
              );
            })}
          </ol>
        </Section>

        <Section id="levels" title="What you learn at each level">
          <div className="space-y-6">
            {LEVELS.map((level) => {
              const info = LEVEL_INFO[level];
              return (
                <div key={level} className="surface rounded-2xl p-5">
                  <h3 className="font-semibold">
                    {LEVEL_LABEL[level]} <span className="text-muted font-normal">· {info.name}</span>
                  </h3>
                  <p className="mt-2 text-sm text-ink-2 leading-relaxed">{info.description}</p>
                  <ul className="mt-3 space-y-1.5 text-sm text-ink-2">
                    {info.youWillLearn.map((t) => (
                      <li key={t} className="flex gap-3">
                        <span aria-hidden className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-muted leading-relaxed">{info.examNote}</p>
                </div>
              );
            })}
          </div>
        </Section>

        <Section id="skills" title="What every level contains" intro="The same six parts at every level, so the way you study does not change as the material gets harder.">
          <dl className="surface rounded-2xl divide-y divide-line">
            {SKILLS.map((s) => (
              <div key={s.name} className="p-5 sm:grid sm:grid-cols-[10rem_1fr] sm:gap-4">
                <dt className="font-semibold">{s.name}</dt>
                <dd className="mt-1 sm:mt-0 text-sm text-ink-2 leading-relaxed">{s.what}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section
          id="plan"
          title={`The ${plan.days.length}-day plan`}
          intro={`Signing in unlocks a day-by-day plan from kana to N1: ${fmt(plan.days.length)} days in ${plan.phases.length} phases, about ${mix.perDay} minutes a day and ${fmt(Math.round(mix.total / 60))} hours in total. Days 1–180 take you to N2 and days 181–270 to N1. Every day ends with a quiz, every week with a test, every phase with a phase test. It is an intensive schedule: treat it as the order to study in, not a deadline. Most learners repeat phases, and the tracker lets you set your current day at any time.`}
        >
          <div className="overflow-x-auto surface rounded-2xl">
            <table className="w-full text-sm min-w-[32rem]">
              <thead className="text-left text-muted bg-surface-2">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium text-xs uppercase tracking-wider">Phase</th>
                  <th scope="col" className="px-4 py-3 font-medium text-xs uppercase tracking-wider">Days</th>
                  <th scope="col" className="px-4 py-3 font-medium text-xs uppercase tracking-wider">What it covers</th>
                </tr>
              </thead>
              <tbody className="[&>tr:nth-child(even)]:bg-surface-2/50">
                {plan.phases.map((p) => (
                  <tr key={p.id} className="border-t border-line">
                    <td className="px-4 py-3 align-top font-medium whitespace-nowrap">{p.name}</td>
                    <td className="px-4 py-3 align-top whitespace-nowrap tabular-nums">
                      {p.startDay}–{p.endDay}
                    </td>
                    <td className="px-4 py-3 align-top leading-relaxed text-ink-2">{p.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-muted leading-relaxed">
            Study time across the plan: {mix.mix.map((m) => `${m.type} ${m.pct}%`).join(", ")}.
          </p>
        </Section>

        <Section id="review" title="How review works">
          <p className="leading-relaxed text-ink-2">
            Every grammar point, word and kanji you answer in a quiz gets its own review record. Items move up a ladder from new to learning, review, strong and finally
            mastered. A correct answer lengthens the gap before the item comes back; a wrong answer drops it back to learning and brings it back the next day. An item counts
            as mastered once its review gap has grown to {MASTERED_INTERVAL_DAYS} days or more and you have answered it correctly {MASTERED_STREAK} times in a row since your
            last miss. The daily plan reserves time for whatever is due, so review never has to be scheduled by hand.
          </p>
        </Section>

        <Section id="start" title="Where to start">
          <ul className="space-y-2 text-sm">
            {[
              { href: "/japanese/foundation", text: "Cannot read kana yet: Foundation, then N5." },
              { href: "/japanese/n5", text: "Can read kana: start N5 grammar from lesson 1." },
              { href: "/jlpt", text: "Already hold a JLPT level: the next level up, and the JLPT guide for what the test itself requires." },
              { href: "/signup", text: "Want the day-by-day plan: create a free account and it starts at day 1." },
            ].map((it) => (
              <li key={it.href}>
                <Link href={it.href} className="inline-flex items-start gap-2 text-ink-2 hover:text-accent transition">
                  <Arrow className="mt-1 h-3.5 w-3.5 shrink-0 text-accent" />
                  <span>{it.text}</span>
                </Link>
              </li>
            ))}
          </ul>
          <UpdatedOn className="mt-8" />
        </Section>
      </div>
      <div className="h-12" />
    </Container>
  );
}
