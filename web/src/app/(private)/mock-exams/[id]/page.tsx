import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import { requireUser } from "@/lib/auth/requireUser";
import { findExam, getQuestionMap } from "@/lib/content";
import type { Question } from "@/lib/content/schemas";
import { Container } from "@/components/ui";
import { ExamRunner } from "@/components/exam/ExamRunner";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const exam = findExam(params.id);
  return pageMetadata({
    title: exam ? exam.title : "Mock exam",
    description: exam?.description ?? "Timed JLPT mock exam.",
    path: `/mock-exams/${params.id}`,
    noIndex: true,
  });
}

export default async function MockExamPage({ params }: { params: { id: string } }) {
  await requireUser(`/mock-exams/${params.id}`);
  const exam = findExam(params.id);
  if (!exam) notFound();

  const map = getQuestionMap();
  const questions: Record<string, Question> = {};
  for (const s of exam.sections) {
    for (const qid of s.questionIds) {
      const q = map.get(qid);
      if (q) questions[qid] = q;
    }
  }

  return (
    <Container wide>
      <ExamRunner exam={exam} questions={questions} />
    </Container>
  );
}
