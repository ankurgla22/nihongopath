import { cache } from "react";
import { getGrammar } from "@/lib/content";
import { LEVELS, type GrammarLesson, type Level } from "@/lib/content/schemas";

/**
 * Grammar comparison pairs, derived from the `similarGrammar` cross-references that lesson
 * authors wrote. Every pair page is built only from existing lesson content: the two lessons'
 * meaning, formation and examples, plus the one-line "difference" text from each side that
 * references the other. Nothing on a comparison page is generated.
 *
 * A pair is unordered. Its canonical order (and the level whose URL it lives under) is the
 * earlier lesson: lower level first, then lower lesson number.
 */
export type ComparePair = {
  /** Level segment of the page URL: the earlier lesson's level. */
  level: Level;
  a: GrammarLesson;
  b: GrammarLesson;
  /** How lesson A describes the difference to B, if A references B. */
  abDiff?: string;
  /** How lesson B describes the difference to A, if B references A. */
  baDiff?: string;
};

const grammarById = cache((): Map<string, GrammarLesson> => {
  const m = new Map<string, GrammarLesson>();
  for (const level of LEVELS) for (const g of getGrammar(level)) m.set(g.id, g);
  return m;
});

function rank(g: GrammarLesson) {
  return LEVELS.indexOf(g.level) * 100_000 + g.order;
}

/** Every unique pair on the site. */
export const comparePairs = cache((): ComparePair[] => {
  const byId = grammarById();
  const seen = new Map<string, ComparePair>();
  for (const level of LEVELS) {
    for (const x of getGrammar(level)) {
      for (const s of x.similarGrammar) {
        if (!s.id) continue;
        const y = byId.get(s.id);
        if (!y || y.id === x.id) continue;
        const [a, b] = rank(x) <= rank(y) ? [x, y] : [y, x];
        const key = `${a.id}|${b.id}`;
        const pair = seen.get(key) ?? { level: a.level, a, b };
        // x references y: record the text on the side it was written from.
        if (x.id === a.id) pair.abDiff = s.difference;
        else pair.baDiff = s.difference;
        seen.set(key, pair);
      }
    }
  }
  return [...seen.values()];
});

export const pairsForLevel = cache((level: Level): ComparePair[] => comparePairs().filter((p) => p.level === level));

export function pairPath(p: ComparePair) {
  return `/japanese/${p.level}/grammar/compare/${p.a.slug}/${p.b.slug}`;
}

export function findPair(level: Level, aSlug: string, bSlug: string): ComparePair | undefined {
  return pairsForLevel(level).find((p) => p.a.slug === aSlug && p.b.slug === bSlug);
}

/** The pair a given lesson forms with a similar-grammar target id, for "Compare" links. */
export function pairFor(lesson: GrammarLesson, otherId: string): ComparePair | undefined {
  const key1 = `${lesson.id}|${otherId}`;
  const key2 = `${otherId}|${lesson.id}`;
  return comparePairs().find((p) => `${p.a.id}|${p.b.id}` === key1 || `${p.a.id}|${p.b.id}` === key2);
}
