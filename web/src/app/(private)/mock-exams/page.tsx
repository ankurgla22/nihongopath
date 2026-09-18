import { pageMetadata } from "@/lib/seo/metadata";
import { requireUser } from "@/lib/auth/requireUser";
import { getExams, getQuestionMap } from "@/lib/content";
import { Button, Container, EmptyState, PageTitle } from "@/components/ui";
import { sortExams } from "@/components/exam/examLabels";
import { ExamList, type ExamCard } from "./ExamList";

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
  const map = getQuestionMap();
  const exams: ExamCard[] = sortExams(getExams()).map((e) => ({
    id: e.id,
    level: e.level,
    title: e.title,
    description: e.description,
    minutes: minutes(e.sections.reduce((a, s) => a + s.timeLimitSeconds, 0)),
    questions: e.sections.reduce((a, s) => a + s.questionIds.filter((id) => map.has(id)).length, 0),
    sections: e.sections.map((s) => ({ id: s.id, name: s.name, skill: s.skill, questions: s.questionIds.length, minutes: minutes(s.timeLimitSeconds) })),
  }));

  return (
    <Container wide>
      <PageTitle
        eyebrow="Tests"
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
        <ExamList exams={exams} />
      )}
    </Container>
  );
}
