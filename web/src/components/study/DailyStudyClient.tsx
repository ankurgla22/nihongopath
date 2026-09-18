"use client";
/**
 * Today's study plan. The plan is built with buildDailyPlan() once per day and persisted into
 * dailyProgress.plannedTasks so it stays stable; each task expands into its work and is marked
 * complete through the study service (completeTask / completeQuiz), which also updates SRS,
 * streak and the daily log.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { CurriculumDay, Question, QuestionIndexEntry } from "@/lib/content/schemas";
import { todayISO, type DailyProgressDoc, type ReviewItemDoc, type UserDoc } from "@/lib/firestore/types";
import { getDaily, setDaily, updateUser } from "@/lib/firestore/repo";
import { advanceDay, completeQuiz, completeTask, dueReviews, phaseOf } from "@/lib/study/service";
import { buildDailyPlan, taskTitle, weakSkills, type TaskType } from "@/lib/engine/dailyPlan";
import type { SubmittedAnswer } from "@/lib/engine/scoring";
import { CURRICULUM_DAYS } from "@/lib/engine/progress";
import { fetchDrill, fetchQuestionsByIds } from "@/lib/questions/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useUserDoc } from "@/components/auth/useUserDoc";
import { Arrow, Badge, Button, Callout, Card, PageTitle, ProgressBar, SpeakButton } from "@/components/ui";

import { LoadingState, SkillGlyph } from "@/components/progress/shared";
import { QuizRunner } from "@/components/quiz/QuizRunner";
import {
  JA_RE,
  contentMeta,
  defaultQuestionCount,
  isQueuedError,
  isQuizTask,
  isSkillTask,
  levelForPhase,
  pickWithFallback,
  questionLevelsUpTo,
  quizKindForTask,
  reviewQuestions,
  type ClientTask,
  type ContentLinks,
} from "./helpers";

type Props = {
  day: CurriculumDay;
  phase: { id: number; name: string };
  /** Slim index of the banks this day can draw from; full records are fetched on demand. */
  questionIndex: QuestionIndexEntry[];
  contentLinks: ContentLinks;
  sessionName: string | null;
};

type Notice = { tone: "ok" | "warn" | "accent"; text: string } | null;
type RunState = "loading" | "ready" | "error";

const TASK_HINT: Record<TaskType, string> = {
  kana: "Learn the kana chart row by row: say each sound aloud, trace it, then take the recognition quiz.",
  grammar: "Read each lesson: meaning, formation, examples and common mistakes. Then take the lesson's mini test.",
  vocabulary: "Read each word with its example sentence. Say it aloud once; note any you already know.",
  kanji: "For each kanji: readings, example words, and write it a few times.",
  reading: "Read the passage once without stopping, then answer the questions and check the strategy notes.",
  listening: "Listen first without the script, answer, then read the script and shadow it once.",
  review: "Items due today from your review queue — answering correctly pushes them further out.",
  quiz: "A short check of today's material with instant explanations.",
  "weekly-test": "Covers this week's material. No feedback until the end — like the real exam.",
  "phase-test": "A larger assessment of the whole phase across all five skills.",
  "mock-exam": "A full timed JLPT-style mock exam with scaled scoring.",
};

function fromPlanned(planned: DailyProgressDoc["plannedTasks"], fresh: ClientTask[]): ClientTask[] {
  const byId = new Map(fresh.map((t) => [t.id, t]));
  return planned.map((p) => {
    const f = byId.get(p.id);
    const type = (f?.type ?? p.type) as TaskType;
    return {
      id: p.id,
      type,
      title: f?.title ?? taskTitle(type),
      minutes: p.minutes,
      contentIds: p.contentIds,
      questionCount: f?.questionCount,
      examId: f?.examId,
      boosted: f?.boosted,
    };
  });
}

function Check({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-4 w-4 ${className}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m5 12 5 5L20 7" />
    </svg>
  );
}

function TaskSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="surface rounded-2xl p-4 sm:p-5 flex items-center gap-4">
          <div className="skeleton h-9 w-9 rounded-full shrink-0" />
          <div className="skeleton h-9 w-9 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3.5 w-1/2" />
            <div className="skeleton h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DailyStudyClient({ day, phase, questionIndex, contentLinks, sessionName }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const { userDoc, error: userError, refresh } = useUserDoc();
  const today = todayISO();

  const [daily, setDailyState] = useState<DailyProgressDoc | null>(null);
  const [tasks, setTasks] = useState<ClientTask[]>([]);
  const [due, setDue] = useState<ReviewItemDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runQuestions, setRunQuestions] = useState<Question[]>([]);
  const [runState, setRunState] = useState<RunState>("ready");
  /** True while the running set is a generated vocabulary/kanji drill rather than a bank quiz. */
  const [runIsDrill, setRunIsDrill] = useState(false);
  const runToken = useRef(0);
  const [jumpDay, setJumpDay] = useState(String(day.day));
  const [advancing, setAdvancing] = useState(false);

  // If the server rendered a different day than the learner's current day (no ?day override), go there.
  useEffect(() => {
    if (!userDoc) return;
    const hasParam = new URLSearchParams(window.location.search).has("day");
    if (!hasParam && userDoc.currentDay !== day.day) {
      router.replace(`/daily-study?day=${Math.max(1, Math.min(CURRICULUM_DAYS, userDoc.currentDay))}`);
    }
  }, [userDoc, day.day, router]);

  const load = useCallback(
    async (u: UserDoc) => {
      if (!user) return;
      setLoading(true);
      try {
        const [dueItems, existing] = await Promise.all([dueReviews(user.uid).catch(() => [] as ReviewItemDoc[]), getDaily(user.uid, today)]);
        setDue(dueItems);
        const fresh = buildDailyPlan({ day, user: u, dueReviewCount: dueItems.length, weakSkills: weakSkills(u) }).tasks;
        const freshPlanned = fresh.map((t) => ({ id: t.id, type: t.type, minutes: t.minutes, contentIds: t.contentIds }));
        let doc = existing;
        if (!doc || doc.plannedTasks.length === 0 || doc.curriculumDay !== day.day) {
          const done = new Set(doc?.completedTaskIds ?? []);
          // Same calendar day, new curriculum day (e.g. right after "Advance"): keep the finished tasks of the
          // earlier day in the log so history and the dashboard do not lose them.
          const carried = (doc?.plannedTasks ?? []).filter((t) => done.has(t.id) && !freshPlanned.some((f) => f.id === t.id));
          doc = {
            date: today,
            curriculumDay: day.day,
            plannedTasks: [...carried, ...freshPlanned],
            completedTaskIds: doc?.completedTaskIds ?? [],
            minutes: doc?.minutes ?? 0,
            accuracyBySkill: doc?.accuracyBySkill ?? {},
            completed: false,
          };
          doc.completed = doc.plannedTasks.every((t) => doc!.completedTaskIds.includes(t.id));
          // Only the learner's current day is persisted; a ?day= peek at another day is shown but not saved.
          if (u.currentDay === day.day) {
            try {
              await setDaily(user.uid, doc);
            } catch {
              setNotice({ tone: "warn", text: "Could not save today's plan yet — it will be saved with your first completed task." });
            }
          }
        }
        setDailyState(doc);
        const list = fromPlanned(doc.plannedTasks.filter((t) => t.id.startsWith(`d${day.day}-`)), fresh);
        setTasks(list);
        setOpenId((cur) => cur ?? list.find((t) => !doc!.completedTaskIds.includes(t.id))?.id ?? null);
      } catch (err) {
        setNotice({ tone: "warn", text: err instanceof Error ? err.message : "Could not load today's plan." });
      } finally {
        setLoading(false);
      }
    },
    [user, day, today]
  );

  // Load once per signed-in user; later userDoc refreshes (streak, minutes) must not rebuild the list.
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!userDoc || loadedFor.current === userDoc.uid) return;
    loadedFor.current = userDoc.uid;
    void load(userDoc);
  }, [userDoc, load]);

  const completedIds = useMemo(() => new Set(daily?.completedTaskIds ?? []), [daily]);
  const totalMinutes = tasks.reduce((n, t) => n + t.minutes, 0);
  const doneMinutes = tasks.filter((t) => completedIds.has(t.id)).reduce((n, t) => n + t.minutes, 0);
  const doneCount = tasks.filter((t) => completedIds.has(t.id)).length;
  const allDone = tasks.length > 0 && tasks.every((t) => completedIds.has(t.id));
  const level = levelForPhase(day.phase);

  const refreshDaily = useCallback(async () => {
    if (!user) return;
    try {
      const d = await getDaily(user.uid, today);
      if (d) setDailyState(d);
    } catch {
      /* keep local state */
    }
  }, [user, today]);

  const markLocallyDone = (taskId: string) =>
    setDailyState((d) => (d && !d.completedTaskIds.includes(taskId) ? { ...d, completedTaskIds: [...d.completedTaskIds, taskId] } : d));

  const openNextAfter = (taskId: string) => {
    const idx = tasks.findIndex((t) => t.id === taskId);
    const next = tasks.slice(idx + 1).find((t) => !completedIds.has(t.id) && t.id !== taskId);
    setOpenId(next?.id ?? null);
  };

  const markDone = async (task: ClientTask) => {
    if (!user) return;
    setBusyId(task.id);
    setNotice(null);
    try {
      const ids = task.contentIds
        .map((id) => ({ id, meta: contentMeta(id) }))
        .filter((x) => x.meta)
        .map((x) => ({ id: x.id, type: x.meta!.type, level: x.meta!.level }));
      await completeTask(user.uid, day.day, task.id, task.minutes, ids);
      markLocallyDone(task.id);
      await refreshDaily();
      await refresh();
      setNotice({ tone: "ok", text: `${task.title} marked done — ${task.minutes} min logged.` });
      openNextAfter(task.id);
    } catch (err) {
      setNotice({ tone: "warn", text: isQueuedError(err) ? "Saved offline — will sync." : err instanceof Error ? err.message : "Could not save. Check your connection and try again." });
    } finally {
      setBusyId(null);
    }
  };

  // The seed is deterministic per user/day/task, so a retry (or a resumed session from localStorage)
  // picks the same ids and fetches the same set.
  const startQuiz = async (task: ClientTask) => {
    if (!user) return;
    const count = task.questionCount ?? defaultQuestionCount(task.type);
    const seed = `${user.uid}-${today}-${task.id}`;
    let picked: QuestionIndexEntry[];
    if (task.type === "review") {
      picked = reviewQuestions(questionIndex, due, Math.max(count, Math.min(due.length, 20)), seed);
      if (picked.length === 0) picked = pickWithFallback(questionIndex, { count, levels: questionLevelsUpTo(level), seed });
    } else {
      const levels = questionLevelsUpTo(level);
      const preferContentIds = tasks.flatMap((t) => t.contentIds);
      picked = pickWithFallback(questionIndex, { count, levels, preferContentIds, seed });
    }
    const token = ++runToken.current;
    setRunIsDrill(false);
    setRunQuestions([]);
    setRunState("loading");
    setRunningId(task.id);
    setOpenId(task.id);
    try {
      const full = await fetchQuestionsByIds(picked.map((q) => q.id));
      if (token !== runToken.current) return;
      setRunQuestions(full);
      setRunState("ready");
    } catch {
      if (token !== runToken.current) return;
      setRunState("error");
    }
  };

  // Generated drill over the task's own words/kanji (same seed rule as quizzes, so a retry rebuilds
  // the same set). Finishing updates SRS per item but does not mark the task done.
  const startDrill = async (task: ClientTask) => {
    if (!user) return;
    const seed = `${user.uid}-${today}-${task.id}`;
    const token = ++runToken.current;
    setRunIsDrill(true);
    setRunQuestions([]);
    setRunState("loading");
    setRunningId(task.id);
    setOpenId(task.id);
    try {
      const full = await fetchDrill(task.contentIds, { seed });
      if (token !== runToken.current) return;
      setRunQuestions(full);
      setRunState("ready");
    } catch {
      if (token !== runToken.current) return;
      setRunState("error");
    }
  };

  const drillTitle = (task: ClientTask) => `${task.type === "kanji" ? "Kanji" : "Vocabulary"} drill — Day ${day.day}`;

  const onDrillComplete = async (task: ClientTask, answers: SubmittedAnswer[], seconds: number) => {
    if (!user) return;
    await completeQuiz({
      uid: user.uid,
      kind: "practice",
      title: drillTitle(task),
      questions: runQuestions,
      answers,
      seconds,
      curriculumDay: day.day,
    });
    await refreshDaily();
    await refresh();
  };

  const onQuizComplete = async (task: ClientTask, answers: SubmittedAnswer[], seconds: number) => {
    if (!user) return;
    try {
      await completeQuiz({
        uid: user.uid,
        kind: quizKindForTask(task.type),
        title: `Day ${day.day} · ${task.title}`,
        questions: runQuestions,
        answers,
        seconds,
        curriculumDay: day.day,
        taskId: task.id,
      });
      markLocallyDone(task.id);
      await refreshDaily();
      await refresh();
      if (task.type === "review") setDue(await dueReviews(user.uid).catch(() => due));
    } catch (err) {
      // Queued results still count the task locally so the checklist reflects the work done.
      if (isQueuedError(err)) markLocallyDone(task.id);
      throw err;
    }
  };

  const onAdvance = async () => {
    if (!user) return;
    setAdvancing(true);
    try {
      await advanceDay(user.uid, day.day);
      await refresh();
      const next = Math.min(CURRICULUM_DAYS, day.day + 1);
      router.push(`/daily-study?day=${next}`);
      router.refresh();
    } catch (err) {
      setNotice({ tone: "warn", text: err instanceof Error ? err.message : "Could not advance the day." });
    } finally {
      setAdvancing(false);
    }
  };

  const onJump = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const n = Math.max(1, Math.min(CURRICULUM_DAYS, Math.floor(Number(jumpDay))));
    if (!Number.isFinite(n)) return;
    try {
      await updateUser(user.uid, { currentDay: n, currentPhase: phaseOf(n) });
      await refresh();
      router.push(`/daily-study?day=${n}`);
      router.refresh();
    } catch (err) {
      setNotice({ tone: "warn", text: err instanceof Error ? err.message : "Could not change the day." });
    }
  };

  const name = userDoc?.displayName ?? sessionName ?? "there";
  const overall = tasks.length > 0 ? (doneCount / tasks.length) * 100 : 0;

  return (
    <div className="pb-16">
      <PageTitle
        eyebrow={`Phase ${phase.id} · ${phase.name} · ${level.toUpperCase()}`}
        title={
          <>
            Day {day.day} <span className="text-muted font-normal">/ {CURRICULUM_DAYS}</span>
          </>
        }
        description={day.title}
        actions={
          <Button href="/dashboard" variant="secondary" size="sm">
            Dashboard
          </Button>
        }
      />

      {/* Sticky summary bar */}
      <div className="sticky top-16 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2.5 glass border-y border-line mb-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="font-semibold">Day {day.day}</span>
          <span className="text-muted tabular-nums">
            {doneMinutes} / {totalMinutes} min
          </span>
          <span className="text-muted tabular-nums">
            {doneCount} / {tasks.length} tasks
          </span>
          {allDone && <Badge tone="ok">Complete</Badge>}
          <div className="min-w-[8rem] flex-1 basis-32">
            <ProgressBar value={overall} size="sm" tone={allDone ? "ok" : "accent"} />
          </div>
        </div>
      </div>

      {userError && (
        <div className="mb-4">
          <Callout tone="warn">{userError}</Callout>
        </div>
      )}
      {notice && (
        <div className="mb-4 animate-rise">
          <Callout tone={notice.tone}>{notice.text}</Callout>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-5 min-w-0">
          <Card padding="p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">Today&apos;s goal</h2>
              <span className="text-xs text-muted">{day.objectives.length} objective{day.objectives.length === 1 ? "" : "s"}</span>
            </div>
            <ul className="mt-2 space-y-1.5 text-sm text-ink-2">
              {day.objectives.map((o, i) => (
                <li key={i} className="flex gap-2.5">
                  <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span>{o}</span>
                </li>
              ))}
            </ul>
          </Card>

          {loading ? (
            <div role="status" aria-live="polite">
              <span className="sr-only">Building today&apos;s plan, {name}…</span>
              <TaskSkeleton />
            </div>
          ) : (
            <ol className="relative space-y-3" aria-label="Today's tasks">
              {/* timeline rail */}
              <span aria-hidden className="absolute left-[2.1rem] sm:left-[2.35rem] top-6 bottom-6 w-px bg-line" />
              {tasks.map((task, i) => {
                const done = completedIds.has(task.id);
                const open = openId === task.id;
                const running = runningId === task.id;
                const status = done ? "done" : running ? "running" : open ? "open" : "todo";
                return (
                  <li key={task.id} id={`task-${task.id}`} className="relative">
                    <Card padding="p-0" className={`overflow-hidden transition ${done ? "border-ok/40" : open ? "border-accent/50 shadow-md" : ""}`}>
                      <button
                        type="button"
                        onClick={() => setOpenId(open ? null : task.id)}
                        aria-expanded={open}
                        aria-controls={`panel-${task.id}`}
                        className="flex w-full items-center gap-3 sm:gap-4 p-4 sm:p-5 text-left hover:bg-surface-2/60 transition"
                      >
                        <span
                          className={`relative z-[1] inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold tabular-nums transition ${
                            done ? "border-ok bg-ok text-white" : open ? "border-accent bg-accent-soft text-accent" : "border-line-strong bg-surface text-ink-2"
                          }`}
                          aria-hidden
                        >
                          {done ? <Check /> : i + 1}
                        </span>
                        <SkillGlyph type={task.type} tone={done ? "ok" : open ? "accent" : "neutral"} />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className={`font-semibold ${done ? "text-muted line-through decoration-line-strong" : ""}`}>{task.title}</span>
                            {task.boosted && <Badge tone="accent">extra focus</Badge>}
                          </span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                            <span className="inline-flex items-center rounded-full bg-surface-2 border border-line px-2 py-0.5 tabular-nums">{task.minutes} min</span>
                            {task.questionCount && <span>{task.questionCount} questions</span>}
                          </span>
                        </span>
                        <span className="shrink-0">
                          {status === "done" && <Badge tone="ok">Done</Badge>}
                          {status === "running" && <Badge tone="accent">In progress</Badge>}
                          {status === "open" && <Badge tone="neutral">Open</Badge>}
                          {status === "todo" && <Badge tone="neutral">To do</Badge>}
                        </span>
                        <svg viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 text-muted transition ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </button>

                      {open && (
                        <div id={`panel-${task.id}`} className="border-t border-line bg-bg-elev px-4 sm:px-5 py-4 animate-rise">
                          <p className="text-sm text-muted">{TASK_HINT[task.type]}</p>

                          {isSkillTask(task.type) && (
                            <>
                              {task.contentIds.length > 0 ? (
                                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                                  {task.contentIds.map((id) => {
                                    const link = contentLinks[id];
                                    return (
                                      <li key={id} className="flex items-center gap-2">
                                        {link ? (
                                          <Link href={link.href} className="group surface surface-hover flex flex-1 min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm">
                                            <span lang="ja" className="ja font-medium min-w-0 flex-1 truncate">
                                              {link.title}
                                            </span>
                                            <span className="text-xs text-muted">{link.type}</span>
                                            <Arrow className="text-muted group-hover:text-accent" />
                                          </Link>
                                        ) : (
                                          <span className="block flex-1 rounded-xl border border-dashed border-line px-3 py-2.5 text-sm text-muted">
                                            {id} <span className="text-xs">(lesson page coming soon)</span>
                                          </span>
                                        )}
                                        {link && JA_RE.test(link.title) && <SpeakButton text={link.title} size="xs" />}
                                      </li>
                                    );
                                  })}
                                </ul>
                              ) : (
                                <p className="mt-3 text-sm">
                                  No specific items assigned today — follow the objectives above, or browse{" "}
                                  <Link href={task.type === "kana" ? "/japanese/foundation" : `/japanese/${level}/${task.type}`} className="text-accent hover:underline">
                                    {task.type === "kana" ? "the foundation lessons" : `${level.toUpperCase()} ${task.type}`}
                                  </Link>
                                  .
                                </p>
                              )}
                              {(task.type === "vocabulary" || task.type === "kanji") && task.contentIds.length > 0 && (
                                <div className="mt-4">
                                  {running && runIsDrill && runState === "loading" ? (
                                    <LoadingState label="Building your drill…" rows={2} />
                                  ) : running && runIsDrill && runState === "error" ? (
                                    <div className="space-y-3">
                                      <Callout tone="warn">Could not build the drill. Check your connection and try again.</Callout>
                                      <div className="flex flex-wrap gap-2">
                                        <Button onClick={() => void startDrill(task)}>Retry</Button>
                                        <Button variant="secondary" onClick={() => setRunningId(null)}>
                                          Cancel
                                        </Button>
                                      </div>
                                    </div>
                                  ) : running && runIsDrill ? (
                                    <QuizRunner
                                      questions={runQuestions}
                                      title={drillTitle(task)}
                                      mode="practice"
                                      storageKey={`nihongo-path:quiz:${user?.uid ?? "anon"}:${today}:${task.id}:drill`}
                                      contentLinks={contentLinks}
                                      onComplete={(answers, seconds) => onDrillComplete(task, answers, seconds)}
                                      onExit={() => setRunningId(null)}
                                      resultActions={
                                        <Button variant="secondary" onClick={() => setRunningId(null)}>
                                          Back to the list
                                        </Button>
                                      }
                                    />
                                  ) : (
                                    <p className="text-sm text-muted">
                                      Check yourself on {task.type === "kanji" ? "these kanji" : "these words"} — each answer updates that item&apos;s review schedule.
                                    </p>
                                  )}
                                </div>
                              )}
                              {!(running && runIsDrill) && (
                                <div className="mt-4 flex flex-wrap gap-2">
                                  {(task.type === "vocabulary" || task.type === "kanji") && task.contentIds.length > 0 && (
                                    <Button variant={done ? "primary" : "secondary"} onClick={() => void startDrill(task)}>
                                      {task.type === "kanji" ? "Drill these kanji" : "Drill these words"}
                                      <Arrow />
                                    </Button>
                                  )}
                                  {!done && (
                                    <Button onClick={() => void markDone(task)} disabled={busyId === task.id}>
                                      {busyId === task.id ? "Saving…" : `Mark done (${task.minutes} min)`}
                                    </Button>
                                  )}
                                </div>
                              )}
                            </>
                          )}

                          {isQuizTask(task.type) && (
                            <div className="mt-4">
                              {task.type === "review" && (
                                <p className="mb-3 text-sm">
                                  {due.length > 0 ? (
                                    <>
                                      <strong>{due.length}</strong> item{due.length === 1 ? "" : "s"} due today.{" "}
                                      <Link href="/review" className="text-accent hover:underline">
                                        See the queue
                                      </Link>
                                    </>
                                  ) : (
                                    "Nothing is due yet — a short mixed review will be drawn instead."
                                  )}
                                </p>
                              )}
                              {running && runState === "loading" ? (
                                <LoadingState label="Loading questions…" rows={2} />
                              ) : running && runState === "error" ? (
                                <div className="space-y-3">
                                  <Callout tone="warn">Could not load the questions. Check your connection and try again.</Callout>
                                  <div className="flex flex-wrap gap-2">
                                    <Button onClick={() => void startQuiz(task)}>Retry</Button>
                                    <Button variant="secondary" onClick={() => setRunningId(null)}>
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : running ? (
                                <QuizRunner
                                  questions={runQuestions}
                                  title={task.title}
                                  mode={task.type === "weekly-test" || task.type === "phase-test" ? "test" : "practice"}
                                  storageKey={`nihongo-path:quiz:${user?.uid ?? "anon"}:${today}:${task.id}`}
                                  contentLinks={contentLinks}
                                  onComplete={(answers, seconds) => onQuizComplete(task, answers, seconds)}
                                  onExit={() => setRunningId(null)}
                                  resultActions={
                                    <Button
                                      variant="secondary"
                                      onClick={() => {
                                        setRunningId(null);
                                        openNextAfter(task.id);
                                      }}
                                    >
                                      Back to today&apos;s plan
                                    </Button>
                                  }
                                />
                              ) : (
                                <Button onClick={() => void startQuiz(task)}>
                                  {done ? "Take again" : `Start ${task.title.toLowerCase()} (${task.questionCount ?? defaultQuestionCount(task.type)} questions)`}
                                  <Arrow />
                                </Button>
                              )}
                            </div>
                          )}

                          {task.type === "mock-exam" && (
                            <div className="mt-4 flex flex-wrap gap-2">
                              <Button href={`/mock-exams/${task.examId ?? ""}`}>
                                Open mock exam <Arrow />
                              </Button>
                              {!done && (
                                <Button variant="secondary" onClick={() => void markDone(task)} disabled={busyId === task.id}>
                                  {busyId === task.id ? "Saving…" : "I finished this exam — mark done"}
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  </li>
                );
              })}
            </ol>
          )}

          {allDone && (
            <Card padding="p-0" className="overflow-hidden animate-rise">
              <div className="accent-gradient px-5 sm:px-6 py-4 text-white">
                <p className="text-[11px] uppercase tracking-[0.14em] opacity-90">Nice work</p>
                <h2 className="text-h2 text-white mt-0.5">Day {day.day} complete</h2>
              </div>
              <div className="p-5 sm:p-6">
                <p className="text-sm text-ink-2">
                  <strong className="text-ink">{doneMinutes} minutes</strong> logged today. Tomorrow&apos;s plan will include anything you missed in today&apos;s tests.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {day.day < CURRICULUM_DAYS ? (
                    <Button onClick={() => void onAdvance()} disabled={advancing} size="lg">
                      {advancing ? "Advancing…" : `Advance to Day ${day.day + 1}`}
                      <Arrow />
                    </Button>
                  ) : (
                    <Button href="/progress" size="lg">
                      You finished the 180-day plan — view progress
                    </Button>
                  )}
                  <Button variant="secondary" size="lg" href="/dashboard">
                    Back to dashboard
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>

        <aside className="space-y-4 min-w-0">
          <Card padding="p-4 sm:p-5">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-semibold">Plan summary</h2>
              <span className="text-xs text-muted tabular-nums">~{totalMinutes} min</span>
            </div>
            {loading ? (
              <div className="mt-3 space-y-2" aria-hidden>
                <div className="skeleton h-3 w-3/4" />
                <div className="skeleton h-3 w-2/3" />
                <div className="skeleton h-3 w-1/2" />
              </div>
            ) : (
              <dl className="mt-3 space-y-1.5 text-sm">
                {tasks.map((t) => {
                  const d = completedIds.has(t.id);
                  return (
                    <div key={t.id} className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 rounded-full ${d ? "bg-ok" : "bg-line-strong"}`} aria-hidden />
                      <dt className={`flex-1 truncate ${d ? "line-through text-muted" : ""}`}>{t.title}</dt>
                      <dd className="text-muted tabular-nums text-xs">{t.minutes} min</dd>
                    </div>
                  );
                })}
              </dl>
            )}
            {userDoc && (
              <p className="mt-3 border-t border-line pt-3 text-xs text-muted">
                Target {userDoc.settings.dailyMinutesTarget} min/day · change in{" "}
                <Link href="/profile" className="text-accent hover:underline">
                  profile
                </Link>
              </p>
            )}
          </Card>

          <Card padding="p-4 sm:p-5">
            <h2 className="font-semibold">Jump to a day</h2>
            <p className="mt-1 text-xs text-muted">Joining mid-way or repeating a day? Set your current day here.</p>
            <form onSubmit={(e) => void onJump(e)} className="mt-3 flex gap-2">
              <label className="sr-only" htmlFor="jump-day">
                Day number
              </label>
              <input
                id="jump-day"
                type="number"
                min={1}
                max={CURRICULUM_DAYS}
                value={jumpDay}
                onChange={(e) => setJumpDay(e.target.value)}
                className="w-24 h-10 rounded-full border border-line bg-surface px-4 text-sm tabular-nums focus:border-accent focus:outline-none focus:shadow-ring"
              />
              <Button type="submit" variant="secondary">
                Go
              </Button>
            </form>
          </Card>

          <Card padding="p-4 sm:p-5">
            <h2 className="font-semibold">Shortcuts</h2>
            <ul className="mt-2 divide-y divide-line">
              {[
                { href: "/review", type: "review", label: `Review queue`, hint: `${due.length} due` },
                { href: "/tests", type: "test", label: "Take a test", hint: "quiz, weekly, phase" },
                { href: "/progress", type: "other", label: "Progress", hint: "skills & memory" },
              ].map((s) => (
                <li key={s.href}>
                  <Link href={s.href} className="group flex items-center gap-3 py-2 text-sm">
                    <SkillGlyph type={s.type} size="sm" />
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium">{s.label}</span>
                      <span className="block text-xs text-muted">{s.hint}</span>
                    </span>
                    <Arrow className="text-muted group-hover:text-accent" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}
