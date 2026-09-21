"use client";
/**
 * Mock exam runner.
 *
 * Start screen (mode chooser, sections, collapsed rules, Resume) →
 * timed sections with a timestamp-based countdown (auto-submits the section on
 * time-up) → section break → scoring via scoreExam → completeExam → result page.
 *
 * In-progress state is written to localStorage under `exam:${uid}:${examId}` on
 * every change (and every second for the clock) so a refresh, tab crash or
 * network loss never loses progress.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ExamBlueprint, Question } from "@/lib/content/schemas";
import { scoreExam, type SubmittedAnswer } from "@/lib/engine/scoring";
import { completeExam } from "@/lib/study/service";
import { getUser } from "@/lib/firestore/repo";
import { useAuth } from "@/components/auth/AuthProvider";
import { Arrow, Badge, Button, Card, Callout, Kbd, SpeakButton, Stat } from "@/components/ui";

import { JA_RE } from "@/components/study/helpers";
import { examTitle, sectionGloss } from "./examLabels";
import { examStateKey, formatClock, PromptText, saveSessionResult, typeLabel, type ExamAnswerState, type StoredExamResult } from "./shared";

type Mode = "full" | "single";
type Phase = "running" | "break";

type SavedState = {
  v: 1;
  examId: string;
  mode: Mode;
  sectionIds: string[];
  sectionIndex: number;
  questionIndex: number;
  answers: Record<string, ExamAnswerState>;
  flagged: string[];
  /** Seconds left in the current section at the time of the last save. */
  remainingSeconds: number;
  /** Seconds actually spent per finished section. */
  elapsedBySection: Record<string, number>;
  phase: Phase;
  startedAt: string;
  updatedAt: number;
};

type Screen = "start" | "running" | "break" | "confirm-submit" | "saving" | "error";

const WARN_AT = [300, 60] as const;

function readSaved(key: string, examId: string): SavedState | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const s = JSON.parse(raw) as SavedState;
    if (s?.v !== 1 || s.examId !== examId || !Array.isArray(s.sectionIds)) return null;
    return s;
  } catch {
    return null;
  }
}

function isAnswered(a: ExamAnswerState | undefined): boolean {
  return a !== undefined && a.selectedIndex !== null;
}

function speakScript(text: string, onEnd: () => void): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const lines = text
    .split("\n")
    .map((l) => l.replace(/^(男の人|女の人|男|女|先生|学生|店員|客|A|B)[：:]\s*/u, "").trim())
    .filter(Boolean);
  if (lines.length === 0) return false;
  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find((v) => v.lang === "ja-JP") ?? voices.find((v) => v.lang.toLowerCase().startsWith("ja"));
  lines.forEach((line, i) => {
    const u = new SpeechSynthesisUtterance(line);
    u.lang = "ja-JP";
    if (voice) u.voice = voice;
    u.rate = 0.95;
    if (i === lines.length - 1) u.onend = onEnd;
    u.onerror = onEnd;
    window.speechSynthesis.speak(u);
  });
  return true;
}

