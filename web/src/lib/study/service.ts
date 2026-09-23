"use client";
/**
 * Study service: the single place where a finished quiz/exam/lesson is turned into
 * persisted learner state. Every private feature (daily study, lesson quiz, review,
 * weekly/phase tests, mock exams) calls these functions so progress, SRS, review
 * queue, streak, daily log and history stay consistent.
 *
 * Reliability: results are written to localStorage FIRST (pending queue) and removed
 * only after Firestore confirms, so a network error never loses a result. Call
 * flushPending(uid) on app load / dashboard mount to retry.
 */
import type { Question } from "@/lib/content/schemas";
import type { Skill } from "@/lib/firestore/types";
import {
  newId,
  todayISO,
  type DailyProgressDoc,
  type ExamResultDoc,
  type ProgressDoc,
  type QuizKind,
  type QuizResultDoc,
  type ReviewItemDoc,
  type StudySessionDoc,
  type UserDoc,
} from "@/lib/firestore/types";
import {
  addExamResult,
  addQuizResult,
  addSession,
  getDaily,
  getProgress,
  getUser,
  listReviewItems,
  removeReviewItems,
  setDaily,
  setProgressBatch,
  setReviewItems,
  updateUser,
} from "@/lib/firestore/repo";
import { scoreQuiz, type SubmittedAnswer } from "@/lib/engine/scoring";
import { applyAnswer, initialProgress, toReviewItem } from "@/lib/engine/srs";
import { applySkillBreakdown, updateStreak, CURRICULUM_DAYS } from "@/lib/engine/progress";

const PENDING_KEY = "nihongo-path:pending";

/** Daily-log / streak inputs replayed by flushPending (optional for entries queued by older builds). */
type PendingLog = { curriculumDay?: number; taskId?: string; breakdown?: QuizResultDoc["skillBreakdown"]; lessonsCompleted?: number };

type Pending =
  | ({ kind: "quiz"; uid: string; result: QuizResultDoc; progress: ProgressDoc[]; reviews: ReviewItemDoc[]; clearReviewIds: string[]; session: StudySessionDoc } & PendingLog)
  | ({ kind: "exam"; uid: string; result: ExamResultDoc; session: StudySessionDoc; reviews?: ReviewItemDoc[] } & PendingLog);

function readPending(): Pending[] {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function writePending(list: Pending[]) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable */
  }
}
function enqueue(p: Pending) {
  writePending([...readPending(), p]);
}
function dequeue(id: string) {
  writePending(readPending().filter((p) => p.result.id !== id));
}

/** Retry any results that failed to reach Firestore earlier. Returns number flushed. */
export async function flushPending(uid: string): Promise<number> {
  const list = readPending().filter((p) => p.uid === uid);
  let n = 0;
  for (const p of list) {
    try {
      if (p.kind === "quiz") {
        await addQuizResult(uid, p.result);
        if (p.progress.length) await setProgressBatch(uid, p.progress);
        if (p.reviews.length) await setReviewItems(uid, p.reviews);
        if (p.clearReviewIds.length) await removeReviewItems(uid, p.clearReviewIds);
        await addSession(uid, p.session);
      } else {
        await addExamResult(uid, p.result);
        await addSession(uid, p.session);
        if (p.reviews?.length) await setReviewItems(uid, p.reviews);
      }
      // Daily log and streak were not written when the result was queued; replay them once, on the
      // date the result was recorded, so the day's minutes/accuracy and the streak are not lost.
      if (p.curriculumDay !== undefined) {
        await logDaily(uid, p.curriculumDay, p.session.minutes, p.breakdown ?? {}, p.taskId, p.session.date);
        await touchUserForStudy(uid, p.session.minutes, p.breakdown ?? {}, p.lessonsCompleted ?? 0, p.session.date);
      }
      dequeue(p.result.id);
      n++;
    } catch {
      /* keep for next time */
    }
  }
  return n;
}

