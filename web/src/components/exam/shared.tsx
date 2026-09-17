"use client";
/** Small helpers shared by the exam runner, history and result views. */
import type { Question } from "@/lib/content/schemas";
import type { ExamResultDoc } from "@/lib/firestore/types";
import { PASS_SECTION_MIN, PASS_TOTAL_MIN, TOTAL_SCALED_MAX } from "@/lib/engine/scoring";
import { Badge } from "@/components/ui";

export type ExamAnswerState = { selectedIndex: number | null; seconds: number };
export type StoredExamResult = ExamResultDoc & { offline?: boolean };

export const SESSION_RESULT_PREFIX = "exam-result:";
export const examStateKey = (uid: string, examId: string) => `exam:${uid}:${examId}`;

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function accuracyOf(r: Pick<ExamResultDoc, "sections">): number {
  const total = r.sections.reduce((a, s) => a + s.total, 0);
  const correct = r.sections.reduce((a, s) => a + s.score, 0);
  return total === 0 ? 0 : correct / total;
}

export function PassBadge({ result }: { result: Pick<ExamResultDoc, "passedEstimate" | "totalScaled" | "sections"> }) {
  const weakSection = result.sections.some((s) => s.scaled < PASS_SECTION_MIN);
  if (result.passedEstimate) return <Badge tone="ok">Pass estimate</Badge>;
  if (result.totalScaled >= PASS_TOTAL_MIN && weakSection) return <Badge tone="warn">Section below {PASS_SECTION_MIN}</Badge>;
  return <Badge tone="warn">Below pass line</Badge>;
}

export function saveSessionResult(result: StoredExamResult) {
  try {
    sessionStorage.setItem(SESSION_RESULT_PREFIX + result.id, JSON.stringify(result));
  } catch {
    /* storage unavailable */
  }
}

export function readSessionResult(id: string): StoredExamResult | null {
  try {
    const raw = sessionStorage.getItem(SESSION_RESULT_PREFIX + id);
    return raw ? (JSON.parse(raw) as StoredExamResult) : null;
  } catch {
    return null;
  }
}

/** Render a prompt that may contain newlines and a ★ placeholder. */
export function PromptText({ text, className = "" }: { text: string; className?: string }) {
  const lines = text.split("\n").filter((l, i, arr) => l.trim() !== "" || (i > 0 && i < arr.length - 1));
  return (
    <div className={className}>
      {lines.map((line, i) => (
        <p key={i} lang="ja" className={i === 0 && lines.length > 1 ? "text-sm text-muted mb-2" : "ja text-xl sm:text-2xl leading-relaxed font-medium text-ink"}>
          {line}
        </p>
      ))}
    </div>
  );
}

export function typeLabel(q: Question): string {
  return q.type === "ordering" ? "Sentence order (choose the chunk at ★)" : q.type === "cloze" ? "Fill the blank" : "Multiple choice";
}

export const SCALED_MAX = TOTAL_SCALED_MAX;
