import { describe, expect, it } from "vitest";
import { OPTIONS, buildVerbQuestions, glosses, seeded, verbLabel, type VerbCard } from "./verbQuiz";

const card = (word: string, reading: string, meaning: string, i: number): VerbCard => ({
  id: `v${i}`, word, reading, romaji: reading, meaning, level: i % 2 ? "n4" : "n5", group: 1, polite: `${word}ます`, noun: false,
});
const NOUNS: VerbCard[] = [["食事する", "しょくじする", "meal, dining"], ["準備する", "じゅんびする", "preparation"], ["故障する", "こしょうする", "breakdown"], ["散歩する", "さんぽする", "walk, stroll"]].map(([w, r, m], i) => ({ ...card(w, r, m, 100 + i), noun: true }));
const CARDS: VerbCard[] = [
  ["食べる", "たべる", "to eat"], ["飲む", "のむ", "to drink"], ["行く", "いく", "to go"], ["来る", "くる", "to come"],
  ["開く", "あく", "to open (intransitive)"], ["開ける", "あける", "to open (transitive)"], ["上げる", "あげる", "to raise, to give"],
  ["あげる", "あげる", "to give"], ["なくす", "なくす", "to lose"], ["無くす", "なくす", "to lose"], ["書く", "かく", "to write"],
  ["読む", "よむ", "to read"], ["見る", "みる", "to see, to watch"], ["寝る", "ねる", "to sleep"], ["話す", "はなす", "to speak"],
].map(([w, r, m], i) => card(w, r, m, i));

describe("glosses", () => {
  it("drops 'to' and notes, and splits on commas", () => {
    expect(glosses("to open (transitive)")).toEqual(["open"]);
    expect(glosses("to raise, to give")).toEqual(["raise", "give"]);
  });
});

describe("buildVerbQuestions", () => {
  for (const mode of ["ja-en", "en-ja", "mix"] as const) {
    const qs = buildVerbQuestions(CARDS, mode, seeded(1));
    it(`${mode}: four distinct options with the answer among them`, () => {
      expect(qs.length).toBeGreaterThan(10);
      for (const q of qs) {
        expect(q.options).toHaveLength(OPTIONS);
        expect(new Set(q.options).size).toBe(OPTIONS);
        expect(q.answerIndex).toBeGreaterThanOrEqual(0);
        expect(q.answerIndex).toBeLessThan(OPTIONS);
      }
    });
    it(`${mode}: never offers a wrong option that also fits`, () => {
      const byLabel = new Map(CARDS.flatMap((c) => [[c.meaning, c], [verbLabel(c), c]] as const));
      for (const q of qs) {
        const answer = byLabel.get(q.options[q.answerIndex])!;
        for (const [i, o] of q.options.entries()) {
          if (i === q.answerIndex) continue;
          const other = byLabel.get(o)!;
          const shared = glosses(other.meaning).filter((g) => glosses(answer.meaning).includes(g));
          expect(shared, `${q.prompt} → ${o}`).toEqual([]);
          expect(other.reading).not.toBe(answer.reading);
        }
      }
    });
  }

  it("asks both directions in mix mode", () => {
    const qs = buildVerbQuestions(CARDS, "mix", seeded(2));
    expect(qs.some((q) => q.prompt.startsWith("What does"))).toBe(true);
    expect(qs.some((q) => q.prompt.startsWith("Which verb"))).toBe(true);
  });

  it("never mixes noun meanings with verb meanings in one question", () => {
    const all = [...CARDS, ...NOUNS];
    const isNoun = new Set(NOUNS.flatMap((n) => [n.meaning, verbLabel(n)]));
    for (const q of buildVerbQuestions(all, "mix", seeded(4))) {
      const kinds = new Set(q.options.map((o) => isNoun.has(o)));
      expect(kinds.size, q.prompt).toBe(1);
    }
  });

  it("is the same for the same seed (the server's first round must not change between builds)", () => {
    expect(buildVerbQuestions(CARDS, "mix", seeded(7))).toEqual(buildVerbQuestions(CARDS, "mix", seeded(7)));
  });

  it("skips a verb that cannot get three clean wrong options rather than asking with fewer", () => {
    const tiny = CARDS.slice(0, 3);
    expect(buildVerbQuestions(tiny, "ja-en", seeded(1))).toEqual([]);
  });
});
