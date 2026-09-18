/**
 * Drill generator: builds multiple-choice questions for any vocabulary word or kanji on the fly,
 * so every one of the ~8,000 items is quizzable without a stored question per item.
 *
 * Ports the distractor rules of scripts/generate-questions.ts:
 *   - vocab meaning: same part-of-speech distractors first, never a synonym or a same/overlapping meaning
 *   - vocab reading: words sharing a kanji first, then same reading length; never an alternative reading
 *     of the target word (日本 にほん/にっぽん)
 *   - kanji reading: an example word containing the kanji; distractors are readings of other kanji's words
 *   - kanji meaning: meanings of other kanji that do not overlap with the target's meanings
 *   - always 4 unique options; an item kind is skipped when fewer than 3 valid distractors exist
 *
 * Pure and deterministic: every choice for an item is driven by mulberry32 seeded with
 * `${seed}:${itemId}:${kind}`, so the same seed always gives the same options regardless of which other
 * items are in the batch. No server-only imports — usable from server components, API routes and tests.
 */
import type { KanjiItem, Level, Question, VocabItem } from "@/lib/content/schemas";
import { hashSeed, mulberry32 } from "@/lib/engine/scoring";

export type DrillKind = "meaning" | "reading";
export const DRILL_KINDS: DrillKind[] = ["meaning", "reading"];

export type DrillOptions = {
  seed: string;
  /** Question kinds to generate, in priority order. Default: both. */
  kinds?: DrillKind[];
  /** Maximum questions per item (default: one per kind). */
  perItem?: number;
};

const DIFF: Record<Level, { easy: number; hard: number }> = {
  n5: { easy: 1, hard: 2 },
  n4: { easy: 2, hard: 2 },
  n3: { easy: 2, hard: 3 },
  n2: { easy: 3, hard: 4 },
  n1: { easy: 4, hard: 5 },
};

/* ---------- seeded helpers ---------- */
function shuffled<T>(items: T[], rand: () => number): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const sample = <T>(items: T[], n: number, rand: () => number) => shuffled(items, rand).slice(0, n);
const randFor = (seed: string, id: string, kind: DrillKind) => mulberry32(hashSeed(`${seed}:${id}:${kind}`));

/* ---------- text helpers (identical to the generator script) ---------- */
const isKanji = (ch: string) => /[一-龯]/.test(ch);
const hasKanji = (s: string) => [...s].some(isKanji);
const kanjiOf = (s: string) => [...s].filter(isKanji);
const primaryMeaning = (m: string) => m.split(/[;,]/)[0].trim();
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const normWord = (s: string) => s.replace(/[〜～\s]/g, "").toLowerCase();
const isKanaReading = (s: string) => /^[ぁ-ゖァ-ヺー]+$/.test(s);
const isReadable = (w: { word: string; reading: string }) => hasKanji(w.word) && !/[〜～]/.test(w.word) && isKanaReading(w.reading) && w.reading !== w.word;
const hasMeaning = (m: string | undefined): m is string => Boolean(m) && m !== "—";

function sameMeaning(a: string, b: string): boolean {
  const x = norm(primaryMeaning(a));
  const y = norm(primaryMeaning(b));
  return x === y || (x.length > 3 && y.includes(x)) || (y.length > 3 && x.includes(y));
}

type Opt = { text: string; note: string };

function mc(rand: () => number, correct: Opt, distractors: Opt[]): { options: string[]; answerIndex: number; distractorExplanations: string[] } | null {
  if (distractors.length < 3) return null;
  const opts = shuffled([correct, ...distractors.slice(0, 3)], rand);
  const answerIndex = opts.findIndex((o) => o === correct);
  return { options: opts.map((o) => o.text), answerIndex, distractorExplanations: opts.map((o) => (o === correct ? `Correct: ${o.note}` : o.note)) };
}

function pickDistractors<T>(
  rand: () => number,
  primary: T[],
  fallback: T[],
  text: (t: T) => string,
  ok: (t: T) => boolean,
  taken: Set<string>,
  distinct: (a: T, b: T) => boolean = () => true
): T[] {
  const out: T[] = [];
  const seen = new Set(taken);
  for (const pool of [primary, fallback]) {
    for (const c of shuffled(pool, rand)) {
      if (out.length >= 3) break;
      const t = text(c);
      if (seen.has(t) || !ok(c) || !out.every((o) => distinct(o, c))) continue;
      seen.add(t);
      out.push(c);
    }
    if (out.length >= 3) break;
  }
  return out;
}

/** Every reading known for each word across the given entries (readings like "し／よん" are split). */
function readingIndex(entries: { word: string; reading: string }[]): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const { word, reading } of entries) {
    if (!word || !reading) continue;
    let set = m.get(word);
    if (!set) m.set(word, (set = new Set()));
    for (const r of reading.split(/[／/]/)) set.add(r.trim());
  }
  return m;
}

function resolveKinds(opts: DrillOptions): { kinds: DrillKind[]; perItem: number } {
  const kinds = (opts.kinds && opts.kinds.length ? opts.kinds : DRILL_KINDS).filter((k, i, a) => a.indexOf(k) === i);
  const perItem = Math.max(1, Math.floor(opts.perItem ?? kinds.length));
  return { kinds, perItem };
}

