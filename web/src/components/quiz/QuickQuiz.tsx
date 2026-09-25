"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Arrow, Button } from "@/components/ui";
import { scrollUnderHeader } from "@/lib/ui/scrollUnderHeader";
import { QUIZ_LENGTH, type QuizQuestion } from "@/lib/quiz/shared";

/**
 * The public ten-question quiz: pick, answer, see why, go again.
 *
 * Two things shape the design. It has no account behind it, so nothing is saved to a server and
 * nothing is asked for — the whole loop has to pay off inside one visit. And it is usually
 * someone's first page on the site, arriving from a search, so the reward has to be immediate: the
 * answer is marked at once, the explanation appears with it, the streak counts up.
 *
 * The ten questions are drawn in the browser from a larger pool the server rendered, so "new
 * questions" really is new without the page becoming dynamic. Nothing here touches the network.
 */
function shuffle<T>(items: T[], rnd: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Answered = { q: QuizQuestion; chosen: number; correct: boolean };

export type QuizLink = { href: string; label: string };

export function QuickQuiz({
  pool,
  initial,
  title,
  studyHref,
  bestKey,
  nextUp = [],
}: {
  pool: QuizQuestion[];
  /** The first round, chosen on the server so the page arrives with a real question in it. */
  initial: QuizQuestion[];
  title: string;
  studyHref: string;
  /** localStorage key for the best score here. Omit and the quiz keeps no memory. */
  bestKey?: string;
  /** Other quizzes to offer once this one is done. */
  nextUp?: QuizLink[];
}) {
  // The first round is the server's, so the page is never a blank card and a crawler sees a real
  // question. Every later round is drawn in the browser, which keeps the page static.
  const [questions, setQuestions] = useState<QuizQuestion[]>(initial);
  const [round, setRound] = useState(0);
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Answered[]>([]);
  const [best, setBest] = useState<number | null>(null);
  const [beatenBest, setBeatenBest] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const afterAnswerRef = useRef<HTMLDivElement>(null);

  const draw = useCallback((from?: QuizQuestion[]) => {
    const source = from ?? pool;
    const picked = shuffle(source, Math.random).slice(0, Math.min(QUIZ_LENGTH, source.length));
    // Easiest first, so a round has a shape instead of opening on its hardest item.
    picked.sort((a, b) => a.difficulty - b.difficulty);
    setQuestions(picked);
    setIndex(0);
    setChosen(null);
    setAnswers([]);
    setBeatenBest(false);
  }, [pool]);

  // Round 0 is the server's; only redraw when the player asks for more.
  useEffect(() => { if (round > 0) draw(); }, [draw, round]);

  // The best score lives in this browser only. Wrapped because storage throws in private windows.
  useEffect(() => {
    if (!bestKey) return;
    try {
      const raw = window.localStorage.getItem(bestKey);
      if (raw !== null) setBest(Number(raw) || 0);
    } catch { /* storage unavailable: the quiz simply has no memory */ }
  }, [bestKey]);

  const q = questions[index];
  const finished = index >= questions.length;
  const score = answers.filter((a) => a.correct).length;

  const streak = useMemo(() => {
    let run = 0;
    for (const a of answers) run = a.correct ? run + 1 : 0;
    return run;
  }, [answers]);

  // The run a wrong answer just broke, so losing one can be acknowledged rather than silent.
  const lostStreak = useMemo(() => {
    if (answers.length === 0 || answers[answers.length - 1].correct) return 0;
    let run = 0;
    for (let i = answers.length - 2; i >= 0 && answers[i].correct; i--) run++;
    return run;
  }, [answers]);

  const bestStreak = useMemo(() => {
    let b = 0, run = 0;
    for (const a of answers) { run = a.correct ? run + 1 : 0; b = Math.max(b, run); }
    return b;
  }, [answers]);

  useEffect(() => {
    if (!finished || !bestKey) return;
    const prev = best ?? 0;
    if (score > prev) {
      setBeatenBest(prev > 0);
      setBest(score);
      try { window.localStorage.setItem(bestKey, String(score)); } catch { /* ignore */ }
    }
  }, [finished, bestKey, score, best, questions]);

  // Only reposition when a round starts. Doing it on every question re-ran the settle loop and
  // produced a visible second jump on mobile, where the body has barely moved anyway.
  useEffect(() => {
    if (round === 0 && index === 0) return;
    scrollUnderHeader(bodyRef.current, barRef.current);
  }, [round, index]);

  const choose = useCallback((i: number) => {
    setChosen((already) => {
      if (already !== null) return already;
      const cur = questions[index];
      if (!cur || i >= cur.options.length) return already;
      setAnswers((prev) => [...prev, { q: cur, chosen: i, correct: i === cur.answerIndex }]);
      return i;
    });
  }, [questions, index]);

  const next = useCallback(() => {
    setChosen(null);
    setIndex((i) => i + 1);
  }, []);

  // Answering disables every option, which drops focus to the document body. Move it to the
  // explanation so a keyboard or screen-reader user stays where the new content is — the same fix
  // the signed-in runner needed.
  useEffect(() => {
    if (chosen === null) return;
    afterAnswerRef.current?.focus();
  }, [chosen]);

  /** 1-9 to answer, Enter to move on — what makes a quiz feel quick rather than clicky. */
  useEffect(() => {
    if (finished) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "Enter" && chosen !== null) { e.preventDefault(); next(); return; }
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= 9 && chosen === null) { e.preventDefault(); choose(n - 1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finished, chosen, choose, next]);

  if (finished) {
    const total = questions.length;
    const pct = Math.round((score / total) * 100);
    const missed = answers.filter((a) => !a.correct);
    const note =
      pct === 100 ? "Perfect. Every single one." :
      pct >= 80 ? "Strong — this level is nearly yours." :
      pct >= 50 ? "Solid. The marks are in the explanations below." :
      "Early days. Read the explanations, then go again.";

    return (
      <div ref={bodyRef} className="animate-rise">
        {pct >= 80 && <Confetti count={pct === 100 ? 36 : 16} />}
        <div className="surface rounded-2xl p-6 sm:p-10 text-center">
          <p className="text-sm uppercase tracking-[0.14em] text-muted">{title}</p>
          <ScoreRing score={score} total={total} />
          <p className="mt-4 text-3xl font-semibold tracking-tight text-ink tabular-nums">
            {score} / {total}
          </p>
          <p className="mt-1 text-ink-2">{note}</p>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {bestStreak >= 3 && (
              <span className="rounded-full bg-accent-soft px-4 py-1.5 text-sm font-medium text-accent-ink">
                Best streak: {bestStreak}
              </span>
            )}
            {best !== null && (
              <span className="rounded-full bg-surface-2 px-4 py-1.5 text-sm font-medium text-ink-2 tabular-nums">
                {beatenBest ? "New best!" : "Your best"}: {best} / {total}
              </span>
            )}
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button onClick={() => setRound((r) => r + 1)} size="lg">
              Play again — new questions
            </Button>
            {missed.length >= 2 && (
              <Button
                variant="secondary"
                size="lg"
                onClick={() => { draw(missed.map((m) => m.q)); setRound((r) => r + 1000); }}
              >
                Retry the {missed.length} you missed
              </Button>
            )}
            <Link href={studyHref} className="inline-flex items-center gap-1.5 rounded-full border border-line px-6 h-12 font-medium hover:bg-surface-2 transition">
              Study this properly <Arrow />
            </Link>
          </div>
        </div>

        {/* The misses, with the reason. This is the part worth staying on the page for. */}
        {missed.length > 0 && (
          <section className="mt-6">
            <h2 className="text-sm uppercase tracking-[0.14em] text-muted">
              What to look at ({missed.length})
            </h2>
            <ul className="mt-3 grid gap-2.5">
              {missed.map((a, i) => (
                <li key={i} className="surface rounded-2xl p-5">
                  <p lang="ja" className="ja text-lg leading-relaxed text-ink break-words">{a.q.prompt}</p>
                  <p className="mt-2 text-sm">
                    <span lang="ja" className="ja text-warn line-through">{a.q.options[a.chosen]}</span>
                    <span className="mx-2 text-muted">→</span>
                    <span lang="ja" className="ja font-semibold text-ok">{a.q.options[a.q.answerIndex]}</span>
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-2">{a.q.explanation}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {nextUp.length > 0 && (
          <section className="mt-6">
            <h2 className="text-sm uppercase tracking-[0.14em] text-muted">Try another</h2>
            <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
              {nextUp.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="focus-inset group flex items-center gap-3 surface surface-hover rounded-2xl px-5 py-4">
                    <span className="min-w-0 flex-1 font-medium text-ink">{l.label}</span>
                    <Arrow className="shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-accent" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    );
  }

  if (!q) return null;
  const correct = chosen !== null && chosen === q.answerIndex;

  return (
    <div>
      <div ref={barRef} className="sticky top-[var(--header-h,4rem)] z-[5] rounded-t-2xl border border-line bg-bg-elev px-4 sm:px-6 py-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
          <span className="font-medium text-ink-2 tabular-nums">
            <span aria-hidden>{index + 1} / {questions.length}</span>
            <span className="sr-only">Question {index + 1} of {questions.length}</span>
          </span>
          <span className="flex items-center gap-1.5" aria-hidden>
            {answers.map((a, i) => (
              <span key={i} className={`h-2 w-2 rounded-full transition ${a.correct ? "bg-ok" : "bg-warn"}`} />
            ))}
            {Array.from({ length: questions.length - answers.length }).map((_, i) => (
              <span key={`r${i}`} className="h-2 w-2 rounded-full bg-line" />
            ))}
          </span>
          {streak >= 2 ? (
            <span className="animate-rise text-sm font-semibold text-accent tabular-nums">{streak} in a row</span>
          ) : (
            <span className="text-sm text-muted tabular-nums">{score} right</span>
          )}
        </div>
      </div>

      <div ref={bodyRef} className="surface rounded-b-2xl border-x border-b border-line p-5 sm:p-7">
        <p key={q.id} lang="ja" className="ja animate-rise text-xl sm:text-2xl leading-relaxed text-ink break-words">
          {q.prompt}
        </p>

        <ul className="mt-6 grid gap-2.5">
          {q.options.map((opt, i) => {
            const isAnswer = i === q.answerIndex;
            const picked = chosen === i;
            const state = chosen === null ? "idle" : isAnswer ? "right" : picked ? "wrong" : "dim";
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => choose(i)}
                  disabled={chosen !== null}
                  className={[
                    "group w-full flex items-center gap-3 text-left rounded-xl border px-4 py-3.5 text-lg transition",
                    state === "idle" && "border-line bg-surface hover:border-accent hover:bg-surface-2 active:scale-[0.99]",
                    state === "right" && "border-ok bg-ok-soft text-ink",
                    state === "wrong" && "border-warn bg-warn-soft text-ink",
                    state === "dim" && "border-line bg-surface opacity-55",
                  ].filter(Boolean).join(" ")}
                >
                  {/* The number is the keyboard shortcut, so it is shown rather than hidden. */}
                  <span
                    aria-hidden
                    className={[
                      "hidden sm:grid h-7 w-7 shrink-0 place-items-center rounded-md border text-xs font-semibold tabular-nums transition",
                      state === "idle" ? "border-line text-muted group-hover:border-accent group-hover:text-accent" : "border-transparent text-muted",
                    ].join(" ")}
                  >
                    {i + 1}
                  </span>
                  <span lang="ja" className="ja min-w-0 flex-1 break-words">{opt}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* A live region that is always in the DOM: one mounted together with its text is announced
            unreliably, and this one also names the answer, which colour alone never did. */}
        <p className="sr-only" role="status" aria-live="polite">
          {chosen === null
            ? ""
            : correct
              ? `Correct. ${q.explanation}`
              : `Not quite. The answer is ${q.options[q.answerIndex]}. ${q.explanation}`}
        </p>

        {chosen !== null && (
          <div ref={afterAnswerRef} tabIndex={-1} className="mt-6 animate-rise focus:outline-none">
            <p className={`text-lg font-semibold ${correct ? "text-ok" : "text-warn"}`}>
              {correct
                ? (streak >= 3 ? `Correct — ${streak} in a row` : "Correct")
                : lostStreak >= 3
                  ? `Not quite — that ends a run of ${lostStreak}`
                  : "Not quite"}
            </p>
            {!correct && (
              <p className="mt-1 text-sm text-ink-2">
                The answer is <span lang="ja" className="ja font-semibold text-ok">{q.options[q.answerIndex]}</span>.
              </p>
            )}
            <p className="mt-1.5 leading-relaxed text-ink-2">{q.explanation}</p>
            <div className="mt-5 flex items-center gap-3">
              <Button onClick={next} size="lg">
                {index + 1 === questions.length ? "See your score" : "Next question"}
                <Arrow />
              </Button>
              <span className="hidden sm:inline text-xs text-muted">or press Enter</span>
            </div>
          </div>
        )}

        {chosen === null && (
          <p className="mt-5 hidden sm:block text-xs text-muted">Press 1–{q.options.length} to answer</p>
        )}
      </div>
    </div>
  );
}

/** Counts the ring up once, so the result lands rather than just appearing. */
function ScoreRing({ score, total }: { score: number; total: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setShown(score); return; }
    let raf = 0;
    const started = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - started) / 700);
      setShown(score * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = total ? shown / total : 0;
  return (
    <svg viewBox="0 0 128 128" className="mx-auto mt-6 h-32 w-32" role="img" aria-label={`${score} out of ${total}`}>
      <circle cx="64" cy="64" r={r} fill="none" stroke="var(--line)" strokeWidth="10" />
      <circle
        cx="64" cy="64" r={r} fill="none" stroke="var(--accent)" strokeWidth="10" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform="rotate(-90 64 64)"
      />
    </svg>
  );
}

/**
 * A short burst for a perfect round. Decorative only: aria-hidden, skipped for anyone who asked for
 * reduced motion, and it takes itself off the page rather than animating forever.
 */
function Confetti({ count = 36 }: { count?: number }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setOn(true);
    const t = window.setTimeout(() => setOn(false), 2600);
    return () => window.clearTimeout(t);
  }, []);
  if (!on) return null;
  const colours = ["var(--accent)", "var(--ok)", "var(--warn)", "var(--info)"];
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-30 h-0 overflow-x-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="confetti-bit"
          style={{
            left: `${2 + ((i * 97) % 94)}%`,
            background: colours[i % colours.length],
            animationDelay: `${(i % 12) * 60}ms`,
          }}
        />
      ))}
    </div>
  );
}
