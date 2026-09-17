import { Suspense } from "react";
import { pageMetadata } from "@/lib/seo/metadata";
import { requireUser } from "@/lib/auth/requireUser";
import { Breadcrumbs, Container } from "@/components/ui";
import { ExamResultClient } from "@/components/exam/ExamResultClient";
import { LoadingState } from "@/components/progress/shared";

export const metadata = pageMetadata({
  title: "Exam result",
  description: "Review your mock exam: score, explanations and weak areas.",
  path: "/mock-exams/history",
  noIndex: true,
});

export const dynamic = "force-dynamic";

export default async function ExamResultPage({ params }: { params: { id: string } }) {
  await requireUser(`/mock-exams/history/${params.id}`);
  return (
    <Container>
      <Breadcrumbs items={[{ name: "Mock exams", path: "/mock-exams" }, { name: "My Exam History", path: "/mock-exams/history" }, { name: "Result" }]} />
      <Suspense fallback={<LoadingState label="Loading your result…" />}>
        <ExamResultClient resultId={params.id} />
      </Suspense>
    </Container>
  );
}
