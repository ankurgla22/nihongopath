"use client";

import { useState } from "react";
import type { Question } from "@/lib/content/schemas";
import { Button, Callout, Speakable } from "@/components/ui";
import { JA_RE } from "@/components/study/helpers";
import { wrongOptionNotes } from "@/lib/questions/notes";

const TYPE_LABEL: Record<Question["type"], string> = {
  mc: "Choose the best answer",
  ordering: "Which item goes in the ★ position?",
  cloze: "Fill in the blank",
};

export type QuestionSetResult = { correct: number; total: number };

function IconCheck() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m5 12 5 5L20 7" />
    </svg>
  );
}
function IconCross() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

/**
 * Answer a list of questions, then reveal per-question explanations
 * (why the answer is correct, why the distractors are wrong).
 * Shared by reading and listening practice.
 */
export function QuestionSet({
  questions,
  onSubmit,
  submitLabel = "Check answers",
  disabled = false,
}: {
  questions: Question[];
  onSubmit?: (r: QuestionSetResult) => void;
  submitLabel?: string;
  disabled?: boolean;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [checked, setChecked] = useState(false);

  if (questions.length === 0) {
    return <p className="text-muted text-sm">No questions are attached to this exercise yet.</p>;
  }

  const allAnswered = questions.every((q) => answers[q.id] !== undefined);
  const correct = questions.filter((q) => answers[q.id] === q.answerIndex).length;
  const answeredCount = questions.filter((q) => answers[q.id] !== undefined).length;

  function check() {
    setChecked(true);
    onSubmit?.({ correct, total: questions.length });
  }

  return (
    <div className="space-y-5">
      {questions.map((q, qi) => {
        const chosen = answers[q.id];
        const isCorrect = checked && chosen === q.answerIndex;
        const locked = checked || disabled;
        const perOption = q.distractorExplanations.length === q.options.length;
        const wrongNotes = wrongOptionNotes(q.distractorExplanations, q.answerIndex, q.options.length);
        return (
          <fieldset key={q.id} className="surface rounded-2xl p-5 sm:p-6">
            <legend className="sr-only">Question {qi + 1}</legend>
            <div className="flex items-start gap-3.5">
              <span
                aria-hidden
                className={`shrink-0 h-8 w-8 rounded-full grid place-items-center text-sm font-semibold tabular-nums ${
                  checked ? (isCorrect ? "bg-ok-soft text-ok" : "bg-accent-soft text-accent-ink") : "bg-ink text-bg"
                }`}
              >
                {checked ? (isCorrect ? <IconCheck /> : <IconCross />) : qi + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted mb-1.5">{TYPE_LABEL[q.type]}</p>
                {q.context && (
                  <p lang="ja" className="ja text-base leading-relaxed mb-2 text-ink-2 whitespace-pre-line">
                    {q.context}
                  </p>
                )}
                {JA_RE.test(q.prompt) ? (
                  <Speakable as="p" text={q.prompt} className="text-lg leading-relaxed whitespace-pre-line text-ink" />
                ) : (
                  <p className="text-lg leading-relaxed whitespace-pre-line text-ink">{q.prompt}</p>
                )}
              </div>
            </div>

            <ol className="mt-4 grid gap-2">
              {q.options.map((opt, oi) => {
                const selected = chosen === oi;
                const isAnswer = oi === q.answerIndex;
                let cls = "border-line bg-surface hover:border-line-strong hover:bg-surface-2";
                let num = "bg-surface-2 text-muted border-line";
                if (checked) {
                  if (isAnswer) {
                    cls = "border-ok bg-ok-soft";
                    num = "bg-ok text-white border-ok";
                  } else if (selected) {
                    cls = "border-accent bg-accent-soft";
                    num = "bg-accent text-white border-accent";
                  } else cls = "border-line opacity-60";
                } else if (selected) {
                  cls = "border-accent bg-accent-soft shadow-ring";
                  num = "bg-accent text-white border-accent";
                }
                return (
                  <li key={oi}>
                    <label
                      className={`relative flex min-w-0 items-start gap-3 border rounded-xl px-3.5 py-3 transition ${locked ? "cursor-default" : "cursor-pointer"} ${cls} has-[:focus-visible]:shadow-ring`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        value={oi}
                        checked={selected}
                        disabled={locked}
                        onChange={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                        className="sr-only"
                      />
                      <span aria-hidden className={`shrink-0 h-6 w-6 rounded-full border grid place-items-center text-xs font-semibold tabular-nums mt-0.5 transition ${num}`}>
                        {checked && isAnswer ? <IconCheck /> : checked && selected ? <IconCross /> : oi + 1}
                      </span>
                      <span lang="ja" className="ja text-base leading-relaxed text-ink">
                        {opt}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ol>

            {checked && (
              <div className="mt-5 space-y-3" aria-live="polite">
                <p className={`font-semibold ${isCorrect ? "text-ok" : "text-accent"}`}>
                  {isCorrect ? "Correct." : "Not quite."}
                </p>
                <div className="rounded-xl border border-ok/25 bg-ok-soft px-4 py-3.5">
                  <p className="flex items-center gap-2 font-medium text-ok mb-1">
                    <IconCheck /> Why {q.answerIndex + 1} is correct
                  </p>
                  <p className="text-sm leading-relaxed text-ink-2">{q.explanation}</p>
                </div>
                {wrongNotes.length > 0 && (
                  <div className="rounded-xl border border-line bg-surface-2 px-4 py-3.5">
                    <p className="font-medium mb-1.5">Why the other options are wrong</p>
                    <ul className="space-y-1.5">
                      {wrongNotes.map((d) => (
                        <li key={d.index} className="flex gap-2 text-sm leading-relaxed text-ink-2">
                          <span className="shrink-0 text-accent mt-0.5">
                            <IconCross />
                          </span>
                          <span>
                            {perOption && <span className="font-medium text-ink tabular-nums">{d.index + 1}. </span>}
                            {d.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </fieldset>
        );
      })}

      {!checked ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={check} disabled={!allAnswered || disabled} size="lg">
            {submitLabel}
          </Button>
          {!allAnswered && (
            <span className="text-sm text-muted tabular-nums">
              {answeredCount} / {questions.length} answered. Answer every question to check.
            </span>
          )}
        </div>
      ) : (
        <div aria-live="polite">
          <Callout tone={correct === questions.length ? "ok" : "neutral"} title={`Score: ${correct} / ${questions.length}`}>
            {correct === questions.length ? "Every answer correct. Re-read once more for speed." : "Read the explanations for the ones you missed, then re-read those parts of the text."}
          </Callout>
        </div>
      )}
    </div>
  );
}
