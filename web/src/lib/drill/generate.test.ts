import { describe, expect, it } from "vitest";
import { QuestionSchema, type KanjiItem, type VocabItem } from "@/lib/content/schemas";
import { generateKanjiDrill, generateVocabDrill, groupDrillIds, isDrillable } from "./generate";

function vocab(n: number, word: string, reading: string, meaning: string, extra: Partial<VocabItem> = {}): VocabItem {
  return {
    id: `n5-vocab-${n}`,
    slug: `${n}-${word}`,
    level: "n5",
    order: n,
    word,
    reading,
    pos: "noun",
    meaning,
    examples: [{ ja: `${word}です。`, en: `It is ${meaning}.` }],
    collocations: [],
    related: [],
    synonyms: [],
    antonyms: [],
    difficulty: 2,
    kanjiIds: [],
    enriched: false,
    ...extra,
  };
}

function kanji(n: number, character: string, meanings: string[], words: KanjiItem["words"], extra: Partial<KanjiItem> = {}): KanjiItem {
  return {
    id: `n5-kanji-${character}`,
    slug: `${n}-${character}`,
    level: "n5",
    order: n,
    day: 1,
    character,
    meanings,
    onyomi: [],
    kunyomi: [],
    words,
    examples: [],
    similarKanji: [],
    commonMistakes: [],
    enriched: false,
    ...extra,
  };
}

const POOL: VocabItem[] = [
  vocab(1, "日本", "にほん", "Japan"),
  vocab(2, "日本", "にっぽん", "Japan (alt.)"), // alternative reading of the same word
  vocab(3, "学校", "がっこう", "school"),
  vocab(4, "先生", "せんせい", "teacher"),
  vocab(5, "本", "ほん", "book"),
  vocab(6, "日曜日", "にちようび", "Sunday"),
  vocab(7, "水", "みず", "water"),
  vocab(8, "山", "やま", "mountain"),
  vocab(9, "川", "かわ", "river"),
  vocab(10, "食べる", "たべる", "to eat", { pos: "verb" }),
  vocab(11, "飲む", "のむ", "to drink", { pos: "verb" }),
  vocab(12, "見る", "みる", "to see", { pos: "verb" }),
  vocab(13, "行く", "いく", "to go", { pos: "verb" }),
  vocab(14, "きれい", "きれい", "pretty", { pos: "adj", synonyms: ["美しい"] }),
  vocab(15, "美しい", "うつくしい", "beautiful", { pos: "adj" }),
];

const KANJI: KanjiItem[] = [
  kanji(1, "日", ["day", "sun"], [{ word: "日本", reading: "にほん／にっぽん", meaning: "Japan" }, { word: "日曜日", reading: "にちようび", meaning: "Sunday" }]),
  kanji(2, "本", ["book", "origin"], [{ word: "本", reading: "ほん", meaning: "book" }, { word: "日本", reading: "にほん", meaning: "Japan" }]),
  kanji(3, "山", ["mountain"], [{ word: "山", reading: "やま", meaning: "mountain" }, { word: "火山", reading: "かざん", meaning: "volcano" }]),
  kanji(4, "川", ["river"], [{ word: "川", reading: "かわ", meaning: "river" }, { word: "小川", reading: "おがわ", meaning: "stream" }]),
  kanji(5, "水", ["water"], [{ word: "水", reading: "みず", meaning: "water" }, { word: "水曜日", reading: "すいようび", meaning: "Wednesday" }]),
  kanji(6, "火", ["fire"], [{ word: "火", reading: "ひ", meaning: "fire" }]),
];

const unique = (xs: string[]) => new Set(xs).size === xs.length;

