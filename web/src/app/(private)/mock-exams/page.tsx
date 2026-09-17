import { pageMetadata } from "@/lib/seo/metadata";
import { requireUser } from "@/lib/auth/requireUser";
import { getExams, getQuestionMap } from "@/lib/content";
import { Arrow, Badge, Button, Card, Container, EmptyState, PageTitle } from "@/components/ui";

export const metadata = pageMetadata({
  title: "Mock Exams",
  description: "Timed JLPT-style mock exams with full exam mode and per-section practice.",
  path: "/mock-exams",
  noIndex: true,
});

export const dynamic = "force-dynamic";

function minutes(s: number) {
  return Math.round(s / 60);
}

export default async function MockExamsPage() {
  await requireUser("/mock-exams");
  const exams = getExams();
  const map = getQuestionMap();

  return (
    <Container wide>
      <PageTitle
        eyebrow="Practice"
        title="Mock exams"
        description="Timed, section-by-section exams that follow the official JLPT structure. Results are scored on the 180-point scale and saved to your history."
        actions={
          <Button href="/mock-exams/history" variant="secondary" size="sm">
            My exam history
          </Button>
        }
      />
      {exams.length === 0 ? (
        <EmptyState title="No exams are available yet">Check back soon — mock exams are added as each level&apos;s question bank fills in.</EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 pb-16 animate-rise">
          {exams.map((e) => {
            const totalSeconds = e.sections.reduce((a, s) => a + s.timeLimitSeconds, 0);
            const totalQuestions = e.sections.reduce((a, s) => a + s.questionIds.filter((id) => map.has(id)).length, 0);
            return (
              <Card as="li" key={e.id} hover padding="p-0" className="flex flex-col overflow-hidden">
                <div className="p-5 sm:p-6 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="accent">{e.level.toUpperCase()}</Badge>
                    <Badge>{minutes(totalSeconds)} min</Badge>
                    <Badge>{totalQuestions} questions</Badge>
                  </div>
                  <h2 className="mt-3 text-h2 ja" lang="ja">
                    {e.title}
                  </h2>
                  <p className="mt-1.5 text-sm text-muted">{e.description}</p>
                </div>
                <ul className="border-t border-line divide-y divide-line text-sm">
                  {e.sections.map((s, i) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 px-5 sm:px-6 py-2">
                      <span className="flex items-center gap-2.5 min-w-0">
                        <span className="inline-grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-2 border border-line text-xs font-semibold tabular-nums">{i + 1}</span>
                        <span lang="ja" className="ja truncate">
                          {s.name}
                        </span>
                      </span>
                      <span className="text-muted whitespace-nowrap tabular-nums text-xs">
                        {s.questionIds.length} q · {minutes(s.timeLimitSeconds)} min
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-line bg-bg-elev px-5 sm:px-6 py-4">
                  <Button href={`/mock-exams/${e.id}`}>
                    Start exam <Arrow />
                  </Button>
                </div>
              </Card>
            );
          })}
        </ul>
      )}
    </Container>
  );
}