export function contentIdsOf(q: Question): { id: string; type: Skill }[] {
  const out: { id: string; type: Skill }[] = [];
  for (const id of q.tags.grammarIds) out.push({ id, type: "grammar" });
  for (const id of q.tags.vocabIds) out.push({ id, type: "vocabulary" });
  for (const id of q.tags.kanjiIds) out.push({ id, type: "kanji" });
  if (q.tags.readingId) out.push({ id: q.tags.readingId, type: "reading" });
  if (q.tags.listeningId) out.push({ id: q.tags.listeningId, type: "listening" });
  if (q.tags.foundationId) out.push({ id: q.tags.foundationId, type: "kana" });
  return out;
}

async function touchUserForStudy(uid: string, minutes: number, breakdown: QuizResultDoc["skillBreakdown"], lessonsCompleted = 0, date = todayISO()): Promise<UserDoc | null> {
  const user = await getUser(uid);
  if (!user) return null;
  const streak = updateStreak(user, date);
  const patch: Partial<UserDoc> = {
    ...streak,
    totalStudyMinutes: (user.totalStudyMinutes ?? 0) + Math.max(0, Math.round(minutes)),
    totalLessonsCompleted: (user.totalLessonsCompleted ?? 0) + lessonsCompleted,
    skillAccuracy: applySkillBreakdown(user.skillAccuracy ?? {}, breakdown),
  };
  await updateUser(uid, patch);
  return { ...user, ...patch } as UserDoc;
}

async function logDaily(uid: string, curriculumDay: number, minutes: number, breakdown: QuizResultDoc["skillBreakdown"], completedTaskId?: string, date = todayISO()) {
  const existing = (await getDaily(uid, date)) ?? {
    date,
    curriculumDay,
    plannedTasks: [],
    completedTaskIds: [],
    minutes: 0,
    accuracyBySkill: {},
    completed: false,
  };
  const acc = { ...existing.accuracyBySkill };
  for (const [skill, v] of Object.entries(breakdown)) {
    const prev = acc[skill as Skill] ?? { correct: 0, total: 0 };
    acc[skill as Skill] = { correct: prev.correct + (v?.correct ?? 0), total: prev.total + (v?.total ?? 0) };
  }
  const completedTaskIds = completedTaskId && !existing.completedTaskIds.includes(completedTaskId) ? [...existing.completedTaskIds, completedTaskId] : existing.completedTaskIds;
  const planned = existing.plannedTasks.map((t) => t.id);
  const doc: DailyProgressDoc = {
    ...existing,
    curriculumDay: existing.curriculumDay || curriculumDay,
    minutes: existing.minutes + Math.round(minutes),
    accuracyBySkill: acc,
    completedTaskIds,
    completed: planned.length > 0 && planned.every((id) => completedTaskIds.includes(id)),
  };
  await setDaily(uid, doc);
  return doc;
}

export type CompleteQuizInput = {
  uid: string;
  kind: QuizKind;
  title: string;
  questions: Question[];
  answers: SubmittedAnswer[];
  seconds: number;
  curriculumDay: number;
  /** Daily-plan task id to mark complete, if any. */
  taskId?: string;
  /** Content ids that should be marked as completed lessons (e.g. the grammar lesson whose quiz this is). */
  lessonContentIds?: { id: string; type: Skill; level: "foundation" | "n5" | "n4" | "n3" | "n2" | "n1" }[];
};

/**
 * Score → save result → update SRS progress for every tagged content id → update review
 * queue (wrong answers enqueue, correct answers on due items clear) → daily log → streak/accuracy.
 */
