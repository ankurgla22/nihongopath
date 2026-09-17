/**
 * Generates practice questions for N5/N4/N3 from the base content data.
 * Run: npm run gen:questions   (writes content/questions/generated-<level>.json)
 *
 * Per level (as far as the data allows):
 *   150 vocabulary meaning   (word -> English meaning)
 *   100 vocabulary reading   (kanji word -> hiragana reading)
 *   100 kanji reading        (example word containing the kanji -> reading)
 *    50 kanji meaning        (kanji -> English meaning)
 *    60 grammar cloze        (pattern blanked out of a real example sentence)
 *
 * Deterministic: a seeded PRNG (mulberry32) drives every choice, so re-runs are stable.
 */
import fs from "node:fs";
import path from "node:path";
import { QuestionSchema, type Question } from "../src/lib/content/schemas";

const ROOT = path.resolve(__dirname, "..");
const CONTENT = path.join(ROOT, "content");

type Vocab = { id: string; word: string; reading: string; pos: string; meaning: string; synonyms: string[]; examples: { ja: string; en: string }[] };
type Kanji = { id: string; character: string; meanings: string[]; onyomi: string[]; kunyomi: string[]; words: { word: string; reading: string; meaning: string }[] };
type Grammar = { id: string; title: string; meaning: string; examples: { ja: string; reading?: string; en: string }[] };

type GenLevel = "n5" | "n4" | "n3" | "n1";
const LEVELS: GenLevel[] = ["n5", "n4", "n3", "n1"];
const TARGET = { vocabMeaning: 150, vocabReading: 100, kanjiReading: 100, kanjiMeaning: 50, grammar: 60 };
const DIFF: Record<GenLevel, { easy: number; hard: number }> = { n5: { easy: 1, hard: 2 }, n4: { easy: 2, hard: 2 }, n3: { easy: 2, hard: 3 }, n1: { easy: 4, hard: 5 } };

const readJson = <T>(rel: string): T => JSON.parse(fs.readFileSync(path.join(CONTENT, rel), "utf8"));

/* ---------- seeded randomness ---------- */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
function shuffle<T>(items: T[], rand: () => number): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
/** First `n` of a seeded shuffle; falls back to the whole list when it is shorter than n. */
const sample = <T>(items: T[], n: number, rand: () => number) => shuffle(items, rand).slice(0, n);

/* ---------- helpers ---------- */
const isKanji = (ch: string) => /[一-龯]/.test(ch);
const hasKanji = (s: string) => [...s].some(isKanji);
const kanjiOf = (s: string) => [...s].filter(isKanji);
const primaryMeaning = (m: string) => m.split(/[;,]/)[0].trim();
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
/** A usable reading option: pure kana (no 〜 prefix, no "し／よん" alternatives, no stray English from bad imports). */
const isKanaReading = (s: string) => /^[ぁ-ゖァ-ヺー]+$/.test(s);
/** A word suitable for a reading question: contains kanji, no 〜 prefix, and has a clean kana reading. */
const isReadable = (w: { word: string; reading: string }) => hasKanji(w.word) && !/[〜～]/.test(w.word) && isKanaReading(w.reading) && w.reading !== w.word;

/** Two meanings are "the same" if either contains the other after normalisation. */
function sameMeaning(a: string, b: string): boolean {
  const x = norm(primaryMeaning(a));
  const y = norm(primaryMeaning(b));
  return x === y || (x.length > 3 && y.includes(x)) || (y.length > 3 && x.includes(y));
}

/** Build a 4-option MC question with the answer placed at a seeded position. */
function mc(
  rand: () => number,
  correct: { text: string; note: string },
  distractors: { text: string; note: string }[]
): { options: string[]; answerIndex: number; distractorExplanations: string[] } | null {
  if (distractors.length < 3) return null;
  const opts = shuffle([correct, ...distractors.slice(0, 3)], rand);
  const answerIndex = opts.findIndex((o) => o === correct);
  return { options: opts.map((o) => o.text), answerIndex, distractorExplanations: opts.map((o) => (o === correct ? `Correct: ${o.note}` : o.note)) };
}

