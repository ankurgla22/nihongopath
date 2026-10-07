"use client";
/**
 * Shared Japanese text-to-speech helper built on the browser SpeechSynthesis API.
 * One utterance plays at a time; starting a new one stops the previous.
 */
let cachedVoice: SpeechSynthesisVoice | null | undefined;
let currentToken = 0;
/** onEnd of the utterance currently playing, so the caller's "playing" state is cleared when another one starts. */
let currentEnd: (() => void) | undefined;

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice !== undefined) return cachedVoice;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null; // not loaded yet; don't cache
  const ja = voices.filter((v) => v.lang.toLowerCase().startsWith("ja"));
  const preferred =
    ja.find((v) => /nanami|keita|google|kyoko|o-?ren|haruka|ayumi|ichiro|sayaka/i.test(v.name)) ?? ja.find((v) => !v.localService) ?? ja[0] ?? null;
  cachedVoice = preferred;
  return preferred;
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.addEventListener?.("voiceschanged", () => {
    cachedVoice = undefined;
  });
}

/**
 * Whether this browser can actually say Japanese. Speech synthesis being present is not enough:
 * without a Japanese voice installed (Windows without the language pack, most Linux desktops)
 * the browser reads kanji and kana with an English voice — silence or gibberish — while every
 * control looks like it is working. "unknown" means the voice list has not loaded yet, which
 * happens on first use in Chrome; callers should treat it as available and re-check on
 * `voiceschanged` (see onVoicesChanged).
 */
export function japaneseVoiceStatus(): "unknown" | "available" | "missing" {
  if (!speechSupported()) return "missing";
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return "unknown";
  return voices.some((v) => v.lang.toLowerCase().startsWith("ja")) ? "available" : "missing";
}

/** Run `cb` when the voice list changes (it loads asynchronously). Returns an unsubscribe. */
export function onVoicesChanged(cb: () => void): () => void {
  if (!speechSupported() || !window.speechSynthesis.addEventListener) return () => {};
  window.speechSynthesis.addEventListener("voiceschanged", cb);
  return () => window.speechSynthesis.removeEventListener("voiceschanged", cb);
}

export type SpeakOptions = { rate?: number; onStart?: () => void; onEnd?: () => void };

/** Speak Japanese text. Returns a stop function. */
export function speakJapanese(text: string, opts: SpeakOptions = {}): () => void {
  if (!speechSupported() || !text.trim()) return () => {};
  const synth = window.speechSynthesis;
  synth.cancel();
  currentEnd?.();
  currentEnd = opts.onEnd;
  const token = ++currentToken;
  const u = new SpeechSynthesisUtterance(text.replace(/[（(][^）)]*[）)]/g, "").replace(/[〜～]/g, ""));
  u.lang = "ja-JP";
  u.rate = opts.rate ?? 0.9;
  u.pitch = 1;
  const voice = pickVoice();
  if (voice) u.voice = voice;
  u.onstart = () => {
    if (token === currentToken) opts.onStart?.();
  };
  const done = () => {
    if (token === currentToken) {
      currentEnd = undefined;
      opts.onEnd?.();
    }
  };
  u.onend = done;
  u.onerror = done;
  // Some browsers need voices loaded first.
  if (!voice && synth.getVoices().length === 0) {
    const once = () => {
      synth.removeEventListener("voiceschanged", once);
      const v = pickVoice();
      if (v) u.voice = v;
      synth.speak(u);
    };
    synth.addEventListener("voiceschanged", once);
    setTimeout(() => {
      synth.removeEventListener("voiceschanged", once);
      if (!synth.speaking && token === currentToken) synth.speak(u);
    }, 300);
  } else {
    synth.speak(u);
  }
  return () => {
    if (token === currentToken) synth.cancel();
  };
}

export function stopSpeaking() {
  if (speechSupported()) window.speechSynthesis.cancel();
  currentToken++;
  const end = currentEnd;
  currentEnd = undefined;
  end?.();
}
