import { describe, expect, it } from "vitest";
import type { ExamBlueprint, Question } from "@/lib/content/schemas";
import {
  hashSeed,
  mulberry32,
  pickQuestions,
  questionContentIds,
  scaleSection,
  scoreExam,
  scoreQuiz,
  skillsIn,
} from "./scoring";

function q(id: string, over: Partial<Question> = {}): Question {
  return {
    id,
    type: "mc",
    level: "n2",
    difficulty: 3,
    skill: "grammar",
    topic: "t",
    tags: { grammarIds: [], vocabIds: [], kanjiIds: [] },
    prompt: "?",
    options: ["a", "b", "c", "d"],
    answerIndex: 1,
    explanation: "",
    distractorExplanations: [],
    ...over,
  };
}

const bank: Question[] = [
  q("q1", { skill: "grammar", tags: { grammarIds: ["g1"], vocabIds: [], kanjiIds: [] } }),
  q("q2", { skill: "grammar", tags: { grammarIds: ["g1", "g2"], vocabIds: ["v1"], kanjiIds: [] } }),
  q("q3", { skill: "vocabulary", tags: { grammarIds: [], vocabIds: ["v2"], kanjiIds: ["k1"] } }),
  q("q4", { skill: "reading", tags: { grammarIds: [], vocabIds: [], kanjiIds: [], readingId: "r1" } }),
  q("q5", { skill: "listening", tags: { grammarIds: [], vocabIds: [], kanjiIds: [], listeningId: "l1" } }),
];

describe("scoreQuiz", () => {
  it("returns zeros for an empty question list", () => {
    const r = scoreQuiz([], []);
    expect(r).toMatchObject({ score: 0, total: 0, accuracy: 0, answers: [], weakContentIds: [] });
    expect(r.skillBreakdown).toEqual({});
  });

  it("treats unanswered and null-selected questions as wrong", () => {
    const r = scoreQuiz(bank, [
      { questionId: "q1", selectedIndex: 1, seconds: 5 },
      { questionId: "q2", selectedIndex: null, seconds: 3 },
      // q3, q4, q5 not submitted
    ]);
    expect(r.score).toBe(1);
    expect(r.total).toBe(5);
    expect(r.accuracy).toBeCloseTo(0.2);
    expect(r.answers).toHaveLength(5);
    expect(r.answers.map((a) => a.correct)).toEqual([true, false, false, false, false]);
    expect(r.answers[2]).toEqual({ questionId: "q3", selectedIndex: null, correct: false, seconds: 0 });
  });

  it("computes per-skill breakdown", () => {
    const r = scoreQuiz(bank, [
      { questionId: "q1", selectedIndex: 1, seconds: 1 },
      { questionId: "q2", selectedIndex: 0, seconds: 1 },
      { questionId: "q3", selectedIndex: 1, seconds: 1 },
    ]);
    expect(r.skillBreakdown).toEqual({
      grammar: { correct: 1, total: 2 },
      vocabulary: { correct: 1, total: 1 },
      reading: { correct: 0, total: 1 },
      listening: { correct: 0, total: 1 },
    });
  });

  it("collects de-duplicated weak content ids and typed weak tags from wrong answers only", () => {
    const r = scoreQuiz(bank, [
      { questionId: "q1", selectedIndex: 0, seconds: 1 }, // wrong: g1
      { questionId: "q2", selectedIndex: 0, seconds: 1 }, // wrong: g1 g2 v1
      { questionId: "q3", selectedIndex: 1, seconds: 1 }, // right
      { questionId: "q4", selectedIndex: 2, seconds: 1 }, // wrong: r1
      { questionId: "q5", selectedIndex: 1, seconds: 1 }, // right
    ]);
    expect(r.weakContentIds).toEqual(["g1", "g2", "v1", "r1"]);
    expect(r.weakTags).toEqual({ grammarIds: ["g1", "g2"], vocabIds: ["v1"], kanjiIds: [], readingIds: ["r1"], listeningIds: [] });
  });

  it("ignores answers for unknown question ids and lets the last submission win", () => {
    const r = scoreQuiz([bank[0]], [
      { questionId: "nope", selectedIndex: 1, seconds: 1 },
      { questionId: "q1", selectedIndex: 0, seconds: 1 },
      { questionId: "q1", selectedIndex: 1, seconds: 9 },
    ]);
    expect(r.score).toBe(1);
    expect(r.answers).toEqual([{ questionId: "q1", selectedIndex: 1, correct: true, seconds: 9 }]);
  });

  it("clamps negative or non-finite seconds to 0", () => {
    const r = scoreQuiz([bank[0]], [{ questionId: "q1", selectedIndex: 1, seconds: -4 }]);
    expect(r.answers[0].seconds).toBe(0);
  });
});

