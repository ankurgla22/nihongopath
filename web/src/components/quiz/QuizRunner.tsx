"use client";
/**
 * Reusable quiz runner used by daily study, review sessions, the tests hub and lessons.
 *
 * - Practice mode: feedback (explanation + distractor explanations) after each answer.
 * - Test mode: no feedback until the final screen.
 * - Question types: mc, cloze (both plain choices) and ordering (chunks; pick the ★ chunk).
 * - Sticky progress "3 / 10", keyboard shortcuts 1–6 / Enter (hint shown on the first question only), accessible radio group.
 * - In-progress answers are persisted in localStorage under `storageKey` so a refresh does not
 *   lose them; cleared when the quiz completes.
 * - Final screen: score, one line, compact list of wrong questions grouped by lesson with
 *   "Review this grammar/word/kanji" links from `contentLinks`; ids missing from that map are
 *   resolved on demand from /api/content/resolve once the result screen is shown.
 *
 * `onComplete` may be async; while it runs the runner shows "Saving…". If it throws an error
 * with `queued: true` (the study service's offline fallback) the runner shows a
 * "Saved offline — will sync" notice instead of failing.
 */
import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import type { Question } from "@/lib/content/schemas";
import { questionContentIds, scoreQuiz, type SubmittedAnswer } from "@/lib/engine/scoring";
import { fetchContentLinks } from "@/lib/questions/client";
import { JA_RE, isQueuedError, type ContentLinks } from "@/components/study/helpers";
import { Arrow, Button, Callout, Kbd, SpeakButton } from "@/components/ui";
import { Ring } from "@/components/progress/shared";
import { cleanNote, wrongOptionNotes } from "@/lib/questions/notes";

export type QuizRunnerProps = {
  questions: Question[];
  title: string;
  onComplete: (answers: SubmittedAnswer[], totalSeconds: number) => void | Promise<void>;
  mode?: "practice" | "test";
  /** localStorage key for in-progress answers. Omit to disable persistence. */
  storageKey?: string;
  /** Pre-resolved lesson links keyed by content id, for the wrong-answer list (missing ids are fetched on demand). */
  contentLinks?: ContentLinks;
  /** Extra actions rendered on the result screen (e.g. "Back to today's plan"). */
  resultActions?: ReactNode;
  /** Called when the learner leaves before finishing. */
  onExit?: () => void;
};

type Saved = { index: number; answers: SubmittedAnswer[]; questionIds: string[] };

function readSaved(key: string | undefined, questionIds: string[]): Saved | null {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const s = JSON.parse(raw) as Saved;
    if (!Array.isArray(s.answers) || s.questionIds?.join("|") !== questionIds.join("|")) return null;
    return s;
  } catch {
    return null;
  }
}

function writeSaved(key: string | undefined, s: Saved) {
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(s));
  } catch {
    /* storage unavailable */
  }
}

function clearSaved(key: string | undefined) {
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function linkVerb(type?: string): string {
  switch (type) {
    case "grammar":
      return "Review this grammar";
    case "vocabulary":
      return "Review this word";
    case "kanji":
      return "Review this kanji";
    case "reading":
      return "Re-read this passage";
    case "listening":
      return "Replay this exercise";
    default:
      return "Review";
  }
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-4 w-4 ${className}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m5 12 5 5L20 7" />
    </svg>
  );
}

function CrossIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-4 w-4 ${className}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

/** Render a prompt, highlighting the ★ slot for ordering questions. */
function Prompt({ text, highlightStar }: { text: string; highlightStar: boolean }) {
  const cls = "ja mt-4 text-xl sm:text-2xl leading-relaxed whitespace-pre-line font-medium text-ink";
  if (!highlightStar || !text.includes("★")) {
    return (
      <p lang="ja" className={cls}>
        {text}
      </p>
    );
  }
  const parts = text.split("★");
  return (
    <p lang="ja" className={cls}>
      {parts.map((p, i) => (
        <span key={i}>
          {p}
          {i < parts.length - 1 && (
            <span className="mx-0.5 inline-block rounded-md bg-accent-soft px-2 text-accent font-semibold" aria-label="star slot">
              ★
            </span>
          )}
        </span>
      ))}
    </p>
  );
}