/** Pick up to 3 distractors from `primary` (seeded), topping up from `fallback`; each candidate must pass `ok` and be text-unique. */
function pickDistractors<T>(
  rand: () => number,
  primary: T[],
  fallback: T[],
  text: (t: T) => string,
  ok: (t: T) => boolean,
  taken: Set<string>,
  /** Optional pairwise check so two distractors are not near-duplicates of each other (e.g. "at once" / "all at once"). */
  distinct: (a: T, b: T) => boolean = () => true
): T[] {
  const out: T[] = [];
  const seen = new Set(taken);
  for (const pool of [primary, fallback]) {
    for (const c of shuffle(pool, rand)) {
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

/* ---------- generators ---------- */
function vocabMeaningQuestions(level: GenLevel, vocab: Vocab[], rand: () => number): Question[] {
  const out: Question[] = [];
  const pool = vocab.filter((v) => v.meaning && v.meaning !== "—");
  for (const v of sample(pool, TARGET.vocabMeaning * 2, rand)) {
    if (out.length >= TARGET.vocabMeaning) break;
    const synonyms = new Set(v.synonyms.map(norm));
    const ok = (c: Vocab) => c.id !== v.id && c.meaning !== "—" && !sameMeaning(c.meaning, v.meaning) && !synonyms.has(norm(c.word)) && !synonyms.has(norm(c.reading));
    const samePos = pool.filter((c) => c.pos === v.pos);
    const ds = pickDistractors(rand, samePos, pool, (c) => primaryMeaning(c.meaning), ok, new Set([primaryMeaning(v.meaning)]), (a, b) => !sameMeaning(a.meaning, b.meaning));
    const q = mc(rand, { text: primaryMeaning(v.meaning), note: `${v.word} means ${primaryMeaning(v.meaning)}.` }, ds.map((c) => ({ text: primaryMeaning(c.meaning), note: `${c.word} means ${primaryMeaning(c.meaning)}.` })));
    if (!q) continue;
    const ex = v.examples[0];
    const reading = hasKanji(v.word) && v.reading && v.reading !== v.word ? ` (${v.reading})` : "";
    out.push({
      id: `q-gen-${level}-vocabulary-${out.length + 1}`,
      type: "mc",
      level,
      difficulty: DIFF[level].easy,
      skill: "vocabulary",
      topic: v.word,
      tags: { grammarIds: [], vocabIds: [v.id], kanjiIds: [] },
      prompt: `What does ${v.word} mean?`,
      ...q,
      explanation: `${v.word}${reading} means ${v.meaning}.${ex ? ` Example: ${ex.ja} — ${ex.en}` : ""}`,
    });
  }
  return out;
}

function vocabReadingQuestions(level: GenLevel, vocab: Vocab[], rand: () => number, startN: number, readingsOf: (word: string) => Set<string>): Question[] {
  const out: Question[] = [];
  const pool = vocab.filter(isReadable);
  for (const v of sample(pool, TARGET.vocabReading * 2, rand)) {
    if (out.length >= TARGET.vocabReading) break;
    const ks = new Set(kanjiOf(v.word));
    const valid = readingsOf(v.word); // every reading the data knows for this word (e.g. 日本 にほん/にっぽん)
    const ok = (c: Vocab) => c.id !== v.id && !valid.has(c.reading);
    const shared = pool.filter((c) => c.id !== v.id && kanjiOf(c.word).some((k) => ks.has(k)));
    const sameLen = pool.filter((c) => c.id !== v.id && [...c.reading].length === [...v.reading].length);
    const ds = pickDistractors(rand, shared, sameLen.length >= 3 ? sameLen : pool, (c) => c.reading, ok, new Set([v.reading]));
    const q = mc(rand, { text: v.reading, note: `${v.word} is read ${v.reading}.` }, ds.map((c) => ({ text: c.reading, note: `${c.reading} is the reading of ${c.word} (${primaryMeaning(c.meaning)}).` })));
    if (!q) continue;
    const ex = v.examples[0];
    out.push({
      id: `q-gen-${level}-vocabulary-${startN + out.length + 1}`,
      type: "mc",
      level,
      difficulty: DIFF[level].hard,
      skill: "vocabulary",
      topic: v.word,
      tags: { grammarIds: [], vocabIds: [v.id], kanjiIds: [] },
      prompt: `How is ${v.word} read?`,
      ...q,
      explanation: `${v.word} (${v.reading}) means ${v.meaning}.${ex ? ` Example: ${ex.ja} — ${ex.en}` : ""}`,
    });
  }
  return out;
}

function kanjiReadingQuestions(level: GenLevel, kanji: Kanji[], rand: () => number, readingsOf: (word: string) => Set<string>): Question[] {
  const out: Question[] = [];
  // isReadable drops malformed imports such as {word:"white", reading:"noun"} that would otherwise become prompts/options.
  const allWords = kanji.flatMap((k) => k.words.filter(isReadable).map((w) => ({ ...w, kanji: k })));
  const pool = kanji.filter((k) => k.words.some(isReadable));
  for (const k of sample(pool, TARGET.kanjiReading * 2, rand)) {
    if (out.length >= TARGET.kanjiReading) break;
    const w = sample(k.words.filter(isReadable), 1, rand)[0];
    const valid = readingsOf(w.word);
    const others = allWords.filter((x) => x.kanji.id !== k.id && !valid.has(x.reading));
    const sameLen = others.filter((x) => [...x.reading].length === [...w.reading].length);
    const ds = pickDistractors(rand, sameLen, others, (x) => x.reading, () => true, new Set([w.reading]));
    const wm = w.meaning && w.meaning !== "—" ? ` (${w.meaning})` : "";
    const q = mc(
      rand,
      { text: w.reading, note: `${w.word}${wm} is read ${w.reading}.` },
      ds.map((x) => ({ text: x.reading, note: `${x.reading} is the reading of ${x.word}${x.meaning && x.meaning !== "—" ? ` (${x.meaning})` : ""}, which uses ${x.kanji.character}.` }))
    );
    if (!q) continue;
    const readings = [k.onyomi.length ? `on: ${k.onyomi.join("・")}` : "", k.kunyomi.length ? `kun: ${k.kunyomi.join("・")}` : ""].filter(Boolean).join("; ");
    out.push({
      id: `q-gen-${level}-kanji-${out.length + 1}`,
      type: "mc",
      level,
      difficulty: DIFF[level].hard,
      skill: "kanji",
      topic: k.character,
      tags: { grammarIds: [], vocabIds: [], kanjiIds: [k.id] },
      prompt: `How is ${w.word} read? (It contains the kanji ${k.character}.)`,
      ...q,
      explanation: `${w.word}${wm} is read ${w.reading}. ${k.character} means ${k.meanings.join(", ")}${readings ? ` (${readings})` : ""}.`,
    });
  }
  return out;
}

function kanjiMeaningQuestions(level: GenLevel, kanji: Kanji[], rand: () => number, startN: number): Question[] {
  const out: Question[] = [];
  for (const k of sample(kanji, TARGET.kanjiMeaning * 2, rand)) {
    if (out.length >= TARGET.kanjiMeaning) break;
    const m = k.meanings[0];
    const ok = (c: Kanji) => c.id !== k.id && !c.meanings.some((x) => k.meanings.some((y) => sameMeaning(x, y)));
    const ds = pickDistractors(rand, kanji, [], (c) => c.meanings[0], ok, new Set([m]));
    const q = mc(rand, { text: m, note: `${k.character} means ${k.meanings.join(", ")}.` }, ds.map((c) => ({ text: c.meanings[0], note: `${c.meanings[0]} is the kanji ${c.character}.` })));
    if (!q) continue;
    const w = k.words[0];
    out.push({
      id: `q-gen-${level}-kanji-${startN + out.length + 1}`,
      type: "mc",
      level,
      difficulty: DIFF[level].easy,
      skill: "kanji",
      topic: k.character,
      tags: { grammarIds: [], vocabIds: [], kanjiIds: [k.id] },
      prompt: `What does the kanji ${k.character} mean?`,
      ...q,
      explanation: `${k.character} means ${k.meanings.join(", ")}.${w ? ` Example: ${w.word} (${w.reading})${w.meaning && w.meaning !== "—" ? ` — ${w.meaning}` : ""}.` : ""}`,
    });
  }
  return out;
}

/** "〜ようと思う / 〜ようと思っている \"I think I will\"" -> ["ようと思う", "ようと思っている"] */
function patternsOf(g: Grammar): string[] {
  const head = g.title.split(/ ["“(]/)[0];
  return head
    .split(/\s*[/／]\s*/)
    .map((p) => p.trim())
    // "お〜になる" / "さえ〜ば" are discontinuous frames; flattening them gives non-words (おになる, さえば).
    .filter((p) => !/[^〜～][〜～]+[^〜～]/.test(p))
    .map((p) => p.replace(/[〜～]/g, "").trim())
    .filter((p) => p.length >= 2 && !/[a-zA-Z]/.test(p));
}

/**
 * Patterns that attach directly to a verb stem / て-form / た-form. When the blank follows a bare stem
 * (e.g. 食べ（　）), any of these would also produce a grammatical sentence (食べません / 食べてはいけません /
 * 食べそうです), so they must not be offered against each other.
 */
const STEM_ATTACH = /^(ます|ませ|まし|たい|たく|たが|そう|やす|にく|ながら|方|すぎ|始め|終わ|続け|出す|なさい|に行|に来|かた|がち|かけ|っぱなし|きる|きれ|得る|うる|かね|がたい|次第|つつ|て|た(?!い|が))/;
const attachesToStem = (p: string) => STEM_ATTACH.test(p);

function grammarClozeQuestions(level: GenLevel, grammar: Grammar[], rand: () => number): Question[] {
  const out: Question[] = [];
  const candidates: { g: Grammar; pat: string; ex: Grammar["examples"][number] }[] = [];
  for (const g of grammar) {
    const pats = patternsOf(g);
    for (const ex of g.examples) {
      if (ex.ja === g.title) continue; // base entries whose "example" is just the title
      const pat = pats.find((p) => ex.ja.includes(p));
      if (!pat || ex.ja.length <= pat.length + 3) continue;
      // The pattern must occur exactly once, otherwise the un-blanked copy leaks the answer (東京（　）大阪とか).
      if (ex.ja.split(pat).length !== 2) continue;
      if (!ex.en) continue; // the English gloss is what makes the key unique
      candidates.push({ g, pat, ex });
    }
  }
  const allPats = [...new Set(grammar.flatMap(patternsOf))];
  const byPat = new Map<string, Grammar>();
  for (const o of grammar) for (const p of patternsOf(o)) if (!byPat.has(p)) byPat.set(p, o);
  for (const { g, pat, ex } of sample(candidates, TARGET.grammar * 2, rand)) {
    if (out.length >= TARGET.grammar) break;
    const own = new Set(patternsOf(g));
    const others = grammar.filter((o) => o.id !== g.id);
    const stem = attachesToStem(pat);
    const ok = (p: string) => {
      if (own.has(p) || pat.includes(p) || p.includes(pat)) return false;
      if (stem && attachesToStem(p)) return false;
      const o = byPat.get(p);
      // Drop grammar that means the same thing (だろう vs でしょう): both would fit the gloss.
      if (o && o.id !== g.id && sameMeaning(o.meaning, g.meaning)) return false;
      return true;
    };
    const sameLen = allPats.filter((p) => Math.abs(p.length - pat.length) <= 2);
    const ds = pickDistractors(rand, sameLen, allPats, (p) => p, ok, new Set([pat]));
    const noteFor = (p: string) => {
      const o = others.find((x) => patternsOf(x).includes(p));
      return `${p} — ${o ? primaryMeaning(o.meaning) : "a different pattern"}.`;
    };
    const q = mc(rand, { text: pat, note: `${pat} — ${primaryMeaning(g.meaning)}` }, ds.map((p) => ({ text: p, note: noteFor(p) })));
    if (!q) continue;
    const blanked = ex.ja.replace(pat, "（　　）");
    out.push({
      id: `q-gen-${level}-grammar-${out.length + 1}`,
      type: "cloze",
      level,
      difficulty: DIFF[level].hard,
      skill: "grammar",
      topic: pat,
      tags: { grammarIds: [g.id], vocabIds: [], kanjiIds: [] },
      // The gloss is part of the prompt on purpose: several patterns are often grammatical in the same slot
      // (休みだろうね / 休みみたいだね), and only the intended meaning makes exactly one option correct.
      prompt: `（　　）に入れるのに最もよいものを一つ選びなさい。\n${blanked}\n(Meaning: ${ex.en})`,
      ...q,
      explanation: `${g.title}: ${g.meaning} Example: ${ex.ja}${ex.reading ? ` (${ex.reading})` : ""} — ${ex.en}`,
    });
  }
  return out;
}

/* ---------- main ---------- */
const summary: string[] = [];

/** Every reading the whole content set knows for a word, so no alternative reading is ever used as a distractor. */
const allReadings = new Map<string, Set<string>>();
for (const level of ["n5", "n4", "n3", "n2", "n1"]) {
  if (!fs.existsSync(path.join(CONTENT, level, "vocabulary.json"))) { console.log(level + ": no base content, skipped"); continue; }
  const add = (word: string, reading: string) => {
    if (!word || !reading) return;
    for (const r of reading.split(/[／/]/)) {
      const t = r.trim();
      if (!allReadings.has(word)) allReadings.set(word, new Set());
      allReadings.get(word)!.add(t);
    }
  };
  for (const v of readJson<Vocab[]>(`${level}/vocabulary.json`)) add(v.word, v.reading);
  for (const k of readJson<Kanji[]>(`${level}/kanji.json`)) for (const w of k.words) add(w.word, w.reading);
}
const readingsOf = (word: string) => allReadings.get(word) ?? new Set<string>();

for (const level of LEVELS) {
  const vocab = readJson<Vocab[]>(`${level}/vocabulary.json`);
  const kanji = readJson<Kanji[]>(`${level}/kanji.json`);
  const grammar = readJson<Grammar[]>(`${level}/grammar-base.json`);
  const rand = mulberry32(hashSeed(`gen-questions-${level}`));

  const vm = vocabMeaningQuestions(level, vocab, rand);
  const vr = vocabReadingQuestions(level, vocab, rand, vm.length, readingsOf);
  const kr = kanjiReadingQuestions(level, kanji, rand, readingsOf);
  const km = kanjiMeaningQuestions(level, kanji, rand, kr.length);
  const gc = grammarClozeQuestions(level, grammar, rand);
  const all = [...vm, ...vr, ...kr, ...km, ...gc];

  const ids = new Set<string>();
  for (const q of all) {
    const r = QuestionSchema.safeParse(q);
    if (!r.success) {
      console.error(q.id, r.error.issues);
      process.exit(1);
    }
    if (ids.has(q.id)) {
      console.error(`duplicate id ${q.id}`);
      process.exit(1);
    }
    ids.add(q.id);
    if (q.options.length !== new Set(q.options).size) {
      console.error(`duplicate options in ${q.id}`);
      process.exit(1);
    }
  }
  const out = path.join(CONTENT, "questions", `generated-${level}.json`);
  fs.writeFileSync(out, JSON.stringify(all, null, 2) + "\n", "utf8");
  summary.push(`${level.toUpperCase()}: ${all.length} questions — vocabulary ${vm.length} meaning + ${vr.length} reading, kanji ${kr.length} reading + ${km.length} meaning, grammar cloze ${gc.length} -> ${path.relative(ROOT, out)}`);
}
for (const s of summary) console.log(s);
