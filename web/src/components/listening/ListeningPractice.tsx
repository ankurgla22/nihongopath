"use client";

import { useState, type ReactNode } from "react";
import type { Question } from "@/lib/content/schemas";
import { AudioPlayer, type ScriptLine } from "@/components/audio/AudioPlayer";
import { QuestionSet } from "@/components/practice/QuestionSet";
import { Arrow, Button } from "@/components/ui";

const STEPS = ["Listen", "Answer", "Check", "Transcript", "Listen again", "Shadow", "Vocabulary"] as const;
type Step = (typeof STEPS)[number];

const STEP_HINT: Record<Step, string> = {
  Listen: "Listen once, as in the exam. Do not read anything yet; note the setting, who is speaking and what is decided.",
  Answer: "Answer from memory. You can replay the audio if you must, but the real test plays each item only once.",
  Check: "Read why the correct option is right and why the others were tempting. Then move on to the transcript.",
  Transcript: "Read the script carefully. Mark anything you did not catch while listening; those are the words to shadow.",
  "Listen again": "Listen while following the transcript below. Try 1.25× once you can follow at 1×.",
  Shadow: "Shadowing: repeat each line aloud right after you hear it, copying the rhythm and pitch. Start at 0.75× if needed.",
  Vocabulary: "Review the key words from this exercise. Add any you did not know to your notes and listen once more tomorrow.",
};

/**
 * The listening flow from tasks.md §15:
 * Listen once → Answer → Check → Read transcript → Listen again → Shadow → Review vocabulary.
 *
 * `transcript` and `vocabulary` are server-rendered React nodes passed in by the page. They are
 * always present in the HTML (for crawlers and no-JS readers) but hidden until their step is reached.
 */
export function ListeningPractice({
  audioSrc,
  lines,
  questions,
  transcript,
  vocabulary,
}: {
  audioSrc?: string;
  lines: ScriptLine[];
  questions: Question[];
  transcript: ReactNode;
  vocabulary: ReactNode;
}) {
  const [stepIdx, setStepIdx] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [replayOpen, setReplayOpen] = useState(false);
  const step: Step = STEPS[stepIdx];

  function go(i: number) {
    const clamped = Math.max(0, Math.min(STEPS.length - 1, i));
    setStepIdx(clamped);
    setReplayOpen(false);
    setMaxReached((m) => Math.max(m, clamped));
  }
  const next = () => go(stepIdx + 1);

  const transcriptIdx = STEPS.indexOf("Transcript");
  const vocabIdx = STEPS.indexOf("Vocabulary");
  const transcriptUnlocked = maxReached >= transcriptIdx;
  const vocabUnlocked = maxReached >= vocabIdx;
  const showQuestions = step === "Answer" || step === "Check";

  return (
    <div className="space-y-8">
      {/* Step rail */}
      <nav aria-label="Listening steps" className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto no-scrollbar">
        <ol className="flex items-start min-w-max sm:min-w-0 sm:w-full">
          {STEPS.map((s, i) => {
            const reachable = i <= maxReached;
            const active = i === stepIdx;
            const done = i < maxReached && !active;
            const last = i === STEPS.length - 1;
            return (
              <li key={s} className={`relative flex flex-col items-center ${last ? "" : "flex-1 min-w-[5.25rem]"}`}>
                {!last && (
                  <span aria-hidden className="absolute top-4 left-1/2 right-[-50%] h-0.5 rounded-full bg-line">
                    <span className={`block h-full rounded-full accent-gradient transition-[width] duration-500 ${i < maxReached ? "w-full" : "w-0"}`} />
                  </span>
                )}
                <button
                  type="button"
                  disabled={!reachable}
                  aria-current={active ? "step" : undefined}
                  onClick={() => go(i)}
                  className="group relative z-[1] flex flex-col items-center gap-1.5 px-2 disabled:cursor-not-allowed"
                >
                  <span
                    className={`h-8 w-8 rounded-full grid place-items-center text-xs font-semibold tabular-nums border-2 transition ${
                      active
                        ? "accent-gradient text-white border-transparent shadow-md ring-4 ring-accent-soft"
                        : done
                          ? "bg-accent-soft text-accent-ink border-accent/30"
                          : reachable
                            ? "bg-surface border-line-strong text-ink-2 group-hover:border-accent"
                            : "bg-surface-2 border-line text-muted"
                    }`}
                  >
                    {done ? (
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="m5 12 5 5L20 7" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span className={`text-[11px] sm:text-xs whitespace-nowrap ${active ? "text-ink font-semibold" : reachable ? "text-ink-2" : "text-muted"}`}>{s}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <section aria-labelledby="step-heading" className="space-y-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted">
            Step {stepIdx + 1} of {STEPS.length}
          </p>
          <h3 id="step-heading" className="text-h2 mt-1">
            {step}
          </h3>
          <p className="text-sm text-muted mt-1.5 max-w-prose">{STEP_HINT[step]}</p>
        </div>

        {step === "Listen" && (
          <>
            <AudioPlayer audioSrc={audioSrc} lines={lines} showLines={false} label="Listen once" />
            <Button onClick={next}>
              I have listened <Arrow />
            </Button>
          </>
        )}

        {showQuestions && (
          <>
            {step === "Answer" && (
              <div className="space-y-3">
                {replayOpen ? (
                  <AudioPlayer audioSrc={audioSrc} lines={lines} showLines={false} label="Replay" />
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => setReplayOpen(true)} ariaLabel="Replay the audio">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M3 12a9 9 0 1 0 3-6.7" />
                      <path d="M3 4v5h5" />
                    </svg>
                    <span className="ml-1.5">Replay audio</span>
                  </Button>
                )}
              </div>
            )}
            <QuestionSet questions={questions} submitLabel="Check answers" onSubmit={() => go(STEPS.indexOf("Check"))} />
            {step === "Check" && (
              <Button onClick={next}>
                Read the transcript <Arrow />
              </Button>
            )}
            {step === "Answer" && questions.length === 0 && (
              <Button onClick={() => go(transcriptIdx)}>
                Read the transcript <Arrow />
              </Button>
            )}
          </>
        )}

        {step === "Transcript" && (
          <Button onClick={next}>
            Listen again with the transcript <Arrow />
          </Button>
        )}

        {step === "Listen again" && (
          <>
            <AudioPlayer audioSrc={audioSrc} lines={lines} showLines label="Listen again" />
            <Button onClick={next}>
              Shadow the dialogue <Arrow />
            </Button>
          </>
        )}

        {step === "Shadow" && (
          <>
            <AudioPlayer audioSrc={audioSrc} lines={lines} showLines shadowing label="Shadow" />
            <Button onClick={next}>
              Review vocabulary <Arrow />
            </Button>
          </>
        )}
      </section>

      <div hidden={!transcriptUnlocked} aria-hidden={!transcriptUnlocked}>
        {transcript}
      </div>
      <div hidden={!vocabUnlocked} aria-hidden={!vocabUnlocked}>
        {vocabulary}
      </div>

      {step === "Vocabulary" && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => go(0)} variant="secondary">
            Start over
          </Button>
        </div>
      )}
    </div>
  );
}
