"use client";
/**
 * Card lists for the vocabulary, grammar and kanji index pages.
 *
 * These are client components on purpose: the server passes only compact data (a short tuple
 * per item) instead of a full element tree, so the RSC payload embedded in the HTML stays small
 * while the server-rendered markup (what crawlers see) is complete.
 *
 * Markup per item is deliberately minimal and styled by the `.vcard` / `.gcard` / `.ktile`
 * classes in globals.css: hundreds of items render per page, so every byte per card counts.
 * Vocabulary items keep `data-filter-text` so a filter can hide them in place.
 */
import Link from "next/link";
import { useEffect, useState, type MouseEvent } from "react";
import { speakJapanese, speechSupported, stopSpeaking } from "@/lib/speech";

/** [slug, order, word, reading, meaning, pos] */
export type VocabCard = [slug: string, order: number, word: string, reading: string, meaning: string, pos: string];
/** [slug, order, title, meaning] */
export type GrammarCard = [slug: string, order: number, title: string, meaning: string];
/** [slug, character, first meaning, enriched] */
export type KanjiCard = [slug: string, character: string, meaning: string, enriched: boolean];

/**
 * One delegated handler for every tap-to-play word in the list (no per-card React state).
 * The play control is a button beside the card link, not inside it, so a card is one tab stop
 * and the browser's own Enter/Space handling on the button is enough — no key handler here.
 */
function onSpeakClick(e: MouseEvent<HTMLUListElement>) {
  const el = (e.target as HTMLElement).closest<HTMLElement>("[data-speak]");
  if (!el) return;
  e.preventDefault();
  if (el.getAttribute("aria-pressed") === "true") {
    stopSpeaking();
    el.setAttribute("aria-pressed", "false");
    return;
  }
  // Starting a new utterance cancels the previous one, whose onEnd is token-guarded and never fires:
  // reset any other pressed word in this list so its state does not go stale.
  e.currentTarget.querySelectorAll<HTMLElement>('[data-speak][aria-pressed="true"]').forEach((b) => b.setAttribute("aria-pressed", "false"));
  speakJapanese(el.dataset.speak ?? "", {
    onStart: () => el.setAttribute("aria-pressed", "true"),
    onEnd: () => el.setAttribute("aria-pressed", "false"),
  });
}

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5 6 9H3v6h3l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    </svg>
  );
}

export function VocabCards({ base, items }: { base: string; items: VocabCard[] }) {
  const [speech, setSpeech] = useState(true);
  useEffect(() => setSpeech(speechSupported()), []);
  // Speech outlives the DOM: leaving the vocabulary list (tap a word, then open its lesson)
  // would otherwise keep reading it over the next page.
  useEffect(() => () => stopSpeaking(), []);
  return (
    <ul className="vgrid" onClick={onSpeakClick} data-nospeech={speech ? undefined : ""}>
      {items.map(([slug, , word, reading, meaning, pos]) => (
        <li key={slug} data-filter-text={`${word} ${reading} ${meaning} ${pos}`.toLowerCase()}>
          {/* `pr-9` reserves the corner the play button sits in; `.vgrid > li` is already positioned. */}
          <Link href={`${base}/${slug}`} prefetch={false} className={speech ? "vcard pr-9" : "vcard"}>
            <b lang="ja">{word}</b>
            {reading !== word && <i lang="ja">{reading}</i>}
            <span>{meaning}</span>
          </Link>
          {speech && (
            <button
              type="button"
              data-speak={word}
              aria-label={`Play ${word}`}
              aria-pressed="false"
              className="absolute right-1.5 top-1.5 z-[1] grid h-7 w-7 place-items-center rounded-md text-muted transition hover:text-accent focus:outline-none focus-visible:shadow-ring aria-[pressed=true]:text-accent"
            >
              <SpeakerIcon />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function GrammarCards({ base, items, start }: { base: string; items: GrammarCard[]; start: number }) {
  return (
    <ol className="ggrid" start={start}>
      {items.map(([slug, order, title, meaning]) => (
        <li key={slug}>
          <Link href={`${base}/${slug}`} prefetch={false} className="gcard">
            <small>{order}</small>
            <b lang="ja">{title}</b>
            <span>{meaning}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

export function KanjiGrid({ base, items }: { base: string; items: KanjiCard[] }) {
  return (
    <ul className="kgrid">
      {items.map(([slug, character, meaning, enriched]) => (
        <li key={slug}>
          <Link href={`${base}/${slug}`} prefetch={false} className={enriched ? "ktile full" : "ktile"}>
            <b lang="ja">{character}</b>
            <span>{meaning}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
