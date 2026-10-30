import "server-only";
import { cache } from "react";
import { getVocabulary } from "@/lib/content";
import { classify, conjugate, GROUP, type Forms, type VerbClass } from "./conjugate";
import { toRomaji } from "./romaji";
import type { Level } from "./schemas";

/** Levels on /japanese/verbs. Every level's data works; N3+ is left out to keep the page a usable size. */
export const VERB_LEVELS = ["n5", "n4"] as const satisfies readonly Level[];

export type Verb = {
  id: string;
  level: Level;
  /** The vocabulary entry this verb comes from: /japanese/<level>/vocabulary/<slug>. */
  slug: string;
  word: string;
  reading: string;
  romaji: string;
  meaning: string;
  cls: VerbClass;
  group: 1 | 2 | 3;
  /** Stored as a noun (生活) and listed here with する added. Its meaning is the noun's. */
  fromNoun: boolean;
  forms: Forms;
  /** Only where the written form hides a reading change: 来ない is こない. */
  readings?: Forms;
};

// v (う), vt, vi, v5r, Verb (…), v-suru, vs, Noun (suru)
const IS_VERB = /(^|[^a-z])v\b|^v\s*\(|\bv[ti]\b|\bvs\b|\bv5|verb|suru|する/i;
const IS_SURU_NOUN = /v-suru|\bvs\b|\(suru\)/i;

export const getVerbs = cache((): Verb[] => {
  const seen = new Set<string>();
  const out: Verb[] = [];
  for (const level of VERB_LEVELS) {
    for (const v of getVocabulary(level)) {
      if (!IS_VERB.test(v.pos)) continue;
      const fromNoun = IS_SURU_NOUN.test(v.pos) && !v.word.endsWith("する");
      const word = fromNoun ? `${v.word}する` : v.word;
      const reading = fromNoun ? `${v.reading}する` : v.reading;
      // 運転 is in N4 as a noun and in N5 as 運転する: keep the first (lower) level.
      if (seen.has(word)) continue;
      seen.add(word);
      const cls = classify(word, reading, v.pos);
      const forms = conjugate(word, cls);
      const suru = cls === "suru" && word !== "する";
      out.push({
        id: v.id,
        level,
        slug: v.slug,
        word,
        reading,
        romaji: suru ? `${toRomaji(reading.slice(0, -2))} suru` : toRomaji(reading),
        meaning: v.meaning,
        cls,
        group: GROUP[cls],
        fromNoun,
        forms,
        readings: cls === "kuru" && word.includes("来") ? conjugate(reading, cls, word) : undefined,
      });
    }
  }
  return out;
});