/* ---------- vocabulary ---------- */
function vocabMeaning(v: VocabItem, pool: VocabItem[], rand: () => number): Question | null {
  if (!hasMeaning(v.meaning)) return null;
  // Synonyms are Japanese words, so compare them as trimmed strings (`norm` is for English meanings only).
  const synonyms = new Set(v.synonyms.map(normWord).filter(Boolean));
  const ok = (c: VocabItem) => c.id !== v.id && hasMeaning(c.meaning) && !sameMeaning(c.meaning, v.meaning) && !synonyms.has(normWord(c.word)) && !synonyms.has(normWord(c.reading));
  const samePos = pool.filter((c) => c.pos === v.pos);
  const ds = pickDistractors(rand, samePos, pool, (c) => primaryMeaning(c.meaning), ok, new Set([primaryMeaning(v.meaning)]), (a, b) => !sameMeaning(a.meaning, b.meaning));
  const q = mc(
    rand,
    { text: primaryMeaning(v.meaning), note: `${v.word} means ${primaryMeaning(v.meaning)}.` },
    ds.map((c) => ({ text: primaryMeaning(c.meaning), note: `${c.word} means ${primaryMeaning(c.meaning)}.` }))
  );
  if (!q) return null;
  const ex = v.examples[0];
  const reading = hasKanji(v.word) && v.reading && v.reading !== v.word ? ` (${v.reading})` : "";
  return {
    id: `q-drill-v-${v.id}-meaning`,
    type: "mc",
    level: v.level,
    difficulty: DIFF[v.level].easy,
    skill: "vocabulary",
    topic: v.word,
    tags: { grammarIds: [], vocabIds: [v.id], kanjiIds: [] },
    prompt: `What does ${v.word} mean?`,
    ...q,
    explanation: `${v.word}${reading} means ${v.meaning}.${ex ? ` Example: ${ex.ja} — ${ex.en}` : ""}`,
  };
}

function vocabReading(v: VocabItem, pool: VocabItem[], rand: () => number, readingsOf: (word: string) => Set<string>): Question | null {
  if (!isReadable(v)) return null;
  const readable = pool.filter(isReadable);
  const ks = new Set(kanjiOf(v.word));
  const valid = readingsOf(v.word);
  const ok = (c: VocabItem) => c.id !== v.id && !valid.has(c.reading);
  const shared = readable.filter((c) => c.id !== v.id && kanjiOf(c.word).some((k) => ks.has(k)));
  const sameLen = readable.filter((c) => c.id !== v.id && [...c.reading].length === [...v.reading].length);
  const ds = pickDistractors(rand, shared, sameLen.length >= 3 ? sameLen : readable, (c) => c.reading, ok, new Set([v.reading]));
  const q = mc(
    rand,
    { text: v.reading, note: `${v.word} is read ${v.reading}.` },
    ds.map((c) => ({ text: c.reading, note: `${c.reading} is the reading of ${c.word} (${primaryMeaning(c.meaning)}).` }))
  );
  if (!q) return null;
  const ex = v.examples[0];
  return {
    id: `q-drill-v-${v.id}-reading`,
    type: "mc",
    level: v.level,
    difficulty: DIFF[v.level].hard,
    skill: "vocabulary",
    topic: v.word,
    tags: { grammarIds: [], vocabIds: [v.id], kanjiIds: [] },
    prompt: `How is ${v.word} read?`,
    ...q,
    explanation: `${v.word} (${v.reading}) means ${v.meaning}.${ex ? ` Example: ${ex.ja} — ${ex.en}` : ""}`,
  };
}

/**
 * Drill questions for `items`, with distractors drawn from `pool` (normally every word of the same
 * level; the items themselves need not be in the pool). Items for which no valid question can be built
 * are skipped, so the result may be shorter than items × kinds.
 */
export function generateVocabDrill(items: VocabItem[], pool: VocabItem[], opts: DrillOptions): Question[] {
  const { kinds, perItem } = resolveKinds(opts);
  const full = [...pool, ...items.filter((i) => !pool.some((p) => p.id === i.id))];
  const readings = readingIndex(full);
  const readingsOf = (word: string) => readings.get(word) ?? new Set<string>();
  const out: Question[] = [];
  const seen = new Set<string>();
  for (const v of items) {
    if (seen.has(v.id)) continue;
    seen.add(v.id);
    let n = 0;
    for (const kind of kinds) {
      if (n >= perItem) break;
      const rand = randFor(opts.seed, v.id, kind);
      const q = kind === "meaning" ? vocabMeaning(v, full, rand) : vocabReading(v, full, rand, readingsOf);
      if (!q) continue;
      out.push(q);
      n++;
    }
  }
  return out;
}

/* ---------- kanji ---------- */
type KWord = KanjiItem["words"][number] & { kanji: KanjiItem };

