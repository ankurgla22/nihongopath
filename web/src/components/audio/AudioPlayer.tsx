"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ScriptLine = { speaker: string; line: string };

const RATES = [0.75, 1, 1.25] as const;
type Rate = (typeof RATES)[number];

/** Rough spoken duration of a Japanese line in ms (≈ 6 mora per second at rate 1). */
function estimateMs(text: string, rate: number) {
  return Math.max(1200, (text.length / 6) * 1000) / rate;
}

function pickJaVoice(): SpeechSynthesisVoice | undefined {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return undefined;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === "ja-JP" && /google|kyoko|nanami|haruka|o-ren|otoya/i.test(v.name)) ??
    voices.find((v) => v.lang === "ja-JP") ??
    voices.find((v) => v.lang.toLowerCase().startsWith("ja"))
  );
}

/* ---------- Icons ---------- */

function IconPlay() {
  return (
    <svg className="h-5 w-5 translate-x-px" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M7 5v14l12-7z" />
    </svg>
  );
}
function IconPause() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
    </svg>
  );
}
function IconStop() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}
function IconReplay() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" />
    </svg>
  );
}
function IconMic() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

const ctlBtn = "inline-flex items-center justify-center gap-1.5 h-10 rounded-full text-sm font-medium transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed";
const ctlSecondary = `${ctlBtn} px-3.5 bg-surface border border-line text-ink hover:bg-surface-2 hover:border-line-strong`;
const bigBtn = "inline-flex items-center justify-center h-14 w-14 shrink-0 rounded-full transition active:scale-[0.97] focus-visible:shadow-ring";

/**
 * Listening audio player.
 * - With `audioSrc`: native <audio> with speed control and replay.
 * - Without: browser SpeechSynthesis reads each script line in Japanese with speed control,
 *   and a shadowing mode that plays one line at a time, pausing so the learner can repeat it.
 *
 * `showLines` reveals the current line text during shadowing (only enable after the transcript step).
 * `minimal` shows Play + speed only (no Replay, no Shadowing): used before the transcript step.
 */
export function AudioPlayer({
  audioSrc,
  lines,
  showLines = false,
  label = "Audio",
  shadowing: shadowingProp,
  minimal = false,
}: {
  audioSrc?: string;
  lines: ScriptLine[];
  showLines?: boolean;
  label?: string;
  /** Force shadowing mode on (used by the Shadow step). Otherwise the learner toggles it. */
  shadowing?: boolean;
  minimal?: boolean;
}) {
  const [rate, setRate] = useState<Rate>(1);
  const [shadowToggle, setShadowToggle] = useState(false);
  const shadowing = minimal ? false : (shadowingProp ?? shadowToggle);

  // A recording is used for listening; shadowing still goes line by line through speech
  // synthesis, because it needs to pause after each line, which a single file cannot do.
  if (audioSrc && !shadowing) {
    return <FileAudio src={audioSrc} rate={rate} setRate={setRate} label={label} minimal={minimal} />;
  }
  return (
    <TtsAudio
      lines={lines}
      rate={rate}
      setRate={setRate}
      shadowing={shadowing}
      setShadowing={!minimal && shadowingProp === undefined ? setShadowToggle : undefined}
      showLines={showLines}
      label={label}
      minimal={minimal}
    />
  );
}

function RateControl({ rate, setRate }: { rate: Rate; setRate: (r: Rate) => void }) {
  return (
    <div role="group" aria-label="Playback speed" className="inline-flex h-10 items-center rounded-full border border-line bg-surface-2 p-1">
      {RATES.map((r) => (
        <button
          key={r}
          type="button"
          aria-pressed={rate === r}
          onClick={() => setRate(r)}
          className={`h-8 px-3 rounded-full text-xs font-medium tabular-nums transition ${rate === r ? "bg-surface text-ink shadow-sm border border-line" : "text-muted hover:text-ink"}`}
        >
          {r}×
        </button>
      ))}
    </div>
  );
}