describe("generateVocabDrill", () => {
  it("produces schema-valid questions with 4 unique options, the key correct and stable ids", () => {
    const qs = generateVocabDrill([POOL[0], POOL[9]], POOL, { seed: "s1" });
    expect(qs.map((q) => q.id)).toEqual(["q-drill-v-n5-vocab-1-meaning", "q-drill-v-n5-vocab-1-reading", "q-drill-v-n5-vocab-10-meaning", "q-drill-v-n5-vocab-10-reading"]);
    for (const q of qs) {
      expect(QuestionSchema.safeParse(q).success).toBe(true);
      expect(q.options).toHaveLength(4);
      expect(unique(q.options)).toBe(true);
      expect(q.distractorExplanations).toHaveLength(4);
      expect(q.distractorExplanations[q.answerIndex].startsWith("Correct: ")).toBe(true);
      expect(q.skill).toBe("vocabulary");
      expect(q.level).toBe("n5");
    }
    const [m, r] = qs;
    expect(m.options[m.answerIndex]).toBe("Japan");
    expect(m.tags.vocabIds).toEqual(["n5-vocab-1"]);
    expect(r.options[r.answerIndex]).toBe("にほん");
    expect(r.explanation).toContain("日本 (にほん) means Japan");
    expect(r.explanation).toContain("Example: 日本です。");
  });

  it("is deterministic for a seed and changes with the seed", () => {
    const a = generateVocabDrill(POOL, POOL, { seed: "abc" });
    const b = generateVocabDrill(POOL, POOL, { seed: "abc" });
    expect(a).toEqual(b);
    // The options for an item depend only on the seed and the item, not on the rest of the batch.
    const solo = generateVocabDrill([POOL[3]], POOL, { seed: "abc" });
    expect(a.filter((q) => q.tags.vocabIds[0] === POOL[3].id)).toEqual(solo);
    const c = generateVocabDrill(POOL, POOL, { seed: "xyz" });
    expect(c.map((q) => q.options.join("|"))).not.toEqual(a.map((q) => q.options.join("|")));
  });

  it("never offers an alternative reading of the target word or its own meaning as a distractor", () => {
    for (const seed of ["1", "2", "3", "4", "5", "6", "7", "8"]) {
      const [reading] = generateVocabDrill([POOL[0]], POOL, { seed, kinds: ["reading"] });
      expect(reading.options).not.toContain("にっぽん");
      expect(reading.options.filter((o) => o === "にほん")).toHaveLength(1);
      const [meaning] = generateVocabDrill([POOL[13]], POOL, { seed, kinds: ["meaning"] });
      // 美しい is listed as a synonym of きれい, so its meaning may not appear as a distractor.
      expect(meaning.options).not.toContain("beautiful");
    }
  });

  it("prefers same-POS distractors", () => {
    const [q] = generateVocabDrill([POOL[9]], POOL, { seed: "pos", kinds: ["meaning"] });
    const verbs = new Set(POOL.filter((v) => v.pos === "verb").map((v) => v.meaning));
    expect(q.options.every((o) => verbs.has(o))).toBe(true);
  });

  it("skips kinds that cannot be built and items with no valid distractors", () => {
    // Kana-only word: no reading question.
    const kana = generateVocabDrill([POOL[13]], POOL, { seed: "k" });
    expect(kana.map((q) => q.id)).toEqual(["q-drill-v-n5-vocab-14-meaning"]);
    // Pool too small for 3 distractors: nothing generated.
    expect(generateVocabDrill([POOL[0]], POOL.slice(0, 3), { seed: "k" })).toEqual([]);
    // Word with no meaning: nothing generated.
    expect(generateVocabDrill([vocab(99, "ああ", "ああ", "—")], POOL, { seed: "k" })).toEqual([]);
  });

  it("honours kinds and perItem", () => {
    const only = generateVocabDrill(POOL, POOL, { seed: "s", kinds: ["meaning"] });
    expect(only.every((q) => q.id.endsWith("-meaning"))).toBe(true);
    const one = generateVocabDrill(POOL, POOL, { seed: "s", perItem: 1 });
    expect(one.length).toBe(POOL.length);
    expect(unique(one.map((q) => q.tags.vocabIds[0]))).toBe(true);
    const dupes = generateVocabDrill([POOL[0], POOL[0]], POOL, { seed: "s" });
    expect(dupes).toHaveLength(2);
  });
});

describe("generateKanjiDrill", () => {
  it("produces valid meaning and reading questions with stable ids", () => {
    const qs = generateKanjiDrill([KANJI[0]], KANJI, { seed: "s" });
    expect(qs.map((q) => q.id)).toEqual(["q-drill-k-日-meaning", "q-drill-k-日-reading"]);
    for (const q of qs) {
      expect(QuestionSchema.safeParse(q).success).toBe(true);
      expect(q.options).toHaveLength(4);
      expect(unique(q.options)).toBe(true);
      expect(q.skill).toBe("kanji");
      expect(q.tags.kanjiIds).toEqual(["n5-kanji-日"]);
      expect(q.distractorExplanations[q.answerIndex].startsWith("Correct: ")).toBe(true);
    }
    expect(qs[0].options[qs[0].answerIndex]).toBe("day");
    expect(qs[0].explanation).toContain("日 means day, sun");
    expect(qs[1].prompt).toMatch(/contains the kanji 日/);
  });

  it("never offers an alternative reading of the prompted word as a distractor", () => {
    for (const seed of ["1", "2", "3", "4", "5", "6", "7", "8"]) {
      const [q] = generateKanjiDrill([KANJI[1]], KANJI, { seed, kinds: ["reading"] });
      if (q.prompt.startsWith("How is 日本")) {
        expect(q.options).not.toContain("にっぽん");
        expect(q.options.filter((o) => o === "にほん")).toHaveLength(1);
      }
    }
  });

  it("is deterministic and skips items without valid distractors", () => {
    expect(generateKanjiDrill(KANJI, KANJI, { seed: "d" })).toEqual(generateKanjiDrill(KANJI, KANJI, { seed: "d" }));
    // Reading question needs example words of other kanji: a two-kanji pool cannot supply 3 distractors.
    expect(generateKanjiDrill([KANJI[5]], KANJI.slice(4), { seed: "d" })).toEqual([]);
    // Kanji whose words are all kana-only get no reading question.
    const kana = kanji(9, "何", ["what"], [{ word: "なに", reading: "なに", meaning: "what" }]);
    expect(generateKanjiDrill([kana], KANJI, { seed: "d" }).map((q) => q.id)).toEqual(["q-drill-k-何-meaning"]);
  });
});

describe("id helpers", () => {
  it("groups vocabulary/kanji ids by level and ignores the rest", () => {
    const g = groupDrillIds(["n5-vocab-1", "n4-kanji-一", "n5-vocab-1", "n3-grammar-2", "foundation-1"]);
    expect([...g.vocab.entries()]).toEqual([["n5", ["n5-vocab-1"]]]);
    expect([...g.kanji.entries()]).toEqual([["n4", ["n4-kanji-一"]]]);
    expect(isDrillable("n1-kanji-亜")).toBe(true);
    expect(isDrillable("n1-grammar-3")).toBe(false);
  });
});
