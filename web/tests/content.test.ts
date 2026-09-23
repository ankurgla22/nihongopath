/**
 * Content integrity tests. Reads content/*.json directly with the Zod schemas
 * (src/lib/content/index.ts is server-only and cannot be imported from Vitest).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import {
  CurriculumSchema,
  ExamBlueprintSchema,
  GrammarLessonSchema,
  LEVELS,
  ListeningExerciseSchema,
  QuestionSchema,
  ReadingPassageSchema,
  type Curriculum,
  type ExamBlueprint,
  type GrammarLesson,
  type ListeningExercise,
  type Question,
  type ReadingPassage,
} from "../src/lib/content/schemas";

const CONTENT_DIR = path.resolve(__dirname, "..", "content");

/** Minimal Node-side copy of the loader logic in src/lib/content/index.ts. */
function readJson<T>(rel: string, schema: z.ZodType<T>): T[] {
  const file = path.join(CONTENT_DIR, rel);
  if (!fs.existsSync(file)) return [];
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr.map((item, i) => {
    const r = schema.safeParse(item);
    if (!r.success) {
      const issue = r.error.issues[0];
      throw new Error(`${rel}[${i}]: ${issue?.path.join(".")} ${issue?.message}`);
    }
    return r.data;
  });
}

function readDirJson<T>(relDir: string, schema: z.ZodType<T>): T[] {
  const dir = path.join(CONTENT_DIR, relDir);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .flatMap((f) => readJson(path.join(relDir, f), schema));
}

const questions: Question[] = readDirJson("questions", QuestionSchema);
const questionIds = new Set(questions.map((q) => q.id));
const exams: ExamBlueprint[] = readDirJson("exams", ExamBlueprintSchema);
const curriculum: Curriculum = CurriculumSchema.parse(
  JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, "curriculum", "curriculum.json"), "utf8"))
);
const enrichedGrammar: GrammarLesson[] = LEVELS.flatMap((level) => readDirJson(`${level}/grammar`, GrammarLessonSchema));
const reading: ReadingPassage[] = LEVELS.flatMap((level) => readDirJson(`${level}/reading`, ReadingPassageSchema));
const listening: ListeningExercise[] = LEVELS.flatMap((level) => readDirJson(`${level}/listening`, ListeningExerciseSchema));

describe("content: question bank", () => {
  it("has questions", () => {
    expect(questions.length).toBeGreaterThan(0);
  });

  it("has no duplicate question ids", () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const q of questions) {
      if (seen.has(q.id)) dupes.push(q.id);
      seen.add(q.id);
    }
    expect(dupes).toEqual([]);
  });

  it("every answerIndex points into options", () => {
    const bad = questions.filter((q) => q.answerIndex >= q.options.length).map((q) => q.id);
    expect(bad).toEqual([]);
  });

  it("distractorExplanations length is 0, options.length or options.length - 1", () => {
    const bad = questions
      .filter((q) => {
        const n = q.distractorExplanations.length;
        return !(n === 0 || n === q.options.length || n === q.options.length - 1);
      })
      .map((q) => `${q.id} (${q.distractorExplanations.length}/${q.options.length})`);
    expect(bad).toEqual([]);
  });
});

describe("content: cross references", () => {
  it("every enriched grammar lesson's question ids exist", () => {
    expect(enrichedGrammar.length).toBeGreaterThan(0);
    const missing: string[] = [];
    for (const g of enrichedGrammar) {
      for (const qid of [...g.practiceQuestionIds, ...g.jlptQuestionIds]) {
        if (!questionIds.has(qid)) missing.push(`${g.id} -> ${qid}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("every reading passage and listening exercise question id exists", () => {
    const missing: string[] = [];
    for (const item of [...reading, ...listening]) {
      for (const qid of item.questionIds) if (!questionIds.has(qid)) missing.push(`${item.id} -> ${qid}`);
    }
    expect(missing).toEqual([]);
  });

  it("every exam section question id exists", () => {
    expect(exams.length).toBeGreaterThan(0);
    const missing: string[] = [];
    for (const e of exams) {
      for (const s of e.sections) {
        for (const qid of s.questionIds) if (!questionIds.has(qid)) missing.push(`${e.id}/${s.id} -> ${qid}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe("content: curriculum", () => {
  it("has 270 days numbered 1..270", () => {
    expect(curriculum.days).toHaveLength(270);
    const days = curriculum.days.map((d) => d.day).sort((a, b) => a - b);
    expect(days).toEqual(Array.from({ length: 270 }, (_, i) => i + 1));
  });

  it("each day has between 90 and 240 minutes of tasks", () => {
    const bad = curriculum.days
      .map((d) => ({ day: d.day, minutes: d.tasks.reduce((sum, t) => sum + t.minutes, 0) }))
      .filter((d) => d.minutes < 90 || d.minutes > 240);
    expect(bad).toEqual([]);
  });

  it("every day belongs to a declared phase whose range contains it", () => {
    const bad = curriculum.days.filter((d) => {
      const p = curriculum.phases.find((p) => p.id === d.phase);
      return !p || d.day < p.startDay || d.day > p.endDay;
    });
    expect(bad.map((d) => d.day)).toEqual([]);
  });
});