export function QuizRunner({ questions, title, onComplete, mode = "practice", storageKey, contentLinks = {}, resultActions, onExit }: QuizRunnerProps) {
  const questionIds = useMemo(() => questions.map((q) => q.id), [questions]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<SubmittedAnswer[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [restored, setRestored] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [finished, setFinished] = useState(false);
  const [saveState, setSaveState] = useState<{ status: "saving" | "saved" | "queued" | "error"; message?: string } | null>(null);
  const [fetchedLinks, setFetchedLinks] = useState<ContentLinks>({});

  // Resolve lesson links for wrong answers that the page did not pre-resolve.
  useEffect(() => {
    if (!finished) return;
    const byId = new Map(questions.map((x) => [x.id, x]));
    const missing = scoreQuiz(questions, answers)
      .answers.filter((a) => !a.correct)
      .flatMap((a) => {
        const wq = byId.get(a.questionId);
        return wq ? questionContentIds(wq) : [];
      })
      .filter((id) => !contentLinks[id]);
    if (missing.length === 0) return;
    let cancelled = false;
    fetchContentLinks(missing)
      .then((links) => {
        if (!cancelled) setFetchedLinks((prev) => ({ ...prev, ...links }));
      })
      .catch(() => {
        /* links are a convenience; the result screen works without them */
      });
    return () => {
      cancelled = true;
    };
  }, [finished, questions, answers, contentLinks]);
  const startRef = useRef<number>(Date.now());
  const groupId = useId();

  // Restore in-progress answers once on mount.
  useEffect(() => {
    const s = readSaved(storageKey, questionIds);
    if (s && s.answers.length > 0 && s.answers.length < questionIds.length) {
      setAnswers(s.answers);
      setIndex(Math.min(s.answers.length, questionIds.length - 1));
      setRestored(true);
    }
    startRef.current = Date.now();
    setHydrated(true);
  }, [storageKey, questionIds]);

  const total = questions.length;
  const q = questions[Math.min(index, Math.max(0, total - 1))];

  const finish = useCallback(
    async (all: SubmittedAnswer[]) => {
      setFinished(true);
      clearSaved(storageKey);
      const totalSeconds = all.reduce((n, a) => n + a.seconds, 0);
      setSaveState({ status: "saving" });
      try {
        await onComplete(all, totalSeconds);
        setSaveState({ status: "saved" });
      } catch (err) {
        if (isQueuedError(err)) setSaveState({ status: "queued", message: "Saved offline — will sync when you are back online." });
        else setSaveState({ status: "error", message: err instanceof Error ? err.message : "Could not save this result." });
      }
    },
    [onComplete, storageKey]
  );

  const commit = useCallback(
    (choice: number | null) => {
      if (!q) return;
      const seconds = Math.max(0, Math.round((Date.now() - startRef.current) / 1000));
      const next = [...answers, { questionId: q.id, selectedIndex: choice, seconds }];
      setAnswers(next);
      if (next.length >= total) {
        void finish(next);
        return;
      }
      writeSaved(storageKey, { index: next.length, answers: next, questionIds });
      setIndex(next.length);
      setSelected(null);
      setRevealed(false);
      startRef.current = Date.now();
    },
    [q, answers, total, finish, storageKey, questionIds]
  );

  const choose = useCallback(
    (idx: number) => {
      if (revealed) return;
      setSelected(idx);
      if (mode === "practice") setRevealed(true);
    },
    [revealed, mode]
  );

  const advance = useCallback(() => {
    if (mode === "practice") {
      if (revealed) commit(selected);
    } else if (selected !== null) commit(selected);
  }, [mode, revealed, selected, commit]);

  // Keyboard shortcuts: 1–6 choose, Enter advances, arrows move selection (test mode).
  useEffect(() => {
    if (finished || !q) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const n = Number(e.key);
      if (n >= 1 && n <= q.options.length) {
        e.preventDefault();
        choose(n - 1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        advance();
      } else if (!revealed && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        const cur = selected ?? -1;
        const nxt = e.key === "ArrowDown" ? (cur + 1) % q.options.length : (cur - 1 + q.options.length) % q.options.length;
        setSelected(nxt);
        if (mode === "practice") setRevealed(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finished, q, choose, advance, revealed, selected, mode]);

  if (total === 0) {
    return (
      <div className="surface rounded-2xl p-6 text-center" role="status">
        <div className="mx-auto h-12 w-12 rounded-2xl bg-surface-2 grid place-items-center ja text-xl text-muted mb-3">空</div>
        <p className="font-semibold">No questions available for this set yet.</p>
        {onExit && (
          <div className="mt-4">
            <Button variant="secondary" onClick={onExit}>
              Back
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (!hydrated) {
    return (
      <div className="surface rounded-2xl p-5 sm:p-6" role="status" aria-busy="true">
        <span className="sr-only">Loading quiz…</span>
        <div className="flex items-center justify-between gap-3" aria-hidden>
          <div className="skeleton h-4 w-32" />
          <div className="skeleton h-6 w-16 rounded-full" />
        </div>
        <div className="skeleton mt-5 h-7 w-3/4" aria-hidden />
        <div className="mt-5 space-y-2" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-12 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // ---------- Result screen ----------
  if (finished) {
    const score = scoreQuiz(questions, answers);
    const byId = new Map(questions.map((x) => [x.id, x]));
    const wrong = score.answers.filter((a) => !a.correct);
    const accuracy = Math.round(score.accuracy * 100);
    const tone = accuracy === 100 ? "ok" : accuracy >= 70 ? "accent" : "warn";
    // Group wrong answers by the first lesson they link to, so each lesson gets one "Review" link
    // followed by compact rows instead of one card per question repeating the same link.
    type WrongItem = { a: (typeof wrong)[number]; wq: Question; n: number };
    const groups: { key: string; link?: { href: string; title: string; type?: string }; items: WrongItem[] }[] = [];
    wrong.forEach((a, i) => {
      const wq = byId.get(a.questionId);
      if (!wq) return;
      const link = questionContentIds(wq)
        .map((id) => contentLinks[id] ?? fetchedLinks[id])
        .find((l) => l);
      const key = link ? link.href : "__other";
      let g = groups.find((x) => x.key === key);
      if (!g) {
        g = { key, link, items: [] };
        groups.push(g);
      }
      g.items.push({ a, wq, n: i + 1 });
    });
    return (
      <div className="surface rounded-2xl p-5 sm:p-7 animate-rise" role="status" aria-live="polite">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
          <Ring value={accuracy} size={132} stroke={11} tone={tone} label="Score">
            <div>
              <p className="text-3xl font-semibold tabular-nums tracking-tight leading-none">{score.score}</p>
              <p className="text-xs text-muted mt-1">of {score.total}</p>
            </div>
          </Ring>
          <div className="text-center sm:text-left min-w-0">
            <h2 className="text-h2">{accuracy === 100 ? "Perfect score" : accuracy >= 70 ? "Well done" : "Keep going"}</h2>
            <p className="mt-1.5 text-sm text-ink-2 max-w-prose">
              {accuracy === 100
                ? "These items move further along in your review schedule."
                : accuracy >= 70
                  ? "Items you missed are back in your review queue for tomorrow."
                  : "Re-read the lessons linked below, then try the review again."}
            </p>
            {saveState && (
              <p className={`mt-2 text-xs ${saveState.status === "error" ? "text-warn" : "text-muted"}`}>
                {saveState.status === "saving" && (
                  <span className="inline-flex items-center gap-2">
                    <span className="skeleton h-3 w-3 rounded-full" aria-hidden /> Saving your result…
                  </span>
                )}
                {saveState.status === "saved" && "Result saved."}
                {(saveState.status === "queued" || saveState.status === "error") && saveState.message}
              </p>
            )}
          </div>
        </div>

        {wrong.length > 0 && (
          <section className="mt-6" aria-labelledby={`${groupId}-wrong`}>
            <h3 id={`${groupId}-wrong`} className="font-semibold">
              Revisit <span className="text-muted font-normal tabular-nums">· {wrong.length}</span>
            </h3>
            <div className="mt-3 space-y-3">
              {groups.map((g) => (
                <div key={g.key}>
                  {g.link ? (
                    <Link href={g.link.href} className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
                      {linkVerb(g.link.type)}: <span lang="ja">{g.link.title}</span>
                      <Arrow className="h-3 w-3" />
                    </Link>
                  ) : (
                    <p className="text-xs font-medium text-muted">Mixed items</p>
                  )}
                  <ol className="mt-1 divide-y divide-line">
                    {g.items.map(({ a, wq, n }) => (
                      <li key={a.questionId} className="py-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm">
                        <span className="text-[11px] text-muted tabular-nums">{n}.</span>
                        <span lang="ja" className="ja min-w-0 flex-1 basis-48 whitespace-pre-line">
                          {wq.prompt}
                        </span>
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                          <span lang="ja" className="ja text-warn">
                            {a.selectedIndex === null ? "(skipped)" : wq.options[a.selectedIndex]}
                          </span>
                          <Arrow className="h-3 w-3 text-muted" />
                          <span lang="ja" className="ja font-medium text-ok">
                            {wq.options[wq.answerIndex]}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </section>
        )}

        {resultActions && <div className="mt-6 flex flex-wrap gap-2">{resultActions}</div>}
      </div>
    );
  }

  // ---------- Question screen ----------
  const perOption = q.distractorExplanations.length === q.options.length;
  const wrongNotes = wrongOptionNotes(q.distractorExplanations, q.answerIndex, q.options.length);
  const isCorrect = revealed && selected === q.answerIndex;
  const canAdvance = mode === "practice" ? revealed : selected !== null;
  const dense = total > 20;

  return (
    <div className="surface rounded-2xl overflow-hidden">
      {/* Sticky progress */}
      <div className="sticky top-16 z-[5] border-b border-line bg-bg-elev px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between gap-x-4">
          <span className="sr-only">{title}</span>
          <span className="text-sm font-semibold tabular-nums" aria-live="polite">
            {index + 1} / {total}
          </span>
        </div>
        <div className={`mt-2.5 flex ${dense ? "gap-0.5" : "gap-1"}`} role="progressbar" aria-valuenow={index} aria-valuemin={0} aria-valuemax={total} aria-label="Quiz progress">
          {questions.map((_, i) => {
            const state = i < index ? "done" : i === index ? "current" : "todo";
            return (
              <span
                key={i}
                aria-hidden
                className={`h-1.5 flex-1 rounded-full transition-colors ${state === "done" ? "accent-gradient" : state === "current" ? "bg-accent/40 ring-1 ring-accent/60" : "bg-surface-2 border border-line/60"}`}
              />
            );
          })}
        </div>
      </div>

      <div className="p-4 sm:p-6">
        {restored && index > 0 && (
          <p className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-muted" role="status">
            Resumed from question {index + 1} — your earlier answers were kept.
          </p>
        )}

        {q.context && (
          <div lang="ja" className="ja mt-4 max-h-[40vh] overflow-y-auto rounded-xl border border-line bg-bg-elev p-4 text-base leading-relaxed whitespace-pre-line">
            {q.context}
          </div>
        )}

        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <Prompt text={q.prompt} highlightStar={q.type === "ordering"} />
          </div>
          {JA_RE.test(q.prompt) && <SpeakButton text={q.prompt} size="sm" className="mt-5" />}
        </div>
        {q.type === "ordering" && (
          <p className="mt-1.5 text-sm text-muted">
            Arrange the chunks into a natural sentence and choose the one that goes in the <span className="text-accent font-semibold">★</span> position.
          </p>
        )}
        {q.type === "cloze" && <p className="mt-1.5 text-sm text-muted">Choose the word that best fills the blank.</p>}

        <div role="radiogroup" aria-label="Answer options" className="mt-5 grid gap-2">
          {q.options.map((opt, idx) => {
            let state: "idle" | "selected" | "correct" | "incorrect" | "dim" = "idle";
            if (revealed) {
              if (idx === q.answerIndex) state = "correct";
              else if (idx === selected) state = "incorrect";
              else state = "dim";
            } else if (idx === selected) state = "selected";
            const cls = {
              idle: "border-line bg-surface hover:border-line-strong hover:bg-surface-2 hover:-translate-y-px",
              selected: "border-accent bg-accent-soft shadow-ring",
              correct: "border-ok bg-ok-soft",
              incorrect: "border-warn bg-warn-soft",
              dim: "border-line bg-surface opacity-60",
            }[state];
            return (
              <button
                key={idx}
                type="button"
                role="radio"
                aria-checked={selected === idx}
                onClick={() => choose(idx)}
                disabled={revealed}
                className={`group flex w-full min-w-0 items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition disabled:cursor-default focus:outline-none focus-visible:shadow-ring ${cls}`}
              >
                <span className="mt-0.5 shrink-0">
                  <Kbd>{idx + 1}</Kbd>
                </span>
                <span className="min-w-0 flex-1">
                  <span lang="ja" className={`ja text-base sm:text-lg ${q.type === "ordering" ? "rounded-md bg-surface-2 px-2 py-0.5" : ""}`}>
                    {opt}
                  </span>
                  {revealed && perOption && idx !== q.answerIndex && q.distractorExplanations[idx] && <span className="block mt-1 text-sm text-muted">{cleanNote(q.distractorExplanations[idx])}</span>}
                </span>
                <span className="mt-0.5 shrink-0 w-4">
                  {state === "correct" && <CheckIcon className="text-ok" />}
                  {state === "incorrect" && <CrossIcon className="text-warn" />}
                </span>
              </button>
            );
          })}
        </div>
        {/* Keyboard hint: desktop only, and only on the first question. */}
        {index === 0 && (
          <p className="mt-2.5 hidden sm:flex items-center gap-1.5 text-xs text-muted">
            Press <Kbd>1</Kbd>–<Kbd>{q.options.length}</Kbd> to choose, <Kbd>Enter</Kbd> to continue.
          </p>
        )}

        {revealed && (
          <div className="mt-4 animate-rise">
            <Callout tone={isCorrect ? "ok" : "warn"} icon={isCorrect ? <CheckIcon className="text-ok" /> : <CrossIcon className="text-warn" />} title={isCorrect ? "Correct" : "Not quite"}>
              <p>{q.explanation}</p>
              {!perOption && wrongNotes.length > 0 && (
                <ul className="mt-2 space-y-1 text-muted list-disc pl-5">
                  {wrongNotes.map((d) => (
                    <li key={d.index}>{d.text}</li>
                  ))}
                </ul>
              )}
            </Callout>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <Button onClick={advance} disabled={!canAdvance}>
            {index + 1 < total ? "Next question" : "Finish"}
            <Arrow />
          </Button>
          {mode === "test" && (
            <Button variant="secondary" onClick={() => commit(null)}>
              Skip
            </Button>
          )}
          {onExit && (
            <button
              type="button"
              className="ml-auto text-sm text-muted hover:text-ink hover:underline"
              onClick={() => {
                // Answers so far are already in localStorage (writeSaved on each commit), so leaving is safe.
                if (answers.length === 0 || window.confirm("Leave the quiz? Your answers so far are kept for next time.")) onExit();
              }}
            >
              Exit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
