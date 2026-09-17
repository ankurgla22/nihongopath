"use client";
import { useCallback, useState } from "react";

/** One kana chart cell. Click to hear the sound with browser speech synthesis (ja-JP). */
export function KanaTile({ kana, romaji }: { kana: string; romaji: string }) {
  const [playing, setPlaying] = useState(false);

  const speak = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(kana);
    u.lang = "ja-JP";
    u.rate = 0.85;
    const voice = synth.getVoices().find((v) => v.lang.replace("_", "-").toLowerCase().startsWith("ja"));
    if (voice) u.voice = voice;
    u.onstart = () => setPlaying(true);
    u.onend = () => setPlaying(false);
    u.onerror = () => setPlaying(false);
    synth.speak(u);
  }, [kana]);

  return (
    <button
      type="button"
      onClick={speak}
      aria-label="Play sound"
      title={`${kana} · ${romaji}`}
      className={`group relative flex h-full w-full flex-col items-center justify-center rounded-xl border px-1 py-2.5 sm:py-3 transition active:scale-[0.97] ${
        playing ? "border-accent bg-accent-soft shadow-ring" : "border-line bg-surface hover:border-accent/50 hover:bg-bg-elev hover:shadow-sm"
      }`}
    >
      <span lang="ja" className={`ja text-3xl sm:text-4xl leading-none font-medium transition ${playing ? "text-accent-ink" : "text-ink group-hover:text-accent"}`}>
        {kana}
      </span>
      <span className="mt-1.5 text-[11px] sm:text-xs text-muted leading-none tracking-wide">{romaji}</span>
      <svg aria-hidden className={`absolute right-1.5 top-1.5 h-3 w-3 transition ${playing ? "text-accent" : "text-line-strong opacity-0 group-hover:opacity-100"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 5 6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
      </svg>
    </button>
  );
}