function kanjiReading(k: KanjiItem, allWords: KWord[], rand: () => number, readingsOf: (word: string) => Set<string>): Question | null {
  const own = k.words.filter(isReadable);
  if (own.length === 0) return null;
  const w = sample(own, 1, rand)[0];
  const valid = readingsOf(w.word);
  const others = allWords.filter((x) => x.kanji.id !== k.id && !valid.has(x.reading));
  const sameLen = others.filter((x) => [...x.reading].length === [...w.reading].length);
  const ds = pickDistractors(rand, sameLen, others, (x) => x.reading, () => true, new Set([w.reading]));
  const wm = hasMeaning(w.meaning) ? ` (${w.meaning})` : "";
  const q = mc(
    rand,
    { text: w.reading, note: `${w.word}${wm} is read ${w.reading}.` },
    ds.map((x) => ({ text: x.reading, note: `${x.reading} is the reading of ${x.word}${hasMeaning(x.meaning) ? ` (${x.meaning})` : ""}, which uses ${x.kanji.character}.` }))
  );
  if (!q) return null;
  const readings = [k.onyomi.length ? `on: ${k.onyomi.join("・")}` : "", k.kunyomi.length ? `kun: ${k.kunyomi.join("・")}` : ""].filter(Boolean).join("; ");
  return {
    id: `q-drill-k-${k.character}-reading`,
    type: "mc",
    level: k.level,
    difficulty: DIFF[k.level].hard,
    skill: "kanji",
    topic: k.character,
    tags: { grammarIds: [], vocabIds: [], kanjiIds: [k.id] },
    prompt: `How is ${w.word} read? (It contains the kanji ${k.character}.)`,
    ...q,
    explanation: `${w.word}${wm} is read ${w.reading}. ${k.character} means ${k.meanings.join(", ")}${readings ? ` (${readings})` : ""}.`,
  };
}

function kanjiMeaning(k: KanjiItem, pool: KanjiItem[], rand: () => number): Question | null {
  const m = k.meanings[0];
  if (!hasMeaning(m)) return null;
  const ok = (c: KanjiItem) => c.id !== k.id && hasMeaning(c.meanings[0]) && !c.meanings.some((x) => k.meanings.some((y) => sameMeaning(x, y)));
  const ds = pickDistractors(rand, pool, [], (c) => c.meanings[0], ok, new Set([m]));
  const q = mc(rand, { text: m, note: `${k.character} means ${k.meanings.join(", ")}.` }, ds.map((c) => ({ text: c.meanings[0], note: `${c.meanings[0]} is the kanji ${c.character}.` })));
  if (!q) return null;
  const w = k.words[0];
  return {
    id: `q-drill-k-${k.character}-meaning`,
    type: "mc",
    level: k.level,
    difficulty: DIFF[k.level].easy,
    skill: "kanji",
    topic: k.character,
    tags: { grammarIds: [], vocabIds: [], kanjiIds: [k.id] },
    prompt: `What does the kanji ${k.character} mean?`,
    ...q,
    explanation: `${k.character} means ${k.meanings.join(", ")}.${w ? ` Example: ${w.word} (${w.reading})${hasMeaning(w.meaning) ? ` — ${w.meaning}` : ""}.` : ""}`,
  };
}

/** Drill questions for `items` (kanji), distractors from `pool` (normally every kanji of the level). */
export function generateKanjiDrill(items: KanjiItem[], pool: KanjiItem[], opts: DrillOptions): Question[] {
  const { kinds, perItem } = resolveKinds(opts);
  const full = [...pool, ...items.filter((i) => !pool.some((p) => p.id === i.id))];
  const allWords: KWord[] = full.flatMap((k) => k.words.filter(isReadable).map((w) => ({ ...w, kanji: k })));
  const readings = readingIndex(full.flatMap((k) => k.words));
  const readingsOf = (word: string) => readings.get(word) ?? new Set<string>();
  const out: Question[] = [];
  const seen = new Set<string>();
  for (const k of items) {
    if (seen.has(k.id)) continue;
    seen.add(k.id);
    let n = 0;
    for (const kind of kinds) {
      if (n >= perItem) break;
      const rand = randFor(opts.seed, k.id, kind);
      const q = kind === "meaning" ? kanjiMeaning(k, full, rand) : kanjiReading(k, allWords, rand, readingsOf);
      if (!q) continue;
      out.push(q);
      n++;
    }
  }
  return out;
}

/** Split content ids into vocabulary / kanji ids by level (other ids are ignored). */
export function groupDrillIds(ids: string[]): { vocab: Map<Level, string[]>; kanji: Map<Level, string[]> } {
  const vocab = new Map<Level, string[]>();
  const kanji = new Map<Level, string[]>();
  for (const id of ids) {
    const m = /^(n[1-5])-(vocab|kanji)-/.exec(id);
    if (!m) continue;
    const level = m[1] as Level;
    const map = m[2] === "vocab" ? vocab : kanji;
    const list = map.get(level) ?? [];
    if (!list.includes(id)) list.push(id);
    map.set(level, list);
  }
  return { vocab, kanji };
}

/** True when a content id is a vocabulary or kanji item that a drill can cover. */
export const isDrillable = (id: string) => /^n[1-5]-(vocab|kanji)-/.test(id);
