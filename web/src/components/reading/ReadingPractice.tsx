"use client";

import { useEffect, useState } from "react";
import type { Question } from "@/lib/content/schemas";
import { QuestionSet } from "@/components/practice/QuestionSet";
import { Callout } from "@/components/ui";

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function ProgressRing({ value, over }: { value: number; over: boolean }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <svg className="h-11 w-11 -rotate-90" viewBox="0 0 40 40" aria-hidden>
      <circle cx="20" cy="20" r={r} fill="none" stroke="var(--line)" strokeWidth="3.5" />
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        stroke={over ? "var(--accent)" : "var(--ok)"}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - v)}
        className="transition-[stroke-dashoffset] duration-700 ease-linear"
      />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M7 5v14l12-7z" />
    </svg>
  );
}
function IconPause() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
    </svg>
  );
}
function IconReset() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" />
    </svg>
  );
}

const chipBtn = "inline-flex items-center justify-center h-9 rounded-full text-sm font-medium transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100";

/**
 * Timed reading practice: a countdown timer for the passage plus the passage's questions.
 * The passage itself is server-rendered by the page; this component only handles interaction.
 */
export function ReadingPractice({ questions, timeLimitSeconds }: { questions: Question[]; timeLimitSeconds: number }) {
  const [remaining, setRemaining] = useState(timeLimitSeconds);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setRunning(false);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const overTime = started && remaining === 0;
  const used = timeLimitSeconds - remaining;
  const fraction = timeLimitSeconds > 0 ? remaining / timeLimitSeconds : 0;

  const stateLabel = !started ? "Ready" : overTime ? "Time is up" : running ? "Running" : finished ? "Finished" : "Paused";

  return (
    <div className="space-y-6">
      {/* Sticky timer chip: bottom bar on small screens, floating top-right on wide screens. */}
      <div
        role="group"
        aria-label="Reading timer"
        className="fixed z-40 inset-x-0 bottom-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] xl:inset-x-auto xl:bottom-auto xl:top-24 xl:right-5 xl:px-0 xl:pb-0 xl:w-[15.5rem]"
      >
        <div className="glass border border-line rounded-2xl shadow-lg p-3 xl:p-4 max-w-content mx-auto xl:mx-0">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <ProgressRing value={fraction} over={overTime} />
              {running && <span aria-hidden className="absolute inset-0 m-auto h-1.5 w-1.5 rounded-full bg-ok animate-pulse" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted leading-none">{stateLabel}</p>
              <p className={`text-2xl font-semibold tabular-nums tracking-tight leading-tight mt-1 ${overTime ? "text-accent" : "text-ink"}`} aria-live="off">
                {fmt(remaining)}
              </p>
              <p className="text-[11px] text-muted leading-none mt-0.5">of {fmt(timeLimitSeconds)}</p>
            </div>
            <div className="flex items-center gap-1.5 xl:hidden">
              {!started ? (
                <button
                  type="button"
                  className={`${chipBtn} accent-gradient text-white px-4 shadow-sm`}
                  onClick={() => {
                    setStarted(true);
                    setRunning(true);
                  }}
                >
                  <IconPlay />
                  <span className="ml-1.5">Start</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    aria-pressed={running}
                    aria-label={running ? "Pause timer" : "Resume timer"}
                    disabled={finished || overTime}
                    className={`${chipBtn} w-9 bg-surface border border-line hover:bg-surface-2`}
                    onClick={() => setRunning((r) => !r)}
                  >
                    {running ? <IconPause /> : <IconPlay />}
                  </button>
                  <button
                    type="button"
                    aria-label="Reset timer"
                    className={`${chipBtn} w-9 bg-surface border border-line hover:bg-surface-2`}
                    disabled={finished}
                    onClick={() => {
                      setRunning(false);
                      setRemaining(timeLimitSeconds);
                      setStarted(false);
                    }}
                  >
                    <IconReset />
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="hidden xl:flex items-center gap-1.5 mt-3">
            {!started ? (
              <button
                type="button"
                className={`${chipBtn} accent-gradient text-white px-4 shadow-sm flex-1`}
                onClick={() => {
                  setStarted(true);
                  setRunning(true);
                }}
              >
                <IconPlay />
                <span className="ml-1.5">Start timer</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  aria-pressed={running}
                  disabled={finished || overTime}
                  className={`${chipBtn} flex-1 bg-surface border border-line hover:bg-surface-2 gap-1.5`}
                  onClick={() => setRunning((r) => !r)}
                >
                  {running ? <IconPause /> : <IconPlay />}
                  {running ? "Pause" : "Resume"}
                </button>
                <button
                  type="button"
                  aria-label="Reset timer"
                  className={`${chipBtn} w-9 bg-surface border border-line hover:bg-surface-2`}
                  disabled={finished}
                  onClick={() => {
                    setRunning(false);
                    setRemaining(timeLimitSeconds);
                    setStarted(false);
                  }}
                >
                  <IconReset />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {overTime && (
        <div role="status">
          <Callout tone="warn" title="Time is up">
            Finish answering anyway, then compare how long you needed with the target.
          </Callout>
        </div>
      )}

      {!started && !finished && (
        <p className="text-sm text-muted">
          Press <strong className="text-ink">Start timer</strong>, read the passage above, then answer the questions. You can also answer without the timer.
        </p>
      )}

      <QuestionSet
        questions={questions}
        submitLabel="Check answers"
        onSubmit={() => {
          setRunning(false);
          setFinished(true);
        }}
      />

      {finished && started && (
        <div role="status">
          <Callout tone={overTime ? "warn" : "ok"} title={overTime ? "Over the target" : "Within the target"}>
            You used <strong className="tabular-nums">{fmt(used)}</strong> of the {fmt(timeLimitSeconds)} target{overTime ? " and ran out of time." : "."}
          </Callout>
        </div>
      )}
    </div>
  );
}