describe("scaleSection", () => {
  it("maps raw/total onto 0..60 and rounds", () => {
    expect(scaleSection(0, 10)).toBe(0);
    expect(scaleSection(10, 10)).toBe(60);
    expect(scaleSection(5, 10)).toBe(30);
    expect(scaleSection(1, 3)).toBe(20);
    expect(scaleSection(2, 7)).toBe(17); // 17.14
  });
  it("returns 0 for an empty section", () => {
    expect(scaleSection(0, 0)).toBe(0);
  });
});

describe("scoreExam", () => {
  const ids = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);
  const exam: ExamBlueprint = {
    id: "mock-1",
    level: "n2",
    title: "Mock 1",
    description: "",
    sections: [
      { id: "lang", name: "Language Knowledge", skill: "language", timeLimitSeconds: 100, questionIds: ids("L", 10) },
      { id: "read", name: "Reading", skill: "reading", timeLimitSeconds: 100, questionIds: ids("R", 10) },
      { id: "list", name: "Listening", skill: "listening", timeLimitSeconds: 100, questionIds: ids("S", 10) },
    ],
  };
  const map = new Map<string, Question>();
  for (const id of ids("L", 10)) map.set(id, q(id, { skill: "grammar", tags: { grammarIds: [`g-${id}`], vocabIds: [], kanjiIds: [] } }));
  for (const id of ids("R", 10)) map.set(id, q(id, { skill: "reading", tags: { grammarIds: [], vocabIds: [], kanjiIds: [], readingId: "r1" } }));
  for (const id of ids("S", 10)) map.set(id, q(id, { skill: "listening" }));

  const answerN = (prefix: string, right: number, total = 10) =>
    ids(prefix, total).map((id, i) => ({ questionId: id, selectedIndex: i < right ? 1 : 0, seconds: 2 }));

  it("scores all sections perfectly to 180 and passes", () => {
    const r = scoreExam(exam, map, [...answerN("L", 10), ...answerN("R", 10), ...answerN("S", 10)]);
    expect(r.sections.map((s) => s.scaled)).toEqual([60, 60, 60]);
    expect(r.totalScaled).toBe(180);
    expect(r.passedEstimate).toBe(true);
    expect(r.seconds).toBe(60);
    expect(r.answers).toHaveLength(30);
    expect(r.weakContentIds).toEqual([]);
    expect(r).toMatchObject({ examId: "mock-1", title: "Mock 1" });
    expect(r).not.toHaveProperty("id");
    expect(r).not.toHaveProperty("createdAt");
    expect(r).not.toHaveProperty("date");
  });

  it("fails when a single section scores 18 even with a high total", () => {
    // 3/10 → 18 scaled
    const r = scoreExam(exam, map, [...answerN("L", 10), ...answerN("R", 10), ...answerN("S", 3)]);
    expect(r.sections[2].scaled).toBe(18);
    expect(r.totalScaled).toBe(138);
    expect(r.passedEstimate).toBe(false);
  });

  it("passes at exactly 19 per section when total ≥ 90", () => {
    // Need every section ≥ 19: 4/10 → 24 each = 72 total < 90 → fail; 5,5,5 → 90 pass.
    const fail = scoreExam(exam, map, [...answerN("L", 4), ...answerN("R", 4), ...answerN("S", 4)]);
    expect(fail.totalScaled).toBe(72);
    expect(fail.passedEstimate).toBe(false);
    const pass = scoreExam(exam, map, [...answerN("L", 5), ...answerN("R", 5), ...answerN("S", 5)]);
    expect(pass.totalScaled).toBe(90);
    expect(pass.passedEstimate).toBe(true);
  });

  it("counts unanswered questions as wrong and records weak ids per section", () => {
    const r = scoreExam(exam, map, []);
    expect(r.sections.map((s) => s.score)).toEqual([0, 0, 0]);
    expect(r.sections.map((s) => s.total)).toEqual([10, 10, 10]);
    expect(r.totalScaled).toBe(0);
    expect(r.passedEstimate).toBe(false);
    expect(r.weakContentIds).toHaveLength(11); // 10 grammar ids + r1 once
  });

  it("skips questions missing from the map without crashing", () => {
    const partial = new Map(map);
    partial.delete("L1");
    const r = scoreExam(exam, partial, answerN("L", 10));
    expect(r.sections[0].total).toBe(9);
    expect(r.sections[0].score).toBe(9);
    expect(r.answers).toHaveLength(29);
  });

  it("never exceeds 180 and handles an exam with no sections", () => {
    const r = scoreExam({ ...exam, sections: [] }, map, []);
    expect(r.totalScaled).toBe(0);
    expect(r.passedEstimate).toBe(false);
  });
});

