"use client";
import { useEffect, useRef, useState } from "react";
import { speakJapanese, speechSupported, stopSpeaking } from "@/lib/speech";

type Props = {
  /** Japanese text to read aloud. */
  text: string;
  /** Visual size. */
  size?: "xs" | "sm" | "md";
  /** Show the word "Listen" next to the icon. */
  label?: boolean;
  /** Speaking rate (0.5–1.5). */
  rate?: number;
  className?: string;
  /** Stop click from bubbling (e.g. inside link cards). */
  stopPropagation?: boolean;
};

/**
 * A small speaker button that reads Japanese aloud with the browser's Japanese voice.
 * Renders nothing if speech synthesis is unavailable (server render shows a disabled placeholder
 * so layout stays stable; it enables after hydration).
 */
export function SpeakButton({ text, size = "sm", label = false, rate, className = "", stopPropagation = true }: Props) {
  const [playing, setPlaying] = useState(false);
  const [supported, setSupported] = useState(true);
  const playingRef = useRef(false);
  useEffect(() => setSupported(speechSupported()), []);
  // Speech outlives the DOM: without this, tapping a word and then moving on (Next question,
  // or a link to another page) leaves the old sentence being read over the new screen, with no
  // visible control to stop it, because the button that owned the state is gone.
  useEffect(() => () => {
    if (playingRef.current) stopSpeaking();
  }, []);
  if (!supported) return null;

  const sizes = { xs: "h-6 w-6", sm: "h-8 w-8", md: "h-10 w-10" };
  const icon = { xs: 12, sm: 15, md: 18 }[size];
  const base = label ? `h-8 px-3 gap-1.5 rounded-full text-xs font-medium` : `${sizes[size]} rounded-full`;

  return (
    <button
      type="button"
      onClick={(e) => {
        if (stopPropagation) {
          e.preventDefault();
          e.stopPropagation();
        }
        if (playing) {
          playingRef.current = false;
          setPlaying(false);
          stopSpeaking();
          return;
        }
        speakJapanese(text, {
          rate,
          onStart: () => {
            playingRef.current = true;
            setPlaying(true);
          },
          onEnd: () => {
            playingRef.current = false;
            setPlaying(false);
          },
        });
      }}
      aria-label={playing ? "Stop" : `Listen: ${text}`}
      aria-pressed={playing}
      title={playing ? "Stop" : "Listen"}
      className={`relative inline-flex shrink-0 items-center justify-center border transition ${size !== "md" && !label ? "touch-target" : ""} ${
        playing ? "bg-accent text-white border-accent" : "bg-surface border-line text-ink-2 hover:text-accent hover:border-accent/50 hover:bg-accent-soft"
      } ${base} ${className}`}
    >
      {playing ? (
        <svg width={icon} height={icon} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      ) : (
        <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M11 5 6 9H3v6h3l5 4V5z" fill="currentColor" stroke="none" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
        </svg>
      )}
      {label && <span>{playing ? "Stop" : "Listen"}</span>}
    </button>
  );
}
