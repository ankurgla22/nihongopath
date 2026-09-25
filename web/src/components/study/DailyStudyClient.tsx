"use client";
/**
 * Today's study plan. The plan is built with buildDailyPlan() once per day and persisted into
 * dailyProgress.plannedTasks so it stays stable; each task expands into its work and is marked
 * complete through the study service (completeTask / completeQuiz), which also updates SRS,
 * streak and the daily log.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CurriculumDay, PackedQuestionIndex, Question, QuestionIndexEntry } from "@/lib/content/schemas";
import { todayISO, type DailyProgressDoc, type ReviewItemDoc, type UserDoc } from "@/lib/firestore/types";
import { getDaily, setDaily } from "@/lib/firestore/repo";
import { advanceDay, completeQuiz, completeTask, dueReviews } from "@/lib/study/service";
import { buildDailyPlan, taskTitle, weakSkills, type TaskType } from "@/lib/engine/dailyPlan";
import type { SubmittedAnswer } from "@/lib/engine/scoring";
import { CURRICULUM_DAYS } from "@/lib/engine/progress";
import { fetchDrill, fetchQuestionsByIds } from "@/lib/questions/client";
import { unpackQuestionIndex } from "@/lib/questions/pack";
import { scrollUnderHeader } from "@/lib/ui/scrollUnderHeader";
import { useAuth } from "@/components/auth/AuthProvider";
import { useUserDoc } from "@/components/auth/useUserDoc";
import { Arrow, Badge, Button, Callout, Card, PageTitle, ProgressBar } from "@/components/ui";
import { LoadingState } from "@/components/progress/shared";
import { QuizRunner } from "@/components/quiz/QuizRunner";
import {
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
  /** Kept for the page contract; the phase is no longer shown on the daily view. */
  phase: { id: number; name: string };
  /** Slim index of the banks this day can draw from; full records are fetched on demand. */
  questionIndex: PackedQuestionIndex;
  contentLinks: ContentLinks;
  sessionName: string | null;
};

type Notice = { tone: "ok" | "warn" | "accent"; text: string } | null;
type RunState = "loading" | "ready" | "error";

const TASK_HINT: Record<TaskType, string> = {
  kana: "Open the lesson and work through it row by row: say each sound aloud and trace it. The daily quiz at the end of the day checks what stuck.",
  grammar: "Read each lesson: meaning, formation, examples and common mistakes. Then do the lesson's quick check.",
  vocabulary: "Read each word with its example sentence. Say it aloud once; note any you already know.",
  kanji: "For each kanji: readings, example words, and write it a few times.",
  reading: "Read the passage once without stopping, then answer the questions and check the strategy notes.",
  listening: "Listen first without the script, answer, then read the script and shadow it once.",
  review: "Items due today from your review queue — answering correctly pushes them further out.",
  quiz: "A short quiz on today's material with an explanation after every answer.",
  "weekly-test": "Covers this week's material. No feedback until the end — like the real exam.",
  "phase-test": "A larger exam-style test of everything covered so far at your level, across all five skills.",
  "mock-exam": "A full timed JLPT-style mock exam with scaled scoring.",
};

