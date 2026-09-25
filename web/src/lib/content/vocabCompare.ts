import { cache } from "react";
import raw from "../../../content/vocab-compare.json";
import { findVocab, getVocabulary } from "@/lib/content";
import { LEVELS, type Level, type VocabItem } from "@/lib/content/schemas";

/**
 * "会う vs 合う" pages: the question learners actually type, answered properly.
 *
 * The grammar side of the site already has 1,157 of these, built from the `difference` sentence a
 * lesson author wrote about a similar pattern. Vocabulary had nothing equivalent — synonyms and
 * antonyms are stored as bare words with no note about how they differ — so 7,281 pairs could have
 * been generated mechanically and every one of them would have been two dictionary entries side by
 * side. That is thin content, and at that scale it is the kind Google treats as abuse.
 *
 * So these are written, not derived: a curated set of genuinely confusable groups, each with an
 * authored rule, contrast sentences where the choice is forced, and the mistakes learners really
 * make. content/vocab-compare.json holds that text; this module joins it to the vocabulary entries
 * so the page can link to both words and show their readings.
 */
export type CompareExample = { ja: string; reading: string; en: string; note?: string };

export type VocabCompareMember = {
  word: string;
  /** The rule for this word, written by the author. */
  when: string;
  examples: CompareExample[];
  /** Resolved from the vocabulary content; absent if the word was later removed. */
  item?: VocabItem;
  level?: Level;
};

export type VocabCompare = {
  id: string;
  slug: string;
  level: Level;
  title: string;
  /** Stands alone as the answer — what a snippet or an AI response will quote. */
  quickAnswer: string;
  summary: string;
  members: VocabCompareMember[];
  contrast: CompareExample[];
  mistakes: { wrong: string; right: string; why: string }[];
  faq: { q: string; a: string }[];
};

type RawCompare = Omit<VocabCompare, "members" | "level"> & {
  level: string;
  members: { word: string; when: string; examples: CompareExample[] }[];
};

/** Where a word lives, searched from the lowest level up so the first hit is where it is taught. */
function locate(word: string): { item: VocabItem; level: Level } | undefined {
  for (const level of LEVELS) {
    const item = getVocabulary(level).find((v) => v.word === word);
    if (item) return { item, level };
  }
  return undefined;
}

export const vocabComparisons = cache((): VocabCompare[] =>
  (raw as RawCompare[]).map((c) => ({
    ...c,
    level: c.level as Level,
    members: c.members.map((m) => {
      const hit = locate(m.word);
      return { ...m, item: hit?.item, level: hit?.level };
    }),
  }))
);

export const findVocabCompare = cache((level: string, slug: string): VocabCompare | undefined =>
  vocabComparisons().find((c) => c.level === level && c.slug === slug)
);

export function vocabComparePath(c: VocabCompare): string {
  return `/japanese/${c.level}/vocabulary/compare/${c.slug}`;
}

/** Comparisons that mention a word, for cross-linking from its own page. */
export const comparisonsForWord = cache((word: string): VocabCompare[] =>
  vocabComparisons().filter((c) => c.members.some((m) => m.word === word))
);

/** Kept for the vocabulary detail page, which links to the word's own entry. */
export function memberHref(m: VocabCompareMember): string | undefined {
  if (!m.item || !m.level) return undefined;
  return `/japanese/${m.level}/vocabulary/${m.item.slug}`;
}

export { findVocab };
