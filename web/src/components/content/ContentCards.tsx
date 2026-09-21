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
import { useEffect, useState, type KeyboardEvent, type MouseEvent, type SyntheticEvent } from "react";
import { speakJapanese, speechSupported, stopSpeaking } from "@/lib/speech";

/** [slug, order, word, reading, meaning, pos] */
export type VocabCard = [slug: string, order: number, word: string, reading: string, meaning: string, pos: string];
/** [slug, order, title, meaning] */
export type GrammarCard = [slug: string, order: number, title: string, meaning: string];
/** [slug, character, first meaning, enriched] */
export type KanjiCard = [slug: string, character: string, meaning: string, enriched: boolean];

/**
 * One delegated handler for every tap-to-play word in the list (no per-card React state).
 * The word sits inside the card link, so playing it must not also navigate.
 */
function playFromEvent(e: SyntheticEvent<HTMLUListElement>) {
  const el = (e.target as HTMLElement).closest<HTMLElement>("[data-speak]");
  if (!el) return false;
  e.preventDefault();
  if (el.getAttribute("aria-pressed") === "true") {
    stopSpeaking();
    el.setAttribute("aria-pressed", "false");
    return true;
  }
  // Starting a new utterance cancels the previous one, whose onEnd is token-guarded and never fires:
  // reset any other pressed word in this list so its state does not go stale.
  e.currentTarget.querySelectorAll<HTMLElement>('[data-speak][aria-pressed="true"]').forEach((b) => b.setAttribute("aria-pressed", "false"));
  speakJapanese(el.dataset.speak ?? "", {
    onStart: () => el.setAttribute("aria-pressed", "true"),
    onEnd: () => el.setAttribute("aria-pressed", "false"),
  });
  return true;
}

function onSpeakClick(e: MouseEvent<HTMLUListElement>) {
  playFromEvent(e);
}

function onSpeakKey(e: KeyboardEvent<HTMLUListElement>) {
  if (e.key !== "Enter" && e.key !== " ") return;
  playFromEvent(e);
}

export function VocabCards({ base, items }: { base: string; items: VocabCard[] }) {
  const [speech, setSpeech] = useState(true);
  useEffect(() => setSpeech(speechSupported()), []);
  return (
    <ul className="vgrid" onClick={onSpeakClick} onKeyDown={onSpeakKey} data-nospeech={speech ? undefined : ""}>
      {items.map(([slug, , word, reading, meaning, pos]) => (
        <li key={slug} data-filter-text={`${word} ${reading} ${meaning} ${pos}`.toLowerCase()}>
          <Link href={`${base}/${slug}`} prefetch={false} className="vcard">
            {speech ? (
              <b lang="ja" data-speak={word} role="button" tabIndex={0} aria-label={`Play ${word}`} aria-pressed="false">
                {word}
              </b>
            ) : (
              <b lang="ja">{word}</b>
            )}
            {reading !== word && <i lang="ja">{reading}</i>}
            <span>{meaning}</span>
          </Link>
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
