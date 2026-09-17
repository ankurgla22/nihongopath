import { pageMetadata } from "@/lib/seo/metadata";
import { requireUser } from "@/lib/auth/requireUser";
import { Container, PageTitle } from "@/components/ui";
import { TestHistoryClient } from "@/components/progress/TestHistoryClient";

export const metadata = pageMetadata({
  title: "Test history",
  description: "All your quizzes, weekly tests, phase tests and mock exams.",
  path: "/tests/history",
  noIndex: true,
});

export const dynamic = "force-dynamic";

export default async function TestHistoryPage() {
  await requireUser("/tests/history");
  return (
    <Container>
      <PageTitle eyebrow="My learning" title="Test history" description="Every quiz and test you have taken, newest first. Open one to see each question, your answer, the explanation and what to review." />
      <TestHistoryClient />
    </Container>
  );
}
