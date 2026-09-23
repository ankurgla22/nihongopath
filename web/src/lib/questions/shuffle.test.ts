import { describe, expect, it } from "vitest";
import type { Question } from "@/lib/content/schemas";
import { isShuffleable, shuffleQuestionOptions } from "./shuffle";

function q(over: Partial<Question> = {}): Question {
  return {
    id: "q-n5-g-1-1",
    type: "mc",
    level: "n5",
    difficulty: 2,
    skill: "grammar",
    topic: "copula",
    tags: { grammarIds: [], vocabIds: [], kanjiIds: [] },
    prompt: "What goes in (　　)?",
    options: ["です", "ます", "います", "あります"],
    answerIndex: 0,
    explanation: "です is the polite copula.",
    distractorExplanations: ["Correct: です", "ます attaches to verbs", "います is for animate existence", "あります is for inanimate existence"],
    ...over,
  } as Question;
}

describe("shuffleQuestionOptions", () => {
  it("keeps answerIndex pointing at the same option text", () => {
    const original = q();
    const s = shuffleQuestionOptions(original);
    expect(s.options[s.answerIndex]).toBe(original.options[original.answerIndex]);
  });

  it("keeps the same set of options", () => {
    const s = shuffleQuestionOptions(q());
    expect([...s.options].sort()).toEqual([...q().options].sort());
  });

  it("moves per-option notes with their options", () => {
    const original = q();
    const s = shuffleQuestionOptions(original);
    for (const [i, opt] of s.options.entries()) {
      const was = original.options.indexOf(opt);
      expect(s.distractorExplanations[i]).toBe(original.distractorExplanations[was]);
    }
  });

  it("leaves generic (unaligned) notes untouched", () => {
    const original = q({ distractorExplanations: ["one note", "another"] });
    const s = shuffleQuestionOptions(original);
    expect(s.distractorExplanations).toEqual(original.distractorExplanations);
  });

  it("is deterministic for a given id", () => {
    expect(shuffleQuestionOptions(q()).options).toEqual(shuffleQuestionOptions(q()).options);
  });

  it("gives different ids different permutations", () => {
    // Not guaranteed for any single pair, but across a spread of ids the keyed index must vary.
    const keyed = new Set(Array.from({ length: 40 }, (_, i) => shuffleQuestionOptions(q({ id: `q-n5-g-${i}-1` })).answerIndex));
    expect(keyed.size).toBeGreaterThan(1);
  });

  it("does not touch ordering questions, whose explanations name slot positions", () => {
    const o = q({ id: "q-ord-1", type: "ordering", explanation: "A B C D (1-2-3-4). ★ is the second slot." });
    expect(isShuffleable(o)).toBe(false);
    expect(shuffleQuestionOptions(o)).toBe(o);
  });

  it("does not touch cloze questions", () => {
    expect(isShuffleable(q({ type: "cloze" }))).toBe(false);
  });

  it("skips a question whose wording names an option by number", () => {
    const byExplanation = q({ id: "q-x-1", explanation: "Only option 1 uses a destination particle." });
    expect(isShuffleable(byExplanation)).toBe(false);
    const byNote = q({ id: "q-x-2", distractorExplanations: ["Correct: です", "See choice 3", "n/a", "n/a"] });
    expect(isShuffleable(byNote)).toBe(false);
  });

  it("spreads the key across indices for a first-option-keyed bank", () => {
    // The real N5 grammar file is 100% keyed to option 1; this is that shape in miniature.
    const bank = Array.from({ length: 400 }, (_, i) => q({ id: `q-n5-g-${i}-1`, answerIndex: 0 }));
    const counts = [0, 0, 0, 0];
    for (const item of bank) counts[shuffleQuestionOptions(item).answerIndex]++;
    const top = Math.max(...counts) / bank.length;
    expect(top).toBeLessThan(0.45);
  });
});
