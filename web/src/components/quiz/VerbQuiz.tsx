"use client";

import { useState } from "react";
import { QuickQuiz, type QuizLink } from "./QuickQuiz";
import { QUIZ_LENGTH, type QuizQuestion } from "@/lib/quiz/shared";
import { buildVerbQuestions, filterLevel, type VerbCard, type VerbQuizLevel, type VerbQuizMode } from "@/lib/quiz/verbQuiz";

const MODES: [VerbQuizMode, string][] = [
  ["ja-en", "Verb → English"],
  ["en-ja", "English → verb"],
  ["mix", "Mix"],
];
const LEVELS: [VerbQuizLevel, string][] = [
  ["all", "N5 + N4"],
  ["n5", "N5"],
  ["n4", "N4"],
];

const pill = "inline-flex items-center rounded-full border px-3.5 h-9 text-sm transition";
const idle = `${pill} border-line bg-surface text-ink-2 hover:border-accent/50 hover:text-accent hover:bg-accent-soft/40`;
const on = `${pill} border-accent bg-accent-soft text-accent-ink font-medium`;

/**
 * The verb quiz: choose a direction and a level, then the shared ten-question QuickQuiz runs it.
 *
 * The server sends the verb list and a first round for the default setting (Mix, N5 + N4), so the
 * page arrives with a real question. Every other pool is built here, from the same list, when the
 * setting changes; changing it remounts the quiz, so a new setting always starts a fresh round.
 */
export function VerbQuiz({ cards, initial, studyHref, nextUp }: { cards: VerbCard[]; initial: QuizQuestion[]; studyHref: string; nextUp?: QuizLink[] }) {
  const [mode, setMode] = useState<VerbQuizMode>("mix");
  const [level, setLevel] = useState<VerbQuizLevel>("all");
  // The full pool from the start, so QuickQuiz's opening shuffle draws from every verb rather than
  // the server's ten. Building it with Math.random here is safe: the pool is never rendered (only
  // `first` is), so the server's and the browser's pools may differ without a hydration mismatch.
  const [round, setRound] = useState(() => ({ key: 0, pool: buildVerbQuestions(cards, "mix"), first: initial }));

  const change = (m: VerbQuizMode, l: VerbQuizLevel) => {
    setMode(m);
    setLevel(l);
    const pool = buildVerbQuestions(filterLevel(cards, l), m);
    setRound((r) => ({ key: r.key + 1, pool, first: pool.slice(0, QUIZ_LENGTH).sort((a, b) => a.difficulty - b.difficulty) }));
  };

  const label = `${MODES.find(([k]) => k === mode)![1]}, ${LEVELS.find(([k]) => k === level)![1]}`;

  return (
    <div>
      <div className="mb-5 space-y-2.5">
        <div role="group" aria-label="Question direction" className="flex flex-wrap gap-1.5">
          {MODES.map(([k, text]) => (
            <button key={k} type="button" aria-pressed={mode === k} onClick={() => change(k, level)} className={mode === k ? on : idle}>
              {text}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Level" className="flex flex-wrap gap-1.5">
          {LEVELS.map(([k, text]) => (
            <button key={k} type="button" aria-pressed={level === k} onClick={() => change(mode, k)} className={level === k ? on : idle}>
              {text}
            </button>
          ))}
        </div>
      </div>
      <QuickQuiz
        key={round.key}
        pool={round.pool}
        initial={round.first}
        title={`Verb quiz: ${label}`}
        studyHref={studyHref}
        bestKey={`quiz-best:verbs:${mode}:${level}`}
        nextUp={nextUp}
      />
    </div>
  );
}
