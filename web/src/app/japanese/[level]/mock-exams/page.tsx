import { jsonLdString } from "@/components/content/JsonLd";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getExams } from "@/lib/content";
import { LEVELS, LEVEL_LABEL, LevelSchema } from "@/lib/content/schemas";
import { pageMetadata, breadcrumbJsonLd } from "@/lib/seo/metadata";
import { Arrow, Badge, Breadcrumbs, Button, Callout, Container, EmptyState, PageTitle, Section, Stat } from "@/components/ui";

export function generateStaticParams() {
  return LEVELS.map((level) => ({ level }));
}

export function generateMetadata({ params }: { params: { level: string } }): Metadata {
  const p = LevelSchema.safeParse(params.level);
  if (!p.success) return {};
  const L = LEVEL_LABEL[p.data];
  return pageMetadata({
    title: `${L} Mock Exams`,
    description: `Full-length, timed JLPT ${L} mock exams with the real section structure and time limits, scored with a scaled-score estimate and per-section breakdown.`,
    path: `/japanese/${p.data}/mock-exams`,
  });
}

function fmt(s: number) {
  const m = Math.round(s / 60);
  return `${m} min`;
}

const SKILL_LABEL = { language: "Language knowledge", reading: "Reading", listening: "Listening" } as const;
const SKILL_TONE = { language: "accent", reading: "ok", listening: "info" } as const;

function TimerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-5 w-5">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l3 2M9 2h6" />
    </svg>
  );
}

