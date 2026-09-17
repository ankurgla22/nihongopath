/**
 * Validates every content file against its Zod schema and checks cross-references.
 * Run: npm run validate:content   (exit code 1 on any error)
 */
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  CurriculumSchema,
  ExamBlueprintSchema,
  FoundationLessonSchema,
  GrammarLessonSchema,
  KanjiItemSchema,
  ListeningExerciseSchema,
  QuestionSchema,
  ReadingPassageSchema,
  StrategyArticleSchema,
  VocabItemSchema,
} from "../src/lib/content/schemas";

const CONTENT = path.resolve(__dirname, "..", "content");
const errors: string[] = [];
const warnings: string[] = [];
const ids = new Set<string>();
const questionIds = new Set<string>();

function load(rel: string, schema: z.ZodTypeAny, collect?: Set<string>): any[] {
  const file = path.join(CONTENT, rel);
  if (!fs.existsSync(file)) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    errors.push(`${rel}: invalid JSON (${(e as Error).message})`);
    return [];
  }
  const arr = Array.isArray(raw) ? raw : [raw];
  const out: any[] = [];
  arr.forEach((item, i) => {
    const r = schema.safeParse(item) as { success: boolean; data: any; error: any };
    if (!r.success) {
      errors.push(`${rel}[${i}]: ${r.error.issues.map((x: any) => `${x.path.join(".")}: ${x.message}`).join("; ")}`);
      return;
    }
    if (collect && r.data.id) {
      if (collect.has(r.data.id)) errors.push(`${rel}[${i}]: duplicate id ${r.data.id}`);
      collect.add(r.data.id);
    }
    out.push(r.data);
  });
  return out;
}

function loadDir(relDir: string, schema: z.ZodTypeAny, collect?: Set<string>) {
  const dir = path.join(CONTENT, relDir);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .flatMap((f) => load(path.join(relDir, f), schema, collect));
}

const questions = loadDir("questions", QuestionSchema, questionIds);
const refs: { from: string; qid: string }[] = [];

for (const level of ["n5", "n4", "n3", "n2"]) {
  load(`${level}/grammar-base.json`, GrammarLessonSchema);
  load(`${level}/vocabulary.json`, VocabItemSchema);
  load(`${level}/kanji.json`, KanjiItemSchema);
  const grammar = loadDir(`${level}/grammar`, GrammarLessonSchema, ids);
  loadDir(`${level}/vocabulary`, VocabItemSchema, ids);
  loadDir(`${level}/kanji`, KanjiItemSchema, ids);
  const reading = loadDir(`${level}/reading`, ReadingPassageSchema, ids);
  const listening = loadDir(`${level}/listening`, ListeningExerciseSchema, ids);
  for (const g of grammar) for (const q of [...g.practiceQuestionIds, ...g.jlptQuestionIds]) refs.push({ from: g.id, qid: q });
  for (const r of reading) for (const q of r.questionIds) refs.push({ from: r.id, qid: q });
  for (const l of listening) for (const q of l.questionIds) refs.push({ from: l.id, qid: q });
}
const foundationDir = path.join(CONTENT, "foundation");
const foundation = loadDir("foundation", FoundationLessonSchema, ids);
for (const f of foundation) for (const q of f.practiceQuestionIds) refs.push({ from: f.id, qid: q });
const exams = loadDir("exams", ExamBlueprintSchema, ids);
for (const e of exams) for (const s of e.sections) for (const q of s.questionIds) refs.push({ from: e.id, qid: q });
loadDir("strategy", StrategyArticleSchema, ids);
const curriculumFile = path.join(CONTENT, "curriculum", "curriculum.json");
if (fs.existsSync(curriculumFile)) {
  const r = CurriculumSchema.safeParse(JSON.parse(fs.readFileSync(curriculumFile, "utf8")));
  if (!r.success) errors.push(`curriculum: ${r.error.issues[0]?.path.join(".")}: ${r.error.issues[0]?.message}`);
  else {
    const days = r.data.days.map((d) => d.day);
    for (let d = 1; d <= 180; d++) if (!days.includes(d)) errors.push(`curriculum: missing day ${d}`);
    for (const d of r.data.days) for (const t of d.tasks) if (t.examId && !exams.find((e) => e.id === t.examId)) errors.push(`curriculum day ${d.day}: unknown exam ${t.examId}`);
    // Kana tasks must point at foundation lessons. If content/foundation is not there yet, only warn.
    const foundationIds = new Set(foundation.map((f) => f.id));
    for (const d of r.data.days)
      for (const t of d.tasks)
        if (t.type === "kana")
          for (const id of t.contentIds)
            if (!foundationIds.has(id)) (fs.existsSync(foundationDir) ? errors : warnings).push(`curriculum day ${d.day}: kana task references missing foundation lesson ${id}`);
  }
}
for (const { from, qid } of refs) if (!questionIds.has(qid)) errors.push(`${from} references missing question ${qid}`);
for (const q of questions) if (q.answerIndex >= q.options.length) errors.push(`${q.id}: answerIndex out of range`);

for (const w of warnings.slice(0, 20)) console.warn(" ! " + w);
if (errors.length) {
  console.error(`Content validation failed with ${errors.length} error(s):`);
  for (const e of errors.slice(0, 50)) console.error(" - " + e);
  process.exit(1);
}
console.log(`Content OK: ${questions.length} questions, ${exams.length} exams, ${foundation.length} foundation lessons, ${ids.size} enriched items.${warnings.length ? ` ${warnings.length} warning(s).` : ""}`);
