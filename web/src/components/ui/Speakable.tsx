"use client";
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { speakJapanese, speechSupported, stopSpeaking } from "@/lib/speech";

type Props = {
  /** Japanese text to read aloud. */
  text: string;
  /** What to render; defaults to the text itself. */
  children?: ReactNode;
  as?: "span" | "p" | "div" | "code";
  className?: string;
  /** Speaking rate (0.5–1.5). */
  rate?: number;
  /** Stop the click from reaching a parent link/card. */
  stopPropagation?: boolean;
};

/**
 * Tap-to-play Japanese text. The text itself is the control: tapping (or Enter/Space) reads it aloud,
 * and while it plays the text carries an accent underline. There is no separate speaker icon.
 * Before hydration, or without speech synthesis, it renders as plain text.
 */
export function Speakable({ text, children, as: Tag = "span", className = "", rate, stopPropagation = true }: Props) {
  const [playing, setPlaying] = useState(false);
  const [supported, setSupported] = useState(false);
  const playingRef = useRef(false);
  useEffect(() => setSupported(speechSupported()), []);
  // Speech outlives the DOM: without this, tapping a word and then moving on (Next question,
  // or a link to another page) leaves the old sentence being read over the new screen, with no
  // visible control to stop it, because the button that owned the state is gone.
  useEffect(() => () => {
    if (playingRef.current) stopSpeaking();
  }, []);

  if (!supported) {
    return (
      <Tag lang="ja" className={`ja ${className}`}>
        {children ?? text}
      </Tag>
    );
  }

  const toggle = () => {
    if (playing) {
      stopSpeaking();
      playingRef.current = false;
      setPlaying(false);
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
  };
  const onClick = (e: MouseEvent) => {
    if (stopPropagation) {
      e.preventDefault();
      e.stopPropagation();
    }
    toggle();
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    if (stopPropagation) e.stopPropagation();
    toggle();
  };

  return (
    <Tag
      lang="ja"
      role="button"
      tabIndex={0}
      aria-label={`Play ${text}`}
      aria-pressed={playing}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={`ja cursor-pointer select-text rounded-sm underline-offset-4 decoration-2 transition focus-visible:outline-none focus-visible:shadow-ring ${
        playing ? "underline decoration-accent" : "hover:underline hover:decoration-accent/40"
      } ${className}`}
    >
      {children ?? text}
    </Tag>
  );
}