describe("mulberry32 / hashSeed", () => {
  it("is deterministic and in [0,1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
  it("hashes strings stably", () => {
    expect(hashSeed("day-1")).toBe(hashSeed("day-1"));
    expect(hashSeed("day-1")).not.toBe(hashSeed("day-2"));
  });
});

describe("pickQuestions", () => {
  const pool: Question[] = Array.from({ length: 40 }, (_, i) =>
    q(`p${i}`, {
      skill: (["grammar", "vocabulary", "kanji", "reading", "listening"] as const)[i % 5],
      level: (["n5", "n4", "n3", "n2"] as const)[i % 4],
      difficulty: (i % 5) + 1,
      tags: { grammarIds: i % 7 === 0 ? ["gX"] : [], vocabIds: [], kanjiIds: [] },
    })
  );

  it("is deterministic for the same seed and different for another", () => {
    const a = pickQuestions(pool, { count: 10, seed: 7 }).map((x) => x.id);
    const b = pickQuestions(pool, { count: 10, seed: 7 }).map((x) => x.id);
    const c = pickQuestions(pool, { count: 10, seed: 8 }).map((x) => x.id);
    const d = pickQuestions(pool, { count: 10, seed: "seven" }).map((x) => x.id);
    const e = pickQuestions(pool, { count: 10, seed: "seven" }).map((x) => x.id);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(d).toEqual(e);
  });

  it("never duplicates, even with duplicate ids in the pool", () => {
    const dupPool = [...pool, ...pool];
    for (let seed = 0; seed < 20; seed++) {
      const picked = pickQuestions(dupPool, { count: 40, seed });
      const ids = picked.map((x) => x.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.length).toBe(40);
    }
  });

  it("returns fewer than count when the pool is too small, and [] for count 0", () => {
    expect(pickQuestions(pool, { count: 100, seed: 1 })).toHaveLength(40);
    expect(pickQuestions(pool, { count: 0, seed: 1 })).toEqual([]);
    expect(pickQuestions([], { count: 5 })).toEqual([]);
  });

  it("applies level, skill, difficulty and exclude filters", () => {
    const r = pickQuestions(pool, { count: 40, levels: ["n2"], skills: ["grammar", "kanji"], difficultyMax: 3, excludeIds: ["p0"], seed: 3 });
    expect(r.length).toBeGreaterThan(0);
    for (const x of r) {
      expect(x.level).toBe("n2");
      expect(["grammar", "kanji"]).toContain(x.skill);
      expect(x.difficulty).toBeLessThanOrEqual(3);
      expect(x.id).not.toBe("p0");
    }
  });

  it("puts preferred (tagged) questions first, then fills randomly", () => {
    const preferredIds = pool.filter((x) => x.tags.grammarIds.includes("gX")).map((x) => x.id);
    expect(preferredIds.length).toBe(6);
    const r = pickQuestions(pool, { count: 10, preferContentIds: ["gX"], seed: 11 });
    expect(r).toHaveLength(10);
    expect(r.slice(0, 6).map((x) => x.id).sort()).toEqual([...preferredIds].sort());
    for (const x of r.slice(6)) expect(x.tags.grammarIds).not.toContain("gX");
  });

  it("caps preferred questions at count", () => {
    const r = pickQuestions(pool, { count: 2, preferContentIds: ["gX"], seed: 1 });
    expect(r).toHaveLength(2);
    for (const x of r) expect(x.tags.grammarIds).toContain("gX");
  });

  it("does not mutate the pool", () => {
    const before = pool.map((x) => x.id);
    pickQuestions(pool, { count: 10, seed: 5 });
    expect(pool.map((x) => x.id)).toEqual(before);
  });
});

describe("helpers", () => {
  it("questionContentIds gathers every tag once", () => {
    const ids = questionContentIds(q("x", { tags: { grammarIds: ["a", "a"], vocabIds: ["b"], kanjiIds: ["c"], readingId: "d", listeningId: "e", foundationId: "foundation-1" } }));
    expect(ids).toEqual(["a", "b", "c", "d", "e", "foundation-1"]);
  });
  it("pickQuestions prefers questions tagged with a foundation lesson", () => {
    const kana = q("kana1", { level: "foundation", skill: "kana", tags: { grammarIds: [], vocabIds: [], kanjiIds: [], foundationId: "foundation-1" } });
    const pool = [...bank, kana];
    const picked = pickQuestions(pool, { count: 1, preferContentIds: ["foundation-1"], seed: 1 });
    expect(picked.map((x) => x.id)).toEqual(["kana1"]);
  });
  it("skillsIn returns canonical order", () => {
    expect(skillsIn([bank[4], bank[0], bank[2]])).toEqual(["grammar", "vocabulary", "listening"]);
  });
});