export async function completeQuiz(input: CompleteQuizInput): Promise<QuizResultDoc> {
  const { uid, questions, answers } = input;
  const today = todayISO();
  const score = scoreQuiz(questions, answers);
  const result: QuizResultDoc = {
    id: newId(),
    kind: input.kind,
    title: input.title,
    createdAt: new Date().toISOString(),
    date: today,
    questionIds: questions.map((q) => q.id),
    answers: score.answers,
    score: score.score,
    total: score.total,
    accuracy: score.accuracy,
    seconds: Math.round(input.seconds),
    weakContentIds: score.weakContentIds,
    skillBreakdown: score.skillBreakdown,
  };

  // SRS update per content id: one correct/incorrect vote per question that tags it.
  const votes = new Map<string, { type: Skill; level: Question["level"]; correct: number; wrong: number; questionIds: string[] }>();
  const byId = new Map(questions.map((q) => [q.id, q]));
  for (const a of score.answers) {
    const q = byId.get(a.questionId);
    if (!q) continue;
    for (const c of contentIdsOf(q)) {
      const v = votes.get(c.id) ?? { type: c.type, level: q.level, correct: 0, wrong: 0, questionIds: [] };
      if (a.correct) v.correct++;
      else {
        v.wrong++;
        v.questionIds.push(q.id);
      }
      votes.set(c.id, v);
    }
  }
  for (const l of input.lessonContentIds ?? []) {
    if (!votes.has(l.id)) votes.set(l.id, { type: l.type, level: l.level, correct: 0, wrong: 0, questionIds: [] });
  }

  const progress: ProgressDoc[] = [];
  const reviews: ReviewItemDoc[] = [];
  const clearReviewIds: string[] = [];
  const lessonIds = new Set((input.lessonContentIds ?? []).map((l) => l.id));
  // Read every tagged item's progress in parallel (a phase test can touch 100+ ids).
  const existing = await Promise.all([...votes.keys()].map((id) => getProgress(uid, id).catch(() => null)));
  let i = 0;
  for (const [contentId, v] of votes) {
    let p = existing[i++] ?? initialProgress(contentId, v.type, v.level, today);
    if (v.correct + v.wrong > 0) p = applyAnswer(p, v.wrong === 0, today);
    if (lessonIds.has(contentId)) p = { ...p, completed: true };
    progress.push(p);
    if (v.wrong > 0) reviews.push(toReviewItem(p, "wrong-answer", v.questionIds, today));
    else if (v.correct > 0) clearReviewIds.push(contentId);
  }

  const session: StudySessionDoc = {
    id: result.id,
    startedAt: new Date(Date.now() - input.seconds * 1000).toISOString(),
    endedAt: new Date().toISOString(),
    minutes: Math.max(1, Math.round(input.seconds / 60)),
    skill: input.kind === "review" ? "review" : input.kind === "weekly" || input.kind === "phase" ? "test" : (Object.keys(score.skillBreakdown)[0] as Skill) ?? "grammar",
    contentIds: [...votes.keys()],
    date: today,
  };

  enqueue({ kind: "quiz", uid, result, progress, reviews, clearReviewIds, session, curriculumDay: input.curriculumDay, taskId: input.taskId, breakdown: score.skillBreakdown, lessonsCompleted: lessonIds.size });
  try {
    await addQuizResult(uid, result);
    if (progress.length) await setProgressBatch(uid, progress);
    if (reviews.length) await setReviewItems(uid, reviews);
    if (clearReviewIds.length) await removeReviewItems(uid, clearReviewIds).catch(() => {});
    await addSession(uid, session);
    await logDaily(uid, input.curriculumDay, session.minutes, score.skillBreakdown, input.taskId);
    await touchUserForStudy(uid, session.minutes, score.skillBreakdown, lessonIds.size);
    dequeue(result.id);
  } catch (err) {
    // Result is safely queued locally; surface the error so the UI can say "saved offline".
    throw Object.assign(new Error("Result saved locally; sync will retry."), { cause: err, queued: true, result });
  }
  return result;
}

export type CompleteExamInput = {
  uid: string;
  result: Omit<ExamResultDoc, "id" | "createdAt" | "date">;
  curriculumDay: number;
  taskId?: string;
};