function LineProgress({ total, current, status }: { total: number; current: number; status: string }) {
  return (
    <div className="flex items-center gap-1" aria-hidden>
      {Array.from({ length: total }).map((_, i) => {
        const done = current >= 0 && i < current;
        const active = i === current;
        return (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              active ? (status === "waiting" ? "bg-warn" : "accent-gradient") : done || status === "done" ? "bg-accent/40" : "bg-line"
            }`}
          />
        );
      })}
    </div>
  );
}

function FileAudio({ src, rate, setRate, label, minimal }: { src: string; rate: Rate; setRate: (r: Rate) => void; label: string; minimal: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.playbackRate = rate;
  }, [rate]);
  return (
    <div className="glass border border-line rounded-2xl shadow-sm p-4 sm:p-5 space-y-3">
      <audio ref={ref} controls preload="metadata" src={src} className="w-full" aria-label={label}>
        Your browser does not support audio playback.
      </audio>
      <div className="flex flex-wrap items-center gap-2">
        <RateControl rate={rate} setRate={setRate} />
        {!minimal && (
          <button
            type="button"
            className={ctlSecondary}
            onClick={() => {
              const a = ref.current;
              if (!a) return;
              a.currentTime = 0;
              void a.play();
            }}
          >
            <IconReplay />
            Replay from start
          </button>
        )}
      </div>
    </div>
  );
}

function TtsAudio({
  lines,
  rate,
  setRate,
  shadowing,
  setShadowing,
  showLines,
  label,
  minimal,
}: {
  lines: ScriptLine[];
  rate: Rate;
  setRate: (r: Rate) => void;
  shadowing: boolean;
  setShadowing?: (b: boolean) => void;
  showLines: boolean;
  label: string;
  minimal: boolean;
}) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [status, setStatus] = useState<"idle" | "playing" | "waiting" | "paused" | "done">("idle");
  const [current, setCurrent] = useState(-1);
  const voiceRef = useRef<SpeechSynthesisVoice | undefined>(undefined);
  const timerRef = useRef<number | null>(null);
  /**
   * Generation of the current playback chain. Every stop, replay or unmount bumps it, and a
   * chain checks it before continuing. A single boolean was not enough: replaying reset the
   * flag but left the previous chain's pending timer running, so it resumed the old line
   * sequence alongside the new one, and `cancel()` firing the in-flight utterance's `onend`
   * (as Chrome does) scheduled yet another. Two readings played over each other.
   */
  const runRef = useRef(0);
  const indexRef = useRef(0);

  useEffect(() => {
    const ok = typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
    setSupported(ok);
    if (!ok) return;
    const load = () => {
      voiceRef.current = pickJaVoice();
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
      runRef.current++;
      window.speechSynthesis.cancel();
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const stop = useCallback(() => {
    runRef.current++;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    window.speechSynthesis.cancel();
    setStatus("idle");
    setCurrent(-1);
  }, []);

  const speakFrom = useCallback(
    (start: number) => {
      // Supersede whatever was playing: new generation, drop its pending timer, cancel its utterance.
      const run = ++runRef.current;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = null;
      window.speechSynthesis.cancel();
      const speakLine = (i: number) => {
        if (run !== runRef.current) return;
        if (i >= lines.length) {
          setStatus("done");
          setCurrent(-1);
          return;
        }
        indexRef.current = i;
        setCurrent(i);
        setStatus("playing");
        const u = new SpeechSynthesisUtterance(lines[i].line);
        u.lang = "ja-JP";
        u.rate = rate;
        if (voiceRef.current) u.voice = voiceRef.current;
        u.onend = () => {
          if (run !== runRef.current) return;
          if (shadowing) {
            // Pause long enough for the learner to repeat the line, then continue.
            setStatus("waiting");
            timerRef.current = window.setTimeout(() => speakLine(i + 1), estimateMs(lines[i].line, rate) + 800);
          } else {
            timerRef.current = window.setTimeout(() => speakLine(i + 1), 350);
          }
        };
        u.onerror = () => {
          if (run === runRef.current) setStatus("idle");
        };
        window.speechSynthesis.speak(u);
      };
      speakLine(start);
    },
    [lines, rate, shadowing]
  );

  if (supported === false) {
    return (
      <div className="bg-warn-soft border border-warn/30 rounded-2xl px-4 py-3.5 text-sm text-ink-2 leading-relaxed">
        Your browser does not support speech synthesis, so this exercise cannot be played aloud here. You can still read the transcript and answer the questions.
      </div>
    );
  }

  const busy = status === "playing" || status === "waiting";

  const statusText =
    status === "playing"
      ? `Playing line ${current + 1} of ${lines.length}`
      : status === "waiting"
        ? "Your turn: repeat the line aloud"
        : status === "paused"
          ? "Paused"
          : "Finished";

  return (
    <div role="group" aria-label={label} className="glass border border-line rounded-2xl shadow-sm p-4 sm:p-5 space-y-4">
      <div className="flex items-center gap-4">
        {/* Primary play / pause / resume control */}
        {!busy && status !== "paused" ? (
          <button type="button" aria-label={status === "done" ? "Play again" : shadowing ? "Start shadowing" : "Play"} className={`${bigBtn} accent-gradient text-white shadow-md hover:brightness-105`} onClick={() => speakFrom(0)}>
            <IconPlay />
          </button>
        ) : status === "paused" ? (
          <button
            type="button"
            aria-label="Resume"
            className={`${bigBtn} accent-gradient text-white shadow-md hover:brightness-105`}
            onClick={() => {
              window.speechSynthesis.resume();
              setStatus("playing");
            }}
          >
            <IconPlay />
          </button>
        ) : (
          <button
            type="button"
            aria-label={status === "playing" ? "Pause" : "Stop"}
            className={`${bigBtn} bg-ink text-bg shadow-md hover:opacity-90`}
            onClick={() => {
              if (status === "playing") {
                window.speechSynthesis.pause();
                setStatus("paused");
              } else stop();
            }}
          >
            {status === "playing" ? <IconPause /> : <IconStop />}
          </button>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink truncate" role="status" aria-live="polite">
            {status === "waiting" && <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-warn animate-pulse mr-2 align-middle" />}
            {status === "playing" && <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-ok animate-pulse mr-2 align-middle" />}
            {status === "idle" ? (shadowing ? "Start shadowing" : "Play") : statusText}
          </p>
          <div className="mt-2.5">
            <LineProgress total={lines.length} current={current} status={status} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <RateControl rate={rate} setRate={setRate} />
        {!minimal && (
          <button type="button" className={ctlSecondary} onClick={() => speakFrom(0)}>
            <IconReplay />
            Replay
          </button>
        )}
        {busy && (
          <button type="button" className={ctlSecondary} onClick={stop}>
            <IconStop />
            Stop
          </button>
        )}
        {setShadowing && (
          <button
            type="button"
            role="switch"
            aria-checked={shadowing}
            onClick={() => {
              stop();
              setShadowing(!shadowing);
            }}
            className={`${ctlBtn} pl-3 pr-1.5 border ${shadowing ? "bg-accent-soft border-accent/30 text-accent-ink" : "bg-surface border-line text-ink hover:bg-surface-2"}`}
          >
            <IconMic />
            Shadowing
            <span aria-hidden className={`ml-1.5 relative inline-block h-6 w-10 rounded-full transition ${shadowing ? "bg-accent" : "bg-line-strong"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition ${shadowing ? "left-[1.125rem]" : "left-0.5"}`} />
            </span>
          </button>
        )}
      </div>

      {shadowing && (
        <p className="text-xs text-muted leading-relaxed">
          Shadowing: each line plays once, then there is a pause for you to repeat it aloud before the next line starts.
        </p>
      )}

      {showLines && current >= 0 && (
        <div className="border-t border-line pt-4 flex items-start gap-3">
          <span aria-hidden className="ja shrink-0 h-8 w-8 rounded-full bg-accent-soft text-accent-ink grid place-items-center text-xs font-semibold">
            {lines[current].speaker.trim().charAt(0)}
          </span>
          <div className="min-w-0">
            <p lang="ja" className="ja text-[11px] text-muted">{lines[current].speaker}</p>
            <p lang="ja" className="ja text-lg sm:text-xl leading-relaxed text-ink">
              {lines[current].line}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
