import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { Question } from "@/lib/content/schemas";
import { contentMeta, pickWithFallback, questionLevelsUpTo, quizKindForTask } from "./helpers";

function bank(): Question[] {
  const dir = path.join(process.cwd(), "content", "questions");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .flatMap((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as Question[]);
}

describe("contentMeta", () => {
  it("parses level/type for lesson ids and foundation lessons", () => {
    expect(contentMeta("n4-grammar-12")).toEqual({ type: "grammar", level: "n4" });
    expect(contentMeta("n5-vocab-3")).toEqual({ type: "vocabulary", level: "n5" });
    expect(contentMeta("foundation-3")).toEqual({ type: "kana", level: "foundation" });
    expect(contentMeta("q-kana-1")).toBeNull();
  });
});

describe("quizKindForTask", () => {
  it("maps task types to quiz kinds", () => {
    expect(quizKindForTask("weekly-test")).toBe("weekly");
    expect(quizKindForTask("phase-test")).toBe("phase");
    expect(quizKindForTask("review")).toBe("review");
    expect(quizKindForTask("quiz")).toBe("daily");
  });
});

describe("daily quiz draw (real question bank)", () => {
  it("Day 1 kana quiz draws only questions tagged with the day's foundation lessons", () => {
    const picked = pickWithFallback(bank(), {
      count: 15,
      levels: questionLevelsUpTo("n5"),
      preferContentIds: ["foundation-1", "foundation-5"],
      seed: "uid-2026-09-17-d1-4-quiz",
    });
    expect(picked).toHaveLength(15);
    expect(picked.every((q) => q.skill === "kana" && ["foundation-1", "foundation-5"].includes(q.tags.foundationId ?? ""))).toBe(true);
  });

  it("phase 1 pools are large enough for the daily quiz, weekly test and phase test", () => {
    const pool = bank().filter((q) => questionLevelsUpTo("n5").includes(q.level));
    expect(pool.length).toBeGreaterThanOrEqual(40);
    expect(pickWithFallback(pool, { count: 40, levels: questionLevelsUpTo("n5"), seed: 1 })).toHaveLength(40);
  });
});