export default function MockExamsPage({ params }: { params: { level: string } }) {
  const p = LevelSchema.safeParse(params.level);
  if (!p.success) notFound();
  const level = p.data;
  const L = LEVEL_LABEL[level];
  const exams = getExams().filter((e) => e.level === level);

  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Japanese", path: "/japanese" },
    { name: L, path: `/japanese/${level}` },
    { name: "Mock exams" },
  ];

  return (
    <Container>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd(crumbs.map((c) => ({ name: c.name, path: c.path ?? `/japanese/${level}/mock-exams` })))) }} />
      <Breadcrumbs items={crumbs} />
      <PageTitle
        eyebrow={
          <>
            {L} ·{" "}
            <span lang="ja" className="ja">
              模擬試験
            </span>
          </>
        }
        title={`${L} mock exams`}
        description="Sit the test before the test. Each mock exam follows the official section order and time limits, and reports a per-section score plus an estimated scaled result."
      />

      {level === "n2" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Stat label="Total" value="180" hint="scaled points" />
          <Stat label="Pass mark" value="90" hint="overall" tone="accent" />
          <Stat label="Per section" value="19" hint="minimum of 60" />
          <Stat label="Test time" value="155" hint="minutes" />
        </div>
      )}

      <Callout tone="accent" title="Two ways to take a mock exam" icon={<span className="text-accent"><TimerIcon /></span>}>
        <ul className="space-y-1.5">
          <li>
            <strong className="text-ink">Full mode:</strong> all sections back to back with the real clock, for an honest picture of stamina and timing.
          </li>
          <li>
            <strong className="text-ink">Section mode:</strong> one section at a time, for focused practice on reading or listening.
          </li>
        </ul>
        <p className="mt-2">Taking a mock exam and saving the result requires a free account. Your result appears in your exam history with a per-skill breakdown.</p>
      </Callout>

      {exams.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title={`${L} mock exams are being assembled.`}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button href={`/japanese/${level}/tests`} variant="secondary" size="sm">
                  {L} sample quiz
                </Button>
                <Button href={`/japanese/${level}/reading`} variant="secondary" size="sm">
                  Reading passages
                </Button>
                <Button href={`/japanese/${level}/listening`} variant="secondary" size="sm">
                  Listening exercises
                </Button>
              </div>
            }
          >
            Each mock exam is built from the question bank to mirror the official structure
            {level === "n2" ? ": language knowledge and reading (105 minutes) followed by listening (50 minutes), 180 scaled points with a pass mark of 90 and at least 19 per section" : ""}. While they are being finalised, you can practise with timed reading and listening.
          </EmptyState>
        </div>
      ) : (
        <Section id="exams" title="Available exams" eyebrow={`${exams.length} exam${exams.length === 1 ? "" : "s"}`}>
          <ul className="space-y-4">
            {exams.map((e) => {
              const total = e.sections.reduce((s, x) => s + x.timeLimitSeconds, 0);
              const count = e.sections.reduce((s, x) => s + x.questionIds.length, 0);
              return (
                <li key={e.id} className="surface surface-hover rounded-2xl overflow-hidden">
                  <div className="p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-2">
                          <Badge tone="accent">{L}</Badge>
                          <Badge tone="warn">
                            <TimerIcon /> {fmt(total)}
                          </Badge>
                          <Badge>{count} questions</Badge>
                          <Badge>{e.sections.length} sections</Badge>
                        </div>
                        <h2 className="text-h2">{e.title}</h2>
                        <p className="text-sm text-muted mt-1.5 leading-relaxed max-w-prose">{e.description}</p>
                      </div>
                      <Button href={`/mock-exams/${e.id}`}>
                        Start this exam <Arrow />
                      </Button>
                    </div>
                  </div>
                  <div className="overflow-x-auto border-t border-line">
                    <table className="w-full text-sm min-w-[28rem]">
                      <thead className="text-left text-muted bg-surface-2">
                        <tr>
                          <th scope="col" className="px-5 sm:px-6 py-2.5 font-medium text-xs uppercase tracking-wider">
                            Section
                          </th>
                          <th scope="col" className="px-4 py-2.5 font-medium text-xs uppercase tracking-wider">
                            Skill
                          </th>
                          <th scope="col" className="px-4 py-2.5 font-medium text-xs uppercase tracking-wider text-right">
                            Questions
                          </th>
                          <th scope="col" className="px-5 sm:px-6 py-2.5 font-medium text-xs uppercase tracking-wider text-right">
                            Time
                          </th>
                        </tr>
                      </thead>
                      <tbody className="[&>tr:nth-child(even)]:bg-surface-2/50">
                        {e.sections.map((s) => (
                          <tr key={s.id} className="border-t border-line">
                            <td className="px-5 sm:px-6 py-2.5 font-medium">{s.name}</td>
                            <td className="px-4 py-2.5">
                              <Badge tone={SKILL_TONE[s.skill]}>{SKILL_LABEL[s.skill]}</Badge>
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums">{s.questionIds.length}</td>
                            <td className="px-5 sm:px-6 py-2.5 text-right tabular-nums">{fmt(s.timeLimitSeconds)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      <Section id="tips" title="Getting the most from a mock exam" eyebrow="Before you start">
        <ul className="grid gap-3 sm:grid-cols-2">
          {[
            { t: "One sitting", d: "Take it at the same time of day as the real test, with no dictionary and no pausing." },
            { t: "Review everything", d: "Afterwards, review every wrong answer and every lucky guess: the explanation links back to the lesson to revise." },
            { t: "Watch each section", d: "Compare section scores with the 19-point sectional minimum, not only the total; a weak section fails the exam on its own." },
            {
              t: "Budget your time",
              d: (
                <>
                  Read the{" "}
                  <Link href="/jlpt/strategy/reading-time-management" className="text-accent font-medium hover:underline">
                    time management guide
                  </Link>{" "}
                  before your first attempt and adjust your budget after it.
                </>
              ),
            },
          ].map((x) => (
            <li key={x.t} className="surface rounded-2xl p-5">
              <p className="font-semibold">{x.t}</p>
              <p className="text-sm text-muted mt-1 leading-relaxed">{x.d}</p>
            </li>
          ))}
        </ul>
      </Section>
      <div className="mb-16" />
    </Container>
  );
}
