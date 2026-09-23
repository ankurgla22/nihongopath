import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ExamBlueprintSchema, QuestionSchema, type ExamBlueprint, type Question } from "@/lib/content/schemas";
import { SCORING_RULES, TOTAL_SCALED_MAX, scoreExam, type SubmittedAnswer } from "@/lib/engine/scoring";
import { shuffleQuestionBank } from "@/lib/questions/shuffle";

/**
 * These use the REAL blueprints. The previous tests only ever built a synthetic three-section
 * N2 exam, which is why neither of the two scoring bugs was caught: every other level has four
 * blueprint sections, and every level but N2 has a different pass mark.
 */
const ROOT = path.join(__dirname, "..");
const CONTENT = path.join(ROOT, "content");

const exams: ExamBlueprint[] = fs
  .readdirSync(path.join(CONTENT, "exams"))
  .filter((f) => f.endsWith(".json"))
  .flatMap((f) => {
    const j = JSON.parse(fs.readFileSync(path.join(CONTENT, "exams", f), "utf8"));
    return (Array.isArray(j) ? j : [j]).map((x) => ExamBlueprintSchema.parse(x));
  });

const questions: Question[] = shuffleQuestionBank(
  fs
    .readdirSync(path.join(CONTENT, "questions"))
    .filter((f) => f.endsWith(".json"))
    .flatMap((f) => {
      const j = JSON.parse(fs.readFileSync(path.join(CONTENT, "questions", f), "utf8"));
      return (Array.isArray(j) ? j : [j]).map((x) => QuestionSchema.parse(x));
    })
);
const byId = new Map(questions.map((q) => [q.id, q]));

/** Answer a given fraction of each section correctly, deterministically. */
function answerFraction(exam: ExamBlueprint, fraction: number): SubmittedAnswer[] {
  const out: SubmittedAnswer[] = [];
  for (const s of exam.sections) {
    s.questionIds.forEach((qid, i) => {
      const q = byId.get(qid);
      if (!q) return;
      const correct = i < Math.round(s.questionIds.length * fraction);
      out.push({ questionId: qid, selectedIndex: correct ? q.answerIndex : (q.answerIndex + 1) % q.options.length, seconds: 10 });
    });
  }
  return out;
}

const oneExamPerLevel = ["n5", "n4", "n3", "n2", "n1"].map((lv) => exams.find((e) => e.level === lv)!);

describe("exam scoring is level-aware", () => {
  it("has a blueprint for every level", () => {
    expect(oneExamPerLevel.every(Boolean)).toBe(true);
  });

  it.each(oneExamPerLevel.map((e) => [e.level, e] as const))("%s: a perfect paper scores exactly 180", (_level, exam) => {
    const r = scoreExam(exam, byId, answerFraction(exam, 1));
    expect(r.totalScaled).toBe(TOTAL_SCALED_MAX);
    expect(r.passedEstimate).toBe(true);
  });

  it.each(oneExamPerLevel.map((e) => [e.level, e] as const))("%s: a blank paper scores 0 and fails", (_level, exam) => {
    const r = scoreExam(exam, byId, []);
    expect(r.totalScaled).toBe(0);
    expect(r.passedEstimate).toBe(false);
  });

  it.each(oneExamPerLevel.map((e) => [e.level, e] as const))("%s: 75%% correct is well short of a perfect score", (_level, exam) => {
    // The old scorer scaled four sections to 60 each and capped at 180, so 75% displayed as 180.
    const r = scoreExam(exam, byId, answerFraction(exam, 0.75));
    expect(r.totalScaled).toBeLessThan(TOTAL_SCALED_MAX);
    expect(r.totalScaled).toBeGreaterThan(100);
  });

  it.each(oneExamPerLevel.map((e) => [e.level, e] as const))("%s: reports the official scoring sections, summing to 180", (_level, exam) => {
    const rules = SCORING_RULES[exam.level];
    const r = scoreExam(exam, byId, answerFraction(exam, 1));
    expect(r.sections.map((s) => s.id)).toEqual(rules.groups.map((g) => g.id));
    expect(r.sections.reduce((n, s) => n + (s.max ?? 0), 0)).toBe(TOTAL_SCALED_MAX);
    expect(r.passTotal).toBe(rules.passTotal);
  });

  it.each(oneExamPerLevel.map((e) => [e.level, e] as const))("%s: a zero in one section fails however high the total", (_level, exam) => {
    const answers: SubmittedAnswer[] = [];
    for (const s of exam.sections) {
      for (const qid of s.questionIds) {
        const q = byId.get(qid);
        if (!q) continue;
        const wrong = s.skill === "listening";
        answers.push({ questionId: qid, selectedIndex: wrong ? (q.answerIndex + 1) % q.options.length : q.answerIndex, seconds: 5 });
      }
    }
    const r = scoreExam(exam, byId, answers);
    expect(r.sections.find((s) => s.skill === "listening")?.scaled).toBe(0);
    expect(r.passedEstimate).toBe(false);
    // It must also not still read as a perfect total, which the old cap allowed.
    expect(r.totalScaled).toBeLessThan(TOTAL_SCALED_MAX);
  });

  it("uses each level's own pass mark, not N2's", () => {
    expect(Object.fromEntries(Object.entries(SCORING_RULES).map(([k, v]) => [k, v.passTotal]))).toEqual({ n5: 80, n4: 90, n3: 95, n2: 90, n1: 100 });
  });

  it("N5 and N4 score language and reading as one 120-point section", () => {
    for (const level of ["n5", "n4"] as const) {
      const groups = SCORING_RULES[level].groups;
      expect(groups).toHaveLength(2);
      expect(groups[0].max).toBe(120);
      expect(groups[0].min).toBe(38);
      expect(groups[1].max).toBe(60);
    }
  });

  it("N3, N2 and N1 score three 60-point sections", () => {
    for (const level of ["n3", "n2", "n1"] as const) {
      const groups = SCORING_RULES[level].groups;
      expect(groups).toHaveLength(3);
      expect(groups.every((g) => g.max === 60 && g.min === 19)).toBe(true);
    }
  });
});
