/**
 * Verb meaning questions for /quiz/verbs, built from the verb list rather than the question bank.
 *
 * Pure and client-safe: the server builds the first round (with a fixed seed, so the HTML holds real
 * questions), and the browser builds every later round and every mode change with Math.random.
 */
import type { QuizQuestion } from "./shared";

/** What the browser needs per verb. The page ships ~360 of these, about 40 KB. */
export type VerbCard = {
  id: string;
  word: string;
  reading: string;
  romaji: string;
  meaning: string;
  level: "n5" | "n4";
  group: 1 | 2 | 3;
  polite: string;
  /** Stored as a noun (食事 → 食事する), so its meaning reads like one: "meal, dining". */
  noun: boolean;
};

/** ja-en: the verb is shown, choose its meaning. en-ja: the meaning is shown, choose the verb. */
export type VerbQuizMode = "ja-en" | "en-ja" | "mix";
export type VerbQuizLevel = "all" | "n5" | "n4";

export const OPTIONS = 4;

/** "食べる（たべる）", or just the word when it is written in kana. */
export function verbLabel(v: Pick<VerbCard, "word" | "reading">): string {
  return v.word === v.reading ? v.word : `${v.word}（${v.reading}）`;
}

/**
 * A meaning's separate glosses, normalised: "to open (transitive)" → ["open"]; "to raise, to give"
 * → ["raise", "give"]. Two verbs that share one cannot appear in the same question, or a learner
 * could pick a right answer and be marked wrong: あげる (to give) next to 上げる (to raise, to give).
 */
export function glosses(meaning: string): string[] {
  return meaning
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .split(/[,;/]/)
    .map((g) => g.trim().replace(/^to\s+/, "").replace(/^be\s+/, "").trim())
    .filter(Boolean);
}

function clashes(a: VerbCard, b: VerbCard): boolean {
  if (a.word === b.word || a.reading === b.reading || a.meaning.toLowerCase() === b.meaning.toLowerCase()) return true;
  const ga = new Set(glosses(a.meaning));
  return glosses(b.meaning).some((g) => ga.has(g));
}

function shuffle<T>(items: T[], rnd: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A small seeded generator, so the server's first round is the same on every build. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function filterLevel(cards: VerbCard[], level: VerbQuizLevel): VerbCard[] {
  return level === "all" ? cards : cards.filter((c) => c.level === level);
}

/**
 * One question per verb, in random order, with three wrong options drawn from the same pool. A verb
 * with too few non-clashing partners to make four options is skipped rather than asked with fewer.
 */
export function buildVerbQuestions(cards: VerbCard[], mode: VerbQuizMode, rnd: () => number = Math.random): QuizQuestion[] {
  const out: QuizQuestion[] = [];
  for (const v of shuffle(cards, rnd)) {
    const wrong: VerbCard[] = [];
    for (const d of shuffle(cards, rnd)) {
      if (wrong.length === OPTIONS - 1) break;
      // Same kind only: one noun meaning among three "to …" meanings would give the answer away.
      if (d === v || d.noun !== v.noun || clashes(v, d) || wrong.some((w) => clashes(w, d))) continue;
      wrong.push(d);
    }
    if (wrong.length < OPTIONS - 1) continue;
    const dir = mode === "mix" ? (rnd() < 0.5 ? "ja-en" : "en-ja") : mode;
    const opts = shuffle([v, ...wrong], rnd);
    out.push({
      id: `${v.id}:${dir}`,
      prompt: dir === "ja-en" ? `What does ${verbLabel(v)} mean?` : `Which verb means “${v.meaning}”?`,
      options: opts.map((o) => (dir === "ja-en" ? o.meaning : verbLabel(o))),
      answerIndex: opts.indexOf(v),
      explanation: `${verbLabel(v)}, ${v.romaji}: “${v.meaning}”. Group ${v.group} verb, polite form ${v.polite}.`,
      // N5 before N4 within a round, matching how the quiz orders by difficulty.
      difficulty: v.level === "n5" ? 1 : 2,
    });
  }
  return out;
}
