"use client";
/**
 * Small in-lesson quiz. Receives full Question objects (no fetching), shows one at a time,
 * gives immediate feedback with explanations, and a final score.
 */
import Link from "next/link";
import { useState } from "react";
import type { Question } from "@/lib/content/schemas";
import { SpeakButton } from "@/components/ui";
import { JA_RE } from "@/components/study/helpers";
import { cleanNote, wrongOptionNotes } from "@/lib/questions/notes";

function ScoreRing({ pct }: { pct: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const tone = pct === 100 ? "var(--ok)" : pct >= 70 ? "var(--accent)" : "var(--warn)";
  return (
    <div className="relative h-24 w-24 shrink-0" aria-hidden>
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--line)" strokeWidth="7" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={tone} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} className="transition-[stroke-dasharray] duration-700" />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-xl font-semibold tabular-nums tracking-tight">{pct}%</span>
    </div>
  );
}

const TYPE_LABEL = { ordering: "Sentence order", cloze: "Fill the blank", mc: "Multiple choice" } as const;

export function LessonQuiz({ questions, title = "Test yourself" }: { questions: Question[]; title?: string }) {
  const [i, setI] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<boolean[]>([]);

  if (questions.length === 0) return null;

  const finished = i >= questions.length;
  const q = questions[Math.min(i, questions.length - 1)];
  const correctCount = answers.filter(Boolean).length;

  const choose = (idx: number) => {
    if (selected !== null) return;
    setSelected(idx);
    setAnswers((a) => [...a, idx === q.answerIndex]);
  };

  const next = () => {
    setSelected(null);
    setI((n) => n + 1);
  };

  const restart = () => {
    setI(0);
    setSelected(null);
    setAnswers([]);
  };

  const primaryBtn = "inline-flex items-center justify-center gap-2 rounded-full accent-gradient text-white h-10 px-5 text-sm font-medium shadow-sm transition hover:shadow-md hover:brightness-105 active:scale-[0.98]";
  const secondaryBtn = "inline-flex items-center justify-center rounded-full border border-line bg-surface h-10 px-5 text-sm font-medium text-ink transition hover:bg-surface-2 hover:border-line-strong";

  if (finished) {
    const pct = Math.round((correctCount / questions.length) * 100);
    return (
      <div className="surface rounded-2xl p-5 sm:p-6 animate-rise" role="status">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <ScoreRing pct={pct} />
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted">{title} · result</p>
            <p className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums">
              {correctCount} <span className="text-muted font-normal">/ {questions.length}</span>
            </p>
            <p className="mt-1.5 text-sm text-ink-2 leading-relaxed">
              {pct === 100
                ? "Perfect. Come back in a few days to make sure it sticks."
                : pct >= 70
                  ? "Good. Re-read the common mistakes above and try again tomorrow."
                  : "Not yet. Re-read the simple explanation and examples, then try once more."}
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={restart} className={primaryBtn}>
            Try again
          </button>
          <Link href="/signup" className={secondaryBtn}>
            Save results with a free account
          </Link>
        </div>
      </div>
    );
  }

  const answered = selected !== null;
  const isCorrect = answered && selected === q.answerIndex;
  const perOption = q.distractorExplanations.length === q.options.length;
  const wrongNotes = wrongOptionNotes(q.distractorExplanations, q.answerIndex, q.options.length);

  return (
    <div className="surface rounded-2xl overflow-hidden">
      {/* progress strip */}
      <div className="h-1 bg-surface-2" aria-hidden>
        <div className="h-full accent-gradient transition-[width] duration-500" style={{ width: `${(i / questions.length) * 100}%` }} />
      </div>

      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex h-6 min-w-[1.5rem] px-2 items-center justify-center rounded-full bg-surface-2 border border-line text-[11px] font-semibold tabular-nums text-ink-2">
              {i + 1} / {questions.length}
            </span>
            <span>{TYPE_LABEL[q.type]}</span>
          </span>
          <span className="inline-flex items-center gap-1" title={`Difficulty ${q.difficulty} of 5`}>
            {Array.from({ length: 5 }, (_, d) => (
              <span key={d} className={`h-1.5 w-3 rounded-full ${d < q.difficulty ? "bg-accent" : "bg-line"}`} aria-hidden />
            ))}
            <span className="sr-only">Difficulty {q.difficulty} of 5</span>
          </span>
        </div>

        {q.context && (
          <p lang="ja" className="ja mt-4 rounded-xl bg-surface-2 border border-line p-3.5 text-base leading-relaxed whitespace-pre-line">
            {q.context}
          </p>
        )}

        <div className="mt-4 flex items-start gap-2">
          <p lang="ja" className="ja flex-1 min-w-0 text-xl sm:text-2xl leading-relaxed text-ink">
            {q.prompt}
          </p>
          {JA_RE.test(q.prompt) && <SpeakButton text={q.prompt} size="sm" className="mt-1" />}
        </div>
        {q.type === "ordering" && <p className="mt-1.5 text-sm text-muted">Choose the word that goes in the ★ position.</p>}

        <ol className="mt-5 grid gap-2" aria-label="Answer options">
          {q.options.map((opt, idx) => {
            let cls = "border-line bg-bg-elev hover:border-accent/50 hover:bg-surface hover:shadow-sm";
            let mark = "bg-surface-2 border-line text-muted";
            let symbol: string | number = idx + 1;
            if (answered) {
              if (idx === q.answerIndex) {
                cls = "border-ok bg-ok-soft shadow-sm";
                mark = "bg-ok border-ok text-white";
                symbol = "✓";
              } else if (idx === selected) {
                cls = "border-accent bg-accent-soft";
                mark = "bg-accent border-accent text-white";
                symbol = "✗";
              } else cls = "border-line bg-bg-elev opacity-60";
            }
            return (
              <li key={idx} className="flex items-start gap-2">
                <button
                  type="button"
                  onClick={() => choose(idx)}
                  disabled={answered}
                  aria-pressed={selected === idx}
                  className={`flex-1 min-w-0 text-left rounded-xl border px-3.5 py-3 flex items-start gap-3 transition disabled:cursor-default ${cls}`}
                >
                  <span className={`shrink-0 mt-0.5 h-6 w-6 rounded-full border grid place-items-center text-xs font-semibold tabular-nums ${mark}`} aria-hidden>
                    {symbol}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span lang="ja" className="ja block text-base sm:text-lg leading-relaxed">
                      {opt}
                    </span>
                    {answered && perOption && idx !== q.answerIndex && q.distractorExplanations[idx] && (
                      <span className="block mt-1 text-sm text-muted leading-relaxed">{cleanNote(q.distractorExplanations[idx])}</span>
                    )}
                  </span>
                </button>
                {/* Sibling of the option (a button may not nest inside a button) */}
                {JA_RE.test(opt) && <SpeakButton text={opt} size="xs" className="mt-3" />}
              </li>
            );
          })}
        </ol>

        {answered && (
          <div className={`mt-5 rounded-xl border p-4 sm:p-5 animate-rise ${isCorrect ? "border-ok/30 bg-ok-soft" : "border-accent/30 bg-accent-soft"}`} role="status">
            <p className={`font-semibold inline-flex items-center gap-2 ${isCorrect ? "text-ok" : "text-accent-ink"}`}>
              <span className={`h-5 w-5 rounded-full grid place-items-center text-[11px] text-white ${isCorrect ? "bg-ok" : "bg-accent"}`} aria-hidden>
                {isCorrect ? "✓" : "✗"}
              </span>
              {isCorrect ? "Correct" : "Not quite"}
            </p>
            <p className="mt-2 text-sm sm:text-[15px] leading-relaxed text-ink-2">{q.explanation}</p>
            {!perOption && wrongNotes.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm text-muted list-disc pl-5">
                {wrongNotes.map((d) => (
                  <li key={d.index}>{d.text}</li>
                ))}
              </ul>
            )}
            <button type="button" onClick={next} className={`${primaryBtn} mt-4`}>
              {i + 1 < questions.length ? "Next question" : "See result"}
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