export async function completeExam(input: CompleteExamInput): Promise<ExamResultDoc> {
  const today = todayISO();
  const result: ExamResultDoc = { ...input.result, id: newId(), createdAt: new Date().toISOString(), date: today };
  const session: StudySessionDoc = {
    id: result.id,
    startedAt: new Date(Date.now() - result.seconds * 1000).toISOString(),
    endedAt: new Date().toISOString(),
    minutes: Math.max(1, Math.round(result.seconds / 60)),
    skill: "test",
    contentIds: result.weakContentIds,
    date: today,
  };
  const breakdown: QuizResultDoc["skillBreakdown"] = {};
  for (const s of result.sections) {
    const skill: Skill = s.skill === "reading" ? "reading" : s.skill === "listening" ? "listening" : "grammar";
    const prev = breakdown[skill] ?? { correct: 0, total: 0 };
    breakdown[skill] = { correct: prev.correct + s.score, total: prev.total + s.total };
  }
  // Wrong answers go to the review queue.
  const reviews: ReviewItemDoc[] = result.weakContentIds.map((id) => ({
    contentId: id,
    type: id.includes("-grammar-") ? "grammar" : id.includes("-vocab-") ? "vocabulary" : id.includes("-kanji-") ? "kanji" : id.includes("-reading-") ? "reading" : "listening",
    due: today,
    priority: 2,
    source: "wrong-answer",
    addedAt: new Date().toISOString(),
    questionIds: [],
  }));
  enqueue({ kind: "exam", uid: input.uid, result, session, reviews, curriculumDay: input.curriculumDay, taskId: input.taskId, breakdown });
  try {
    await addExamResult(input.uid, result);
    await addSession(input.uid, session);
    if (reviews.length) await setReviewItems(input.uid, reviews);
    await logDaily(input.uid, input.curriculumDay, session.minutes, breakdown, input.taskId);
    await touchUserForStudy(input.uid, session.minutes, breakdown);
    dequeue(result.id);
  } catch (err) {
    throw Object.assign(new Error("Result saved locally; sync will retry."), { cause: err, queued: true, result });
  }
  return result;
}

/** Mark a non-quiz task (reading a lesson, listening block) complete and log minutes. */
export async function completeTask(uid: string, curriculumDay: number, taskId: string, minutes: number, contentIds: { id: string; type: Skill; level: "foundation" | "n5" | "n4" | "n3" | "n2" | "n1" }[]) {
  const today = todayISO();
  const existing = await Promise.all(contentIds.map((c) => getProgress(uid, c.id).catch(() => null)));
  const progress: ProgressDoc[] = contentIds.map((c, i) => {
    const p = existing[i] ?? initialProgress(c.id, c.type, c.level, today);
    return { ...p, completed: true, status: p.status === "new" ? "learning" : p.status, lastReviewed: today };
  });
  if (progress.length) await setProgressBatch(uid, progress);
  await addSession(uid, { id: newId(), startedAt: new Date(Date.now() - minutes * 60000).toISOString(), endedAt: new Date().toISOString(), minutes, skill: contentIds[0]?.type ?? "review", contentIds: contentIds.map((c) => c.id), date: today });
  await logDaily(uid, curriculumDay, minutes, {}, taskId);
  await touchUserForStudy(uid, minutes, {}, contentIds.length);
}

/** Advance the learner to the next curriculum day once today's plan is complete. */
export async function advanceDay(uid: string, fromDay: number) {
  await updateUser(uid, { currentDay: Math.min(CURRICULUM_DAYS, fromDay + 1), currentPhase: phaseOf(fromDay + 1) });
}

/** Phase boundaries as generated by scripts/generate-curriculum.ts (kept in sync with content/curriculum/curriculum.json). */
const PHASE_END_DAYS = [30, 60, 90, 135, 165, 180, 225, 255, 270];
export function phaseOf(day: number): number {
  const i = PHASE_END_DAYS.findIndex((end) => day <= end);
  return i === -1 ? PHASE_END_DAYS.length : i + 1;
}

export async function dueReviews(uid: string) {
  const items = await listReviewItems(uid);
  const today = todayISO();
  return items.filter((i) => i.due <= today).sort((a, b) => b.priority - a.priority || a.due.localeCompare(b.due));
}
