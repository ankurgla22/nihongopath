import { NextResponse } from "next/server";
import { findExam, getQuestionMap } from "@/lib/content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/exams/[id]/questions → { examId, questions: Question[] }
 * Content is public curriculum data, so no auth is required. Used by the exam
 * result page to render explanations for a stored result.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const exam = findExam(params.id);
  if (!exam) return NextResponse.json({ error: "not-found", message: "Unknown exam id." }, { status: 404 });
  const map = getQuestionMap();
  const questions = exam.sections.flatMap((s) => s.questionIds.map((qid) => map.get(qid)).filter(Boolean));
  return NextResponse.json(
    { examId: exam.id, questions },
    { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } }
  );
}