function FlagIcon({ className = "", filled = false }: { className?: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-4 w-4 ${className}`} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 21V4a1 1 0 0 1 1-1h11l-2 4 2 4H6" />
    </svg>
  );
}

function ClockIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-4 w-4 ${className}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function GridIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-4 w-4 ${className}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function ExamRunner({ exam, questions }: { exam: ExamBlueprint; questions: Record<string, Question> }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const uid = user?.uid ?? null;
  const storageKey = uid ? examStateKey(uid, exam.id) : null;

  const [screen, setScreen] = useState<Screen>("start");
  const [saved, setSaved] = useState<SavedState | null>(null);
  const [mode, setMode] = useState<Mode>("full");
  const [singleSection, setSingleSection] = useState(exam.sections[0]?.id ?? "");
  const [sectionIds, setSectionIds] = useState<string[]>([]);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, ExamAnswerState>>({});
  const [flagged, setFlagged] = useState<string[]>([]);
  const [elapsedBySection, setElapsedBySection] = useState<Record<string, number>>({});
  const [remaining, setRemaining] = useState(0);
  const [announce, setAnnounce] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [startedAt, setStartedAt] = useState("");
  const [showScript, setShowScript] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [ttsUnavailable, setTtsUnavailable] = useState(false);
  /** Presentation only: question navigator drawer on small screens. */
  const [navOpen, setNavOpen] = useState(false);

  /** Epoch ms at which the current section ends. Timestamps, not tick counting, keep the clock honest. */
  const deadlineRef = useRef<number>(0);
  /** Epoch ms when the current question was opened. */
  const qStartRef = useRef<number>(0);
  const announcedRef = useRef<Set<number>>(new Set());
  const endingRef = useRef(false);

  const sectionsById = useMemo(() => new Map(exam.sections.map((s) => [s.id, s])), [exam]);
  const currentSection = sectionsById.get(sectionIds[sectionIndex] ?? "");
  const sectionQuestions = useMemo(
    () => (currentSection ? currentSection.questionIds.map((id) => questions[id]).filter((q): q is Question => Boolean(q)) : []),
    [currentSection, questions]
  );
  const currentQuestion = sectionQuestions[questionIndex];
  const totalSeconds = exam.sections.reduce((a, s) => a + s.timeLimitSeconds, 0);
  const countQuestions = (ids: string[]) => ids.filter((id) => questions[id]).length;

  /* ---------- load saved state once uid is known ---------- */
  useEffect(() => {
    if (!storageKey) return;
    setSaved(readSaved(storageKey, exam.id));
  }, [storageKey, exam.id]);

  /* ---------- persistence ---------- */
  const persist = useCallback(
    (phase: Phase, remainingSeconds: number) => {
      if (!storageKey) return;
      const state: SavedState = {
        v: 1,
        examId: exam.id,
        mode,
        sectionIds,
        sectionIndex,
        questionIndex,
        answers,
        flagged,
        remainingSeconds,
        elapsedBySection,
        phase,
        startedAt,
        updatedAt: Date.now(),
      };
      try {
        localStorage.setItem(storageKey, JSON.stringify(state));
      } catch {
        /* storage unavailable */
      }
    },
    [storageKey, exam.id, mode, sectionIds, sectionIndex, questionIndex, answers, flagged, elapsedBySection, startedAt]
  );

  // Save whenever answers / position change, and once per second while the clock runs.
  useEffect(() => {
    if (screen === "running" || screen === "confirm-submit") persist("running", remaining);
    else if (screen === "break") persist("break", sectionsById.get(sectionIds[sectionIndex + 1] ?? "")?.timeLimitSeconds ?? 0);
  }, [screen, persist, remaining, sectionsById, sectionIds, sectionIndex]);

  const clearSavedState = useCallback(() => {
    if (!storageKey) return;
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  /* ---------- per-question time accounting ---------- */
  const withQuestionTime = useCallback(
    (prev: Record<string, ExamAnswerState>): Record<string, ExamAnswerState> => {
      const q = sectionQuestions[questionIndex];
      if (!q || !qStartRef.current) return prev;
      const delta = (Date.now() - qStartRef.current) / 1000;
      qStartRef.current = Date.now();
      if (delta <= 0) return prev;
      const cur = prev[q.id] ?? { selectedIndex: null, seconds: 0 };
      return { ...prev, [q.id]: { ...cur, seconds: Math.round((cur.seconds + delta) * 10) / 10 } };
    },
    [sectionQuestions, questionIndex]
  );

  /* ---------- finishing ---------- */
  const finishExam = useCallback(
    async (finalAnswers: Record<string, ExamAnswerState>, finalElapsed: Record<string, number>, ids: string[], chosenMode: Mode) => {
      setScreen("saving");
      const chosen = ids.map((id) => sectionsById.get(id)).filter((s): s is ExamBlueprint["sections"][number] => Boolean(s));
      const blueprint: ExamBlueprint = {
        ...exam,
        title: chosenMode === "single" ? `${exam.title} — ${chosen[0]?.name ?? ""}` : exam.title,
        sections: chosen,
      };
      const submitted: SubmittedAnswer[] = [];
      for (const s of blueprint.sections) {
        for (const qid of s.questionIds) {
          const a = finalAnswers[qid];
          submitted.push({ questionId: qid, selectedIndex: a?.selectedIndex ?? null, seconds: a?.seconds ?? 0 });
        }
      }
      const score = scoreExam(blueprint, new Map(Object.entries(questions)), submitted);
      // Wall-clock section time is the honest figure; per-question seconds are kept on each answer.
      score.sections = score.sections.map((s) => ({ ...s, seconds: Math.round(finalElapsed[s.id] ?? s.seconds) }));
      score.seconds = score.sections.reduce((a, s) => a + s.seconds, 0);

      if (!uid) {
        setErrorMsg("You are not signed in on this device, so the result cannot be saved. Sign in and press Try again; your answers are kept locally.");
        setScreen("error");
        return;
      }
      let curriculumDay = 1;
      try {
        curriculumDay = (await getUser(uid))?.currentDay ?? 1;
      } catch {
        /* offline: default day */
      }
      try {
        const result = await completeExam({ uid, result: score, curriculumDay });
        saveSessionResult(result);
        clearSavedState();
        router.push(`/mock-exams/history/${result.id}`);
      } catch (err) {
        const queued = err as { queued?: boolean; result?: StoredExamResult };
        if (queued?.queued && queued.result) {
          saveSessionResult({ ...queued.result, offline: true });
          clearSavedState();
          router.push(`/mock-exams/history/${queued.result.id}?offline=1`);
          return;
        }
        setErrorMsg(err instanceof Error ? err.message : "Could not save the result. Your answers are kept on this device; try again.");
        setScreen("error");
      }
    },
    [exam, sectionsById, questions, uid, clearSavedState, router]
  );

  const endSection = useCallback(
    (auto: boolean) => {
      if (endingRef.current || !currentSection) return;
      endingRef.current = true;
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
      setSpeaking(false);
      const remainingNow = Math.max(0, (deadlineRef.current - Date.now()) / 1000);
      const elapsed = Math.round(currentSection.timeLimitSeconds - remainingNow);

      // Commit the open question's time synchronously so finishExam sees it.
      const nextAnswers = withQuestionTime(answers);
      const nextElapsed = { ...elapsedBySection, [currentSection.id]: elapsed };
      setAnswers(nextAnswers);
      setElapsedBySection(nextElapsed);
      qStartRef.current = 0;
      setAnnounce(auto ? `Time is up for ${currentSection.name}. The section has been submitted.` : `${currentSection.name} submitted.`);

      if (sectionIndex >= sectionIds.length - 1) {
        void finishExam(nextAnswers, nextElapsed, sectionIds, mode);
      } else {
        setScreen("break");
      }
      endingRef.current = false;
    },
    [currentSection, withQuestionTime, answers, elapsedBySection, sectionIndex, sectionIds, finishExam, mode]
  );

  /* ---------- timer ---------- */
  useEffect(() => {
    if (screen !== "running" && screen !== "confirm-submit") return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setRemaining((prev) => (prev === left ? prev : left));
      for (const w of WARN_AT) {
        if (left <= w && left > 0 && !announcedRef.current.has(w)) {
          announcedRef.current.add(w);
          setAnnounce(w >= 60 ? `${w / 60} minute${w > 60 ? "s" : ""} remaining in this section.` : `${w} seconds remaining.`);
        }
      }
      if (left <= 0) endSection(true);
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [screen, endSection]);

  /* ---------- section start ---------- */
  const beginSection = useCallback(
    (idx: number, ids: string[], resumeSeconds?: number) => {
      const s = sectionsById.get(ids[idx] ?? "");
      if (!s) return;
      const secs = resumeSeconds !== undefined ? Math.max(0, Math.min(resumeSeconds, s.timeLimitSeconds)) : s.timeLimitSeconds;
      deadlineRef.current = Date.now() + secs * 1000;
      announcedRef.current = new Set(WARN_AT.filter((w) => secs <= w));
      qStartRef.current = Date.now();
      setRemaining(secs);
      setShowScript(false);
      setScreen("running");
    },
    [sectionsById]
  );

  const startExam = () => {
    const ids = mode === "full" ? exam.sections.map((s) => s.id) : [singleSection];
    clearSavedState();
    setSectionIds(ids);
    setSectionIndex(0);
    setQuestionIndex(0);
    setAnswers({});
    setFlagged([]);
    setElapsedBySection({});
    setStartedAt(new Date().toISOString());
    setSaved(null);
    beginSection(0, ids);
  };

  const resumeExam = () => {
    if (!saved) return;
    setMode(saved.mode);
    setSectionIds(saved.sectionIds);
    setSectionIndex(saved.sectionIndex);
    setQuestionIndex(Math.max(0, saved.questionIndex));
    setAnswers(saved.answers ?? {});
    setFlagged(saved.flagged ?? []);
    setElapsedBySection(saved.elapsedBySection ?? {});
    setStartedAt(saved.startedAt || new Date().toISOString());
    if (saved.phase === "break") setScreen("break");
    else beginSection(saved.sectionIndex, saved.sectionIds, saved.remainingSeconds);
  };

  const discardSaved = () => {
    clearSavedState();
    setSaved(null);
  };

  const startNextSection = () => {
    const next = sectionIndex + 1;
    setSectionIndex(next);
    setQuestionIndex(0);
    beginSection(next, sectionIds);
  };

  /* ---------- answering / navigation ---------- */
  const goTo = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= sectionQuestions.length || idx === questionIndex) return;
      setAnswers(withQuestionTime);
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
      setSpeaking(false);
      setShowScript(false);
      setQuestionIndex(idx);
    },
    [sectionQuestions.length, questionIndex, withQuestionTime]
  );

  const select = useCallback(
    (optionIndex: number) => {
      if (!currentQuestion) return;
      setAnswers((prev) => {
        const cur = prev[currentQuestion.id] ?? { selectedIndex: null, seconds: 0 };
        return { ...prev, [currentQuestion.id]: { ...cur, selectedIndex: optionIndex } };
      });
    },
    [currentQuestion]
  );

  const toggleFlag = useCallback(() => {
    if (!currentQuestion) return;
    setFlagged((f) => (f.includes(currentQuestion.id) ? f.filter((x) => x !== currentQuestion.id) : [...f, currentQuestion.id]));
  }, [currentQuestion]);

  // Keyboard: 1-6 select an option, ← / → move, F flags.
  useEffect(() => {
    if (screen !== "running") return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (/^[1-6]$/.test(e.key) && currentQuestion && Number(e.key) <= currentQuestion.options.length) select(Number(e.key) - 1);
      else if (e.key === "ArrowRight") goTo(questionIndex + 1);
      else if (e.key === "ArrowLeft") goTo(questionIndex - 1);
      else if (e.key.toLowerCase() === "f") toggleFlag();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, currentQuestion, questionIndex, select, goTo, toggleFlag]);

  useEffect(
    () => () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    },
    []
  );

  const playScript = () => {
    if (!currentQuestion?.context) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const ok = speakScript(currentQuestion.context, () => setSpeaking(false));
    if (!ok) setTtsUnavailable(true);
    else setSpeaking(true);
  };

  /* ======================= render ======================= */

  const liveRegion = (
    <div aria-live="assertive" role="status" className="sr-only">
      {announce}
    </div>
  );

  if (authLoading) {
    return (
      <div className="py-10 max-w-content mx-auto" role="status" aria-busy="true">
        <span className="sr-only">Loading…</span>
        <div className="skeleton h-3 w-24" aria-hidden />
        <div className="skeleton mt-3 h-9 w-2/3" aria-hidden />
        <div className="skeleton mt-6 h-40 w-full rounded-2xl" aria-hidden />
        <div className="skeleton mt-4 h-32 w-full rounded-2xl" aria-hidden />
      </div>
    );
  }

  if (screen === "start") {
    const singleSec = sectionsById.get(singleSection);
    const totalQ = exam.sections.reduce((a, s) => a + countQuestions(s.questionIds), 0);
    const totalMin = Math.round(totalSeconds / 60);
    return (
      <div className="py-8 sm:py-10 max-w-content mx-auto pb-16">
        {liveRegion}
        <div className="animate-rise">
          <h1 className="text-h1">{examTitle(exam)}</h1>
          <p className="mt-2 text-muted tabular-nums">
            {exam.sections.length} sections · {totalQ} questions · {totalMin} min
          </p>
        </div>

        {saved && (
          <div className="mt-6 animate-rise-2">
            <Callout tone="accent" title="You have an exam in progress">
              <p>
                Saved {new Date(saved.updatedAt).toLocaleString()} · {saved.mode === "full" ? "Full exam" : "Single section"} · section {saved.sectionIndex + 1} of{" "}
                {saved.sectionIds.length} · {Object.values(saved.answers ?? {}).filter(isAnswered).length} answered · {formatClock(saved.remainingSeconds)} left in the current section.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={resumeExam}>
                  Resume <Arrow />
                </Button>
                <Button onClick={discardSaved} variant="secondary">
                  Discard and start over
                </Button>
              </div>
            </Callout>
          </div>
        )}

        <Card className="mt-6 animate-rise-2" padding="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Sections</caption>
              <thead className="text-left text-muted text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-5 sm:px-6 py-2 font-medium">Section</th>
                  <th className="px-3 py-2 font-medium text-right">Questions</th>
                  <th className="px-5 sm:px-6 py-2 font-medium text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                {exam.sections.map((s, i) => (
                  <tr key={s.id} className="border-t border-line">
                    <td className="px-5 sm:px-6 py-2.5">
                      <span className="flex items-start gap-2.5">
                        <span className="inline-grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-2 border border-line text-xs font-semibold tabular-nums">{i + 1}</span>
                        <span className="min-w-0">
                          <span className="block font-medium">{sectionGloss(s)}</span>
                          <span lang="ja" className="ja block text-xs text-muted">
                            {s.name}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{countQuestions(s.questionIds)}</td>
                    <td className="px-5 sm:px-6 py-2.5 text-right tabular-nums">{Math.round(s.timeLimitSeconds / 60)} min</td>
                  </tr>
                ))}
                <tr className="border-t border-line-strong font-semibold bg-bg-elev">
                  <td className="px-5 sm:px-6 py-2.5">Total</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{totalQ}</td>
                  <td className="px-5 sm:px-6 py-2.5 text-right tabular-nums">{totalMin} min</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        {/* One filled button; "Start one section" is a text link that reveals the section picker. */}
        <div className="mt-5 animate-rise-3">
          {mode === "single" && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <label htmlFor="exam-section" className="text-sm font-medium">
                Section
              </label>
              <select
                id="exam-section"
                className="h-10 w-full sm:max-w-sm rounded-xl border border-line bg-surface px-3 text-sm focus:border-accent focus:outline-none focus:shadow-ring"
                value={singleSection}
                onChange={(e) => setSingleSection(e.target.value)}
              >
                {exam.sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {sectionGloss(s)} ({s.name}) · {Math.round(s.timeLimitSeconds / 60)} min
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-4">
            <Button onClick={startExam} disabled={!uid || (mode === "single" && !singleSec)} size="lg">
              {saved ? "Start a new attempt" : mode === "full" ? "Start full exam" : `Start ${singleSec ? sectionGloss(singleSec) : "section"}`}
              <Arrow />
            </Button>
            {mode === "full" ? (
              <button type="button" className="text-sm text-accent hover:underline" onClick={() => setMode("single")}>
                Start one section instead
              </button>
            ) : (
              <button type="button" className="text-sm text-accent hover:underline" onClick={() => setMode("full")}>
                Start the full exam instead
              </button>
            )}
          </div>
          {!uid && <p className="mt-2 text-sm text-warn">Sign-in has not finished loading on this device, so the exam cannot be saved yet.</p>}
        </div>

        <details className="mt-6 group surface rounded-2xl">
          <summary className="cursor-pointer list-none px-5 sm:px-6 py-4 font-semibold flex items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
            Exam rules
            <svg aria-hidden className="h-4 w-4 text-muted transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </summary>
          <ul className="px-5 sm:px-6 pb-5 space-y-2 text-sm text-ink-2">
            {[
              "Each section has its own countdown. When it reaches zero the section is submitted automatically, even if questions are unanswered.",
              "You can move freely between questions inside a section and flag questions to revisit. You cannot return to a finished section.",
              "Listening scripts are hidden; press “Play script” to hear them read aloud by a synthetic voice. Replay as often as you like.",
              "Progress is saved on this device every second. If the page reloads or you go offline, come back here and press Resume.",
              "Scoring follows the JLPT scale: each section is scaled to 60 points (180 total). Pass estimate: 90 or more overall and at least 19 in every section.",
            ].map((r, i) => (
              <li key={i} className="flex gap-3">
                <span className="inline-grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-2 border border-line text-xs font-semibold text-muted tabular-nums">{i + 1}</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </details>
      </div>
    );
  }

  if (screen === "saving") {
    return (
      <div className="py-16 max-w-content mx-auto text-center" role="status" aria-live="polite">
        {liveRegion}
        <div className="mx-auto h-14 w-14 rounded-full border-4 border-line border-t-accent animate-spin" aria-hidden />
        <p className="mt-5 text-lg font-semibold">Scoring your exam…</p>
        <p className="mt-1 text-sm text-muted">Saving the result to your history.</p>
      </div>
    );
  }

  if (screen === "error") {
    return (
      <div className="py-10 max-w-content mx-auto">
        {liveRegion}
        <Callout tone="warn" title="Could not save the result">
          <p>{errorMsg}</p>
          <div className="mt-3 flex gap-2">
            <Button onClick={() => void finishExam(answers, elapsedBySection, sectionIds, mode)}>Try again</Button>
          </div>
        </Callout>
      </div>
    );
  }

  if (screen === "break" && currentSection) {
    const nextSection = sectionsById.get(sectionIds[sectionIndex + 1] ?? "");
    const answered = sectionQuestions.filter((q) => isAnswered(answers[q.id])).length;
    return (
      <div className="py-10 max-w-content mx-auto animate-rise">
        {liveRegion}
        <Badge tone="ok" size="md">
          Section {sectionIndex + 1} of {sectionIds.length} complete
        </Badge>
        <h1 className="mt-3 text-h1 ja" lang="ja">
          {currentSection.name}
        </h1>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Stat label="Answered" value={`${answered} / ${sectionQuestions.length}`} tone={answered === sectionQuestions.length ? "ok" : "neutral"} />
          <Stat label="Time used" value={formatClock(elapsedBySection[currentSection.id] ?? 0)} />
        </div>
        <p className="mt-3 text-sm text-muted">Answers in this section are locked.</p>
        {nextSection && (
          <Card className="mt-6">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-accent">Up next</p>
            <h2 className="mt-1 text-h2 ja" lang="ja">
              {nextSection.name}
            </h2>
            <p className="mt-1.5 text-sm text-muted">
              {countQuestions(nextSection.questionIds)} questions · {Math.round(nextSection.timeLimitSeconds / 60)} minutes. The clock starts when you press the button.
            </p>
            <div className="mt-4">
              <Button onClick={startNextSection} size="lg">
                Start next section <Arrow />
              </Button>
            </div>
          </Card>
        )}
      </div>
    );
  }

  if ((screen === "running" || screen === "confirm-submit") && currentSection && currentQuestion) {
    const answer = answers[currentQuestion.id];
    const answered = isAnswered(answer);
    const isFlagged = flagged.includes(currentQuestion.id);
    const isListening = currentQuestion.skill === "listening";
    const hasContext = Boolean(currentQuestion.context && currentQuestion.context.trim());
    const unanswered = sectionQuestions.filter((q) => !isAnswered(answers[q.id])).length;
    const lastSection = sectionIndex >= sectionIds.length - 1;
    const low = remaining <= 60;
    const warn = remaining <= 300;
    const answeredCount = sectionQuestions.length - unanswered;
    const flaggedCount = flagged.filter((id) => sectionQuestions.some((q) => q.id === id)).length;

    const navigator = (
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-wider text-muted">Questions</p>
          <p className="text-xs text-muted tabular-nums">
            {answeredCount}/{sectionQuestions.length}
          </p>
        </div>
        <ol className="mt-2.5 grid grid-cols-6 sm:grid-cols-10 lg:grid-cols-5 gap-1.5">
          {sectionQuestions.map((q, i) => {
            const done = isAnswered(answers[q.id]);
            const fl = flagged.includes(q.id);
            const cur = i === questionIndex;
            return (
              <li key={q.id}>
                <button
                  type="button"
                  onClick={() => {
                    goTo(i);
                    setNavOpen(false);
                  }}
                  aria-current={cur ? "true" : undefined}
                  aria-label={`Question ${i + 1}${done ? ", answered" : ", unanswered"}${fl ? ", flagged" : ""}`}
                  className={`relative h-9 w-full rounded-lg border text-sm tabular-nums font-medium transition ${
                    cur ? "border-accent shadow-ring" : "border-line hover:border-line-strong"
                  } ${done ? "bg-accent-soft text-accent-ink" : "bg-surface text-ink-2"}`}
                >
                  {i + 1}
                  {fl && <span aria-hidden="true" className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-warn ring-2 ring-surface" />}
                </button>
              </li>
            );
          })}
        </ol>
        <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
          <li className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-accent-soft border border-accent/30" aria-hidden /> answered
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-surface border border-line" aria-hidden /> open
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-warn" aria-hidden /> flagged
          </li>
        </ul>
        <p className="mt-3 text-xs text-muted tabular-nums">
          {answeredCount} answered · {unanswered} left · {flaggedCount} flagged
        </p>
        <p className="mt-2 hidden sm:flex flex-wrap items-center gap-1 text-[11px] text-muted">
          <Kbd>1</Kbd>–<Kbd>6</Kbd> answer <Kbd>←</Kbd>
          <Kbd>→</Kbd> move <Kbd>F</Kbd> flag
        </p>
      </div>
    );

    return (
      <div className="py-4 sm:py-6 pb-16">
        {liveRegion}
        {/* Exam bar */}
        <div className="sticky top-16 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2.5 glass border-b border-line">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-muted truncate">
                Section {sectionIndex + 1}/{sectionIds.length} · <span lang="ja">{currentSection.name}</span>
              </p>
              <p className="text-sm font-semibold tabular-nums">
                Question {questionIndex + 1} <span className="text-muted font-normal">of {sectionQuestions.length}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleFlag}
                aria-pressed={isFlagged}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 h-9 text-xs font-medium transition ${isFlagged ? "border-warn bg-warn-soft text-warn" : "border-line bg-surface hover:bg-surface-2"}`}
              >
                <FlagIcon filled={isFlagged} />
                <span className="hidden sm:inline">{isFlagged ? "Flagged" : "Flag"}</span>
              </button>
              <button
                type="button"
                onClick={() => setNavOpen(true)}
                aria-label="Open question navigator"
                className="lg:hidden inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 h-9 text-xs font-medium hover:bg-surface-2"
              >
                <GridIcon />
                <span className="tabular-nums">
                  {answeredCount}/{sectionQuestions.length}
                </span>
              </button>
              <div
                role="timer"
                aria-label={`Time remaining ${formatClock(remaining)}`}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 h-9 font-mono text-base sm:text-lg tabular-nums border ${
                  low ? "bg-warn text-white border-transparent animate-pulse" : warn ? "bg-warn-soft text-warn border-transparent" : "bg-surface-2 border-line"
                }`}
              >
                <ClockIcon />
                {formatClock(remaining)}
              </div>
            </div>
          </div>
          <div className="mt-2 h-1 rounded-full bg-surface-2 overflow-hidden" aria-hidden>
            <div className={`h-full rounded-full transition-[width] duration-500 ${warn ? "bg-warn" : "accent-gradient"}`} style={{ width: `${(remaining / Math.max(1, currentSection.timeLimitSeconds)) * 100}%` }} />
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <Card className="order-1 min-w-0 animate-rise" padding="p-4 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{typeLabel(currentQuestion)}</Badge>
              <Badge>{currentQuestion.skill}</Badge>
              {isFlagged && <Badge tone="warn">Flagged for review</Badge>}
            </div>

            {hasContext && !isListening && (
              <div lang="ja" className="ja mt-4 rounded-xl border border-line bg-bg-elev p-4 text-base leading-relaxed whitespace-pre-line max-h-[50vh] overflow-y-auto">
                {currentQuestion.context}
              </div>
            )}

            {hasContext && isListening && (
              <div className="mt-4 rounded-xl border border-line bg-bg-elev p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={playScript} variant={speaking ? "secondary" : "primary"} ariaLabel={speaking ? "Stop script" : "Play script using text to speech"}>
                    {speaking ? "■ Stop" : "▶ Play script (TTS)"}
                  </Button>
                  <Button variant="secondary" onClick={() => setShowScript((v) => !v)} disabled={!answered}>
                    {showScript ? "Hide script" : "Show script"}
                  </Button>
                  {!answered && <span className="text-xs text-muted">Script unlocks after you answer.</span>}
                  {ttsUnavailable && <span className="text-xs text-warn">Text-to-speech is not available in this browser.</span>}
                </div>
                {showScript && answered && (
                  <div lang="ja" className="ja mt-3 text-base leading-relaxed whitespace-pre-line border-t border-line pt-3">
                    {currentQuestion.context}
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 flex items-start gap-2">
              <PromptText text={currentQuestion.prompt} className="flex-1 min-w-0" />
              {JA_RE.test(currentQuestion.prompt) && <SpeakButton text={currentQuestion.prompt} size="sm" className="mt-1" />}
            </div>
            {currentQuestion.type === "ordering" && <p className="mt-2 text-xs text-muted">The chunks below fill the blanks in order. Choose the chunk that belongs in the ★ position.</p>}

            <div role="radiogroup" aria-label="Answer options" className="mt-5 grid gap-2">
              {currentQuestion.options.map((opt, i) => {
                const chosen = answer?.selectedIndex === i;
                return (
                  <div key={i} className="flex items-start gap-2">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={chosen}
                      onClick={() => select(i)}
                      className={`flex flex-1 min-w-0 items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition focus:outline-none focus-visible:shadow-ring ${
                        chosen ? "border-accent bg-accent-soft shadow-ring" : "border-line bg-surface hover:border-line-strong hover:bg-surface-2"
                      }`}
                    >
                      <span className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs font-semibold tabular-nums ${chosen ? "bg-accent text-white border-accent" : "bg-surface-2 border-line text-muted"}`} aria-hidden>
                        {i + 1}
                      </span>
                      <span lang="ja" className="ja text-base sm:text-lg">
                        {opt}
                      </span>
                    </button>
                    {JA_RE.test(opt) && <SpeakButton text={opt} size="xs" className="mt-3" />}
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => goTo(questionIndex - 1)} disabled={questionIndex === 0}>
                  ← Previous
                </Button>
                <Button variant="secondary" onClick={() => goTo(questionIndex + 1)} disabled={questionIndex >= sectionQuestions.length - 1}>
                  Next →
                </Button>
              </div>
              <Button onClick={() => setScreen("confirm-submit")} variant={questionIndex >= sectionQuestions.length - 1 ? "primary" : "ghost"}>
                {lastSection ? "Submit exam" : "Submit section"}
              </Button>
            </div>
          </Card>

          <nav aria-label="Question navigator" className="order-2 hidden lg:block">
            <Card padding="p-4" className="sticky top-[7.5rem]">
              {navigator}
            </Card>
          </nav>
        </div>

        {navOpen && (
          <div role="dialog" aria-modal="true" aria-label="Question navigator" className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 p-0 sm:p-4 lg:hidden">
            <button type="button" className="absolute inset-0 cursor-default" aria-label="Close navigator" onClick={() => setNavOpen(false)} />
            <Card className="relative w-full sm:max-w-md rounded-b-none sm:rounded-b-2xl max-h-[80vh] overflow-y-auto animate-rise" padding="p-5">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong sm:hidden" aria-hidden />
              {navigator}
              <div className="mt-4">
                <Button variant="secondary" onClick={() => setNavOpen(false)} className="w-full">
                  Close
                </Button>
              </div>
            </Card>
          </div>
        )}

        {screen === "confirm-submit" && (
          <div role="dialog" aria-modal="true" aria-labelledby="submit-title" className="fixed inset-0 z-30 flex items-end sm:items-center justify-center bg-black/40 p-4">
            <Card className="w-full max-w-md shadow-lg animate-rise">
              <h2 id="submit-title" className="text-lg font-semibold">
                {lastSection ? "Submit the exam?" : "Submit this section?"}
              </h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Stat label="Unanswered" value={unanswered} tone={unanswered > 0 ? "accent" : "ok"} />
                <Stat label="Remaining" value={formatClock(remaining)} />
              </div>
              <p className="mt-3 text-sm text-muted">
                {unanswered > 0 ? `${unanswered} question${unanswered === 1 ? "" : "s"} unanswered — they will be marked wrong. ` : "All questions answered. "}
                You cannot return to this section afterwards.
              </p>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <Button variant="secondary" onClick={() => setScreen("running")}>
                  Keep working
                </Button>
                <Button onClick={() => endSection(false)}>Submit</Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="py-10">
      {liveRegion}
      <p className="text-muted">This section has no questions loaded.</p>
      <div className="mt-3">
        <Button href="/mock-exams" variant="secondary">
          Back to exams
        </Button>
      </div>
    </div>
  );
}
