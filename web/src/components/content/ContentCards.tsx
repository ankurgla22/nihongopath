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
 * Vocabulary items keep `data-filter-text` so <FilterList> can filter them in place.
 */
import Link from "next/link";
import { useEffect, useState, type MouseEvent } from "react";
import { speakJapanese, speechSupported, stopSpeaking } from "@/lib/speech";

/** [slug, order, word, reading, meaning, pos, enriched] */
export type VocabCard = [slug: string, order: number, word: string, reading: string, meaning: string, pos: string, enriched: boolean];
/** [slug, order, title, meaning, enriched] */
export type GrammarCard = [slug: string, order: number, title: string, meaning: string, enriched: boolean];
/** [slug, character, first meaning, enriched] */
export type KanjiCard = [slug: string, character: string, meaning: string, enriched: boolean];

/** Shared SVG symbols referenced with <use href="#…"/> so the icon path is emitted once per page. */
export function IconDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <symbol id="i-speak" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 5 6 9H3v6h3l5 4V5z" fill="currentColor" stroke="none" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
      </symbol>
    </svg>
  );
}

/** One delegated click handler for every listen button in the list (no per-card React state). */
function onSpeakClick(e: MouseEvent<HTMLUListElement>) {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-speak]");
  if (!btn) return;
  if (btn.getAttribute("aria-pressed") === "true") {
    stopSpeaking();
    btn.setAttribute("aria-pressed", "false");
    return;
  }
  // Starting a new utterance cancels the previous one, whose onEnd is token-guarded and never fires:
  // reset any other pressed button in this list so its state does not go stale.
  e.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-speak][aria-pressed="true"]').forEach((b) => b.setAttribute("aria-pressed", "false"));
  speakJapanese(btn.dataset.speak ?? "", {
    onStart: () => btn.setAttribute("aria-pressed", "true"),
    onEnd: () => btn.setAttribute("aria-pressed", "false"),
  });
}

export function VocabCards({ base, items }: { base: string; items: VocabCard[] }) {
  const [speech, setSpeech] = useState(true);
  useEffect(() => setSpeech(speechSupported()), []);
  return (
    <ul className="vgrid" onClick={onSpeakClick} data-nospeech={speech ? undefined : ""}>
      {items.map(([slug, order, word, reading, meaning, pos, enriched]) => (
        <li key={slug} data-filter-text={`${word} ${reading} ${meaning} ${pos}`.toLowerCase()}>
          <Link href={`${base}/${slug}`} prefetch={false} className="vcard">
            <b lang="ja">{word}</b>
            {reading !== word && <i lang="ja">{reading}</i>}
            <small>{`#${order}`}</small>
            <span>{meaning}</span>
            {enriched && <em>Full</em>}
          </Link>
          {/* Sibling of the link (a button may not live inside <a>) */}
          <button type="button" className="vspeak" data-speak={word} aria-label={`Listen: ${word}`} aria-pressed="false">
            <svg aria-hidden>
              <use href="#i-speak" />
            </svg>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function GrammarCards({ base, items, start }: { base: string; items: GrammarCard[]; start: number }) {
  return (
    <ol className="ggrid" start={start}>
      {items.map(([slug, order, title, meaning, enriched]) => (
        <li key={slug}>
          <Link href={`${base}/${slug}`} prefetch={false} className="gcard">
            <small>{order}</small>
            <b lang="ja">{title}</b>
            {enriched && <em>Full lesson</em>}
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
