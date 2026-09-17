import { pageMetadata } from "@/lib/seo/metadata";
import { requireUser } from "@/lib/auth/requireUser";
import { Button, Container, PageTitle } from "@/components/ui";
import { ExamHistoryClient } from "@/components/exam/ExamHistoryClient";

export const metadata = pageMetadata({
  title: "My Exam History",
  description: "Every mock exam you have taken, with scaled scores, time and accuracy.",
  path: "/mock-exams/history",
  noIndex: true,
});

export const dynamic = "force-dynamic";

export default async function ExamHistoryPage() {
  await requireUser("/mock-exams/history");
  return (
    <Container wide>
      <PageTitle
        eyebrow="Mock exams"
        title="My Exam History"
        description="Each attempt with its 180-point scaled score, per-section results, time and accuracy. Open an attempt to review every question."
        actions={
          <Button href="/mock-exams" variant="secondary" size="sm">
            Take a mock exam
          </Button>
        }
      />
      <ExamHistoryClient />
    </Container>
  );
}
