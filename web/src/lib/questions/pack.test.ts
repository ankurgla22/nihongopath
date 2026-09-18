import { describe, expect, it } from "vitest";
import { packQuestionIndex, unpackQuestionIndex } from "./pack";
import { pickQuestions, questionContentIds } from "@/lib/engine/scoring";
import type { QuestionIndexEntry } from "@/lib/content/schemas";

const entries: QuestionIndexEntry[] = [
  { id: "q1", level: "n5", skill: "grammar", difficulty: 1, tags: { grammarIds: ["n5-grammar-1"], vocabIds: [], kanjiIds: [] } },
  { id: "q2", level: "n5", skill: "grammar", difficulty: 1, tags: { grammarIds: [], vocabIds: [], kanjiIds: [] } },
  { id: "q3", level: "n4", skill: "reading", difficulty: 3, tags: { grammarIds: [], vocabIds: ["n4-vocab-2"], kanjiIds: [], readingId: "n4-reading-1" } },
];

describe("packQuestionIndex / unpackQuestionIndex", () => {
  it("groups by level|skill|difficulty and drops empty tag arrays", () => {
    expect(packQuestionIndex(entries)).toEqual({
      "n5|grammar|1": [["q1", "n5-grammar-1"], "q2"],
      "n4|reading|3": [["q3", "n4-vocab-2", "n4-reading-1"]],
    });
  });

  it("round-trips into entries that the pickers understand", () => {
    const back = unpackQuestionIndex(packQuestionIndex(entries));
    expect(back.map((q) => q.id).sort()).toEqual(["q1", "q2", "q3"]);
    const q3 = back.find((q) => q.id === "q3")!;
    expect(q3).toMatchObject({ level: "n4", skill: "reading", difficulty: 3 });
    expect(questionContentIds(q3)).toEqual(["n4-vocab-2", "n4-reading-1"]);
    expect(questionContentIds(back.find((q) => q.id === "q2")!)).toEqual([]);
    expect(pickQuestions(back, { count: 5, levels: ["n5"], skills: ["grammar"] }).map((q) => q.id).sort()).toEqual(["q1", "q2"]);
    expect(pickQuestions(back, { count: 1, preferContentIds: ["n4-reading-1"] })[0].id).toBe("q3");
  });
});