function fromPlanned(planned: DailyProgressDoc["plannedTasks"], fresh: ClientTask[], contentLinks: ContentLinks): ClientTask[] {
  const byId = new Map(fresh.map((t) => [t.id, t]));
  return planned.map((p) => {
    const f = byId.get(p.id);
    const type = (f?.type ?? p.type) as TaskType;
    // Kana tasks are named after their lesson ("Hiragana: the basic 46", "Pronunciation basics") so two
    // kana tasks on the same day are distinguishable; other types keep the skill title.
    const lessonTitle = type === "kana" ? contentLinks[p.contentIds[0] ?? ""]?.title : undefined;
    return {
      id: p.id,
      type,
      title: lessonTitle ?? f?.title ?? taskTitle(type),
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
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3.5 w-1/2" />
            <div className="skeleton h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DailyStudyClient({ day, questionIndex: packedIndex, contentLinks, sessionName }: Props) {
  const questionIndex = useMemo(() => unpackQuestionIndex(packedIndex), [packedIndex]);
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
  const [advancing, setAdvancing] = useState(false);
  /** The running task's card and the sticky day bar, so a starting quiz can be scrolled clear of both. */
  const runningCardRef = useRef<HTMLLIElement>(null);
  const dayBarRef = useRef<HTMLDivElement>(null);
  /** Set when a task is opened programmatically (after "Mark done"), so we can scroll to it once rendered. */
  const [scrollToId, setScrollToId] = useState<string | null>(null);
  /**
   * Tasks whose lesson link was opened this session; "Mark done" unlocks only after the lesson was visited.
   * Mirrored in sessionStorage because opening a lesson navigates away and the component remounts on return.
   */
  const [visitedTaskIds, setVisitedTaskIds] = useState<Set<string>>(() => new Set());
  const visitedKey = `nihongo-path:visited:${user?.uid ?? "anon"}:${today}:${day.day}`;
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(visitedKey);
      if (raw) setVisitedTaskIds(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* storage unavailable */
    }
  }, [visitedKey]);
  const markVisited = (taskId: string) =>
    setVisitedTaskIds((s) => {
      if (s.has(taskId)) return s;
      const next = new Set(s);
      next.add(taskId);
      try {
        sessionStorage.setItem(visitedKey, JSON.stringify([...next]));
      } catch {
        /* storage unavailable */
      }
      return next;
    });

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
        const list = fromPlanned(doc.plannedTasks.filter((t) => t.id.startsWith(`d${day.day}-`)), fresh, contentLinks);
        setTasks(list);
        setOpenId((cur) => cur ?? list.find((t) => !doc!.completedTaskIds.includes(t.id))?.id ?? null);
      } catch (err) {
        setNotice({ tone: "warn", text: err instanceof Error ? err.message : "Could not load today's plan." });
      } finally {
        setLoading(false);
      }
    },
    [user, day, today, contentLinks]
  );

  // Load once per signed-in user; later userDoc refreshes (streak, minutes) must not rebuild the list.
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!userDoc || loadedFor.current === userDoc.uid) return;
    loadedFor.current = userDoc.uid;
    void load(userDoc);
  }, [userDoc, load]);

  const completedIds = useMemo(() => new Set(daily?.completedTaskIds ?? []), [daily]);
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
    // The finished card collapses and the next one opens further down, so bring it into view rather
    // than letting the panel expand out from under the pointer.
    setScrollToId(next?.id ?? null);
  };

  useEffect(() => {
    if (!scrollToId) return;
    scrollUnderHeader(document.getElementById(`task-${scrollToId}`), dayBarRef.current);
    setScrollToId(null);
  }, [scrollToId]);

  // Starting a quiz collapses the list to one task and drops the page title, so the document shrinks
  // and the browser clamps the scroll past the runner. QuizRunner's own scroll skips first paint.
  useEffect(() => {
    if (!runningId || runState !== "ready") return;
    scrollUnderHeader(runningCardRef.current, dayBarRef.current);
  }, [runningId, runState]);

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


  const name = userDoc?.displayName ?? sessionName ?? "there";
  const overall = tasks.length > 0 ? (doneCount / tasks.length) * 100 : 0;
  // While a quiz or drill runs, only the sticky bar and that task's card stay on screen.
  const runningTask = runningId ? tasks.find((t) => t.id === runningId) : undefined;
  const visibleTasks = runningTask ? [runningTask] : tasks;

  return (
    <div className="pb-16">
      {!runningTask && (
        <PageTitle
          title={
            <>
              Day {day.day} <span className="text-muted font-normal">/ {CURRICULUM_DAYS}</span>
              <span className="text-muted font-normal"> — {day.title.replace(/^Day \d+ — /, "")}</span>
            </>
          }
        />
      )}

      {/* Sticky summary bar. Hidden while a quiz runs: it sticks at the same offset as the runner's own
          progress bar but above it, which would hide the "3 / 10" counter. */}
      {!runningTask && (
        <div ref={dayBarRef} className="sticky top-[var(--header-h,4rem)] z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2.5 glass border-y border-line mb-5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="font-semibold">Day {day.day}</span>
            <span className="text-muted tabular-nums">
              {doneCount} / {tasks.length} tasks
            </span>
            {allDone && <Badge tone="ok">Complete</Badge>}
            <div className="min-w-[8rem] flex-1 basis-32">
              <ProgressBar value={overall} size="sm" tone={allDone ? "ok" : "accent"} />
            </div>
          </div>
        </div>
      )}

      {userError && (
        <div className="mb-4">
          <Callout tone="warn">{userError}</Callout>
        </div>
      )}
      {notice && !runningTask && (
        <div className="mb-4 animate-rise">
          <Callout tone={notice.tone}>{notice.text}</Callout>
        </div>
      )}

      <div className={`space-y-5 min-w-0 ${runningTask ? "mt-6" : ""}`}>
        {loading ? (
          <div role="status" aria-live="polite">
            <span className="sr-only">Building today&apos;s plan, {name}…</span>
            <TaskSkeleton />
          </div>
        ) : (
          <ol className="relative space-y-3" aria-label="Today's tasks">
            {!runningTask && <span aria-hidden className="absolute left-[2.1rem] sm:left-[2.35rem] top-6 bottom-6 w-px bg-line" />}
            {visibleTasks.map((task) => {
              const i = tasks.indexOf(task);
              const done = completedIds.has(task.id);
              const open = openId === task.id;
              const running = runningId === task.id;
              const status = done ? "done" : running ? "running" : open ? "open" : "todo";
              const linkedIds = task.contentIds.filter((id) => contentLinks[id]);
              // Few links (one or two lessons) render as primary buttons; long word/kanji lists keep the compact grid.
              const fewLinks = linkedIds.length > 0 && linkedIds.length <= 2;
              const canMarkDone = linkedIds.length === 0 || visitedTaskIds.has(task.id);
              const lessonsPending = task.type === "quiz" && tasks.some((t) => isSkillTask(t.type) && !completedIds.has(t.id));
              return (
                // scroll-mt clears the sticky header plus the day bar, so a /daily-study#task-<id> link
                // from the dashboard does not land the heading behind them.
                <li
                  key={task.id}
                  id={`task-${task.id}`}
                  ref={running ? runningCardRef : undefined}
                  className="relative scroll-mt-[calc(var(--header-h,4rem)+3.5rem)]"
                >
                  {/* overflow-hidden would stop the runner's sticky progress bar from sticking. */}
                  <Card padding="p-0" className={`transition ${running ? "" : "overflow-hidden"} ${done ? "border-ok/40" : open ? "border-accent/50 shadow-md" : ""}`}>
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
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className={`font-semibold ${done ? "text-muted line-through decoration-line-strong" : ""}`}>{task.title}</span>
                          {task.boosted && <Badge tone="accent">extra focus</Badge>}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted tabular-nums">
                          <span>{task.minutes} min</span>
                          {task.questionCount && <span>· {task.questionCount} questions</span>}
                        </span>
                      </span>
                      <span className="shrink-0">
                        {status === "done" && <Badge tone="ok">Done</Badge>}
                        {status === "running" && <Badge tone="accent">In progress</Badge>}
                      </span>
                      <svg viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 text-muted transition ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </button>

                    {open && (
                      <div id={`panel-${task.id}`} className="border-t border-line bg-bg-elev px-4 sm:px-5 py-4 animate-rise">
                        {!running && <p className="text-sm text-muted">{TASK_HINT[task.type]}</p>}

                        {isSkillTask(task.type) && (
                          <>
                            {!(running && runIsDrill) &&
                              (task.contentIds.length > 0 ? (
                                <ul className={`mt-3 grid gap-2 ${fewLinks ? "" : "sm:grid-cols-2"}`}>
                                  {task.contentIds.map((id) => {
                                    const link = contentLinks[id];
                                    return (
                                      <li key={id} className="flex items-center gap-2">
                                        {link && fewLinks ? (
                                          <Link
                                            href={link.href}
                                            onClick={() => markVisited(task.id)}
                                            className="group accent-gradient flex flex-1 min-w-0 items-center gap-3 rounded-full px-5 h-11 text-sm font-medium text-white shadow-sm transition hover:shadow-md hover:brightness-105 focus:outline-none focus-visible:shadow-ring"
                                          >
                                            <span className="shrink-0">Open lesson:</span>
                                            <span lang="ja" className="ja min-w-0 flex-1 truncate">
                                              {link.title}
                                            </span>
                                            <Arrow />
                                          </Link>
                                        ) : link ? (
                                          <Link href={link.href} onClick={() => markVisited(task.id)} className="group surface surface-hover flex flex-1 min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm">
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
                                      </li>
                                    );
                                  })}
                                </ul>
                              ) : (
                                <p className="mt-3 text-sm">
                                  No specific items assigned today — browse{" "}
                                  <Link href={task.type === "kana" ? "/japanese/foundation" : `/japanese/${level}/${task.type}`} className="text-accent hover:underline">
                                    {task.type === "kana" ? "the foundation lessons" : `${level.toUpperCase()} ${task.type}`}
                                  </Link>
                                  .
                                </p>
                              ))}
                            {(task.type === "vocabulary" || task.type === "kanji") && task.contentIds.length > 0 && running && runIsDrill && (
                              <div className="mt-4">
                                {runState === "loading" ? (
                                  <LoadingState label="Building your drill…" rows={2} />
                                ) : runState === "error" ? (
                                  <div className="space-y-3">
                                    <Callout tone="warn">Could not build the drill. Check your connection and try again.</Callout>
                                    <div className="flex flex-wrap gap-2">
                                      <Button onClick={() => void startDrill(task)}>Retry</Button>
                                      <Button variant="secondary" onClick={() => setRunningId(null)}>
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <QuizRunner
                                    questions={runQuestions}
                                    title={drillTitle(task)}
                                    mode="practice"
                                    storageKey={`nihongo-path:quiz:${user?.uid ?? "anon"}:${today}:${task.id}:drill`}
                                    contentLinks={contentLinks}
                                    onComplete={(answers, seconds) => onDrillComplete(task, answers, seconds)}
                                    onExit={() => setRunningId(null)}
                                    resultActions={<Button onClick={() => setRunningId(null)}>Back to the list</Button>}
                                  />
                                )}
                              </div>
                            )}
                            {!(running && runIsDrill) && (
                              <div className="mt-4 flex flex-wrap gap-2">
                                {(task.type === "vocabulary" || task.type === "kanji") && task.contentIds.length > 0 && (
                                  <Button variant="secondary" onClick={() => void startDrill(task)}>
                                    {task.type === "kanji" ? "Drill these kanji" : "Drill these words"}
                                    <Arrow />
                                  </Button>
                                )}
                                {/* "Mark done" appears only once the lesson has been opened. */}
                                {!done && canMarkDone && (
                                  <Button variant="secondary" onClick={() => void markDone(task)} disabled={busyId === task.id}>
                                    {busyId === task.id ? "Saving…" : `Mark done (${task.minutes} min)`}
                                  </Button>
                                )}
                              </div>
                            )}
                          </>
                        )}

                        {isQuizTask(task.type) && (
                          <div className="mt-4">
                            {task.type === "review" && !running && (
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
                              <>
                                {!done && lessonsPending && <p className="mb-3 text-sm text-warn">Finish today&apos;s lessons first for a fair score.</p>}
                                <Button onClick={() => void startQuiz(task)}>
                                  {done ? "Take again" : `Start ${task.title.toLowerCase()} (${task.questionCount ?? defaultQuestionCount(task.type)} questions)`}
                                  <Arrow />
                                </Button>
                              </>
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

        {allDone && !runningTask && (
          <Card className="animate-rise">
            <h2 className="text-h2">Day {day.day} complete</h2>
            <p className="mt-2 text-sm text-ink-2">
              <strong className="text-ink">{doneMinutes} minutes</strong> logged today.
            </p>
            <div className="mt-4">
              {day.day < CURRICULUM_DAYS ? (
                <Button onClick={() => void onAdvance()} disabled={advancing} size="lg">
                  {advancing ? "Advancing…" : `Advance to Day ${day.day + 1}`}
                  <Arrow />
                </Button>
              ) : (
                <Button href="/progress" size="lg">
                  You finished the plan — view progress
                </Button>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
