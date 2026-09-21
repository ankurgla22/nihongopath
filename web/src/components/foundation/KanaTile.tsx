"use client";
import { useState } from "react";
import { speakJapanese } from "@/lib/speech";

/** One kana chart cell. The tile itself is the control: tap to hear the sound (ja-JP speech synthesis). */
export function KanaTile({ kana, romaji }: { kana: string; romaji: string }) {
  const [playing, setPlaying] = useState(false);

  return (
    <button
      type="button"
      onClick={() => speakJapanese(kana, { rate: 0.85, onStart: () => setPlaying(true), onEnd: () => setPlaying(false) })}
      aria-label={`Play ${kana}`}
      aria-pressed={playing}
      title={`${kana} · ${romaji}`}
      className={`group relative flex h-full w-full flex-col items-center justify-center rounded-xl border px-1 py-2.5 sm:py-3 transition active:scale-[0.97] ${
        playing ? "border-accent bg-accent-soft shadow-ring" : "border-line bg-surface hover:border-accent/50 hover:bg-bg-elev hover:shadow-sm"
      }`}
    >
      <span lang="ja" className={`ja text-3xl sm:text-4xl leading-none font-medium transition ${playing ? "text-accent-ink" : "text-ink group-hover:text-accent"}`}>
        {kana}
      </span>
      <span className="mt-1.5 text-[11px] sm:text-xs text-muted leading-none tracking-wide">{romaji}</span>
    </button>
  );
}
