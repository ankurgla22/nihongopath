/**
 * Validates every content file against its Zod schema and checks cross-references.
 * Run: npm run validate:content   (exit code 1 on any error)
 */
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { shuffleQuestionBank } from "../src/lib/questions/shuffle";
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
const questionById = new Map<string, (typeof questions)[number]>(questions.map((q) => [q.id, q]));
const refs: { from: string; qid: string }[] = [];

for (const level of ["n5", "n4", "n3", "n2", "n1"]) {
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

// Exam integrity: no question shared between exams, and no exam keyed mostly to one option index
// (a learner who always picks "1" must not be able to pass).
const examOfQuestion = new Map<string, string>();
for (const e of exams) {
  const counts = [0, 0, 0, 0, 0, 0];
  let n = 0;
  for (const s of e.sections) {
    for (const qid of s.questionIds) {
      const prev = examOfQuestion.get(qid);
      if (prev && prev !== e.id) errors.push(`${e.id}: question ${qid} is also used by ${prev}`);
      examOfQuestion.set(qid, e.id);
      const q = questionById.get(qid);
      if (!q) continue;
      n++;
      counts[q.answerIndex]++;
      if (q.level !== e.level) errors.push(`${e.id}: question ${qid} is level ${q.level}`);
    }
  }
  const worst = Math.max(...counts);
  if (n >= 20 && worst / n > 0.45) errors.push(`${e.id}: ${Math.round((worst / n) * 100)}% of answers use one option index (max 45%)`);
}
/**
 * Answer-key concentration across the practice bank, measured on what a learner actually sees.
 *
 * The exam check above has always been here; the authored bank never had one, and had drifted to
 * 49% keyed to the first option (100% in the N5 grammar file), so a learner could pass a lesson
 * quiz by always clicking option 1. getQuestions() shuffles per question id, so the check runs
 * over the shuffled view: that is the distribution that matters, and it fails if the shuffle is
 * ever removed or stops working.
 */
{
  const shuffled = shuffleQuestionBank(questions);
  const share = (qs: typeof shuffled) => {
    const counts = [0, 0, 0, 0, 0, 0];
    for (const q of qs) counts[q.answerIndex]++;
    return Math.max(...counts) / qs.length;
  };
  const report = (label: string, qs: typeof shuffled) => {
    if (qs.length < 20) return;
    const worst = share(qs);
    if (worst > 0.45) errors.push(`${label}: ${Math.round(worst * 100)}% of answers use one option index (max 45%)`);
  };

  const nonExam = shuffled.filter((q) => !examOfQuestion.has(q.id));
  report("question bank (practice)", nonExam);
  for (const skill of new Set(nonExam.map((q) => q.skill))) report(`question bank: skill ${skill}`, nonExam.filter((q) => q.skill === skill));
  for (const level of new Set(nonExam.map((q) => q.level))) report(`question bank: level ${level}`, nonExam.filter((q) => q.level === level));

  // Per lesson: a single lesson quiz is short, so the bar is "not every question keyed the same".
  const byLesson = new Map<string, typeof shuffled>();
  for (const q of shuffled) for (const gid of q.tags.grammarIds ?? []) byLesson.set(gid, [...(byLesson.get(gid) ?? []), q]);
  const allSame = [...byLesson.entries()].filter(([, qs]) => qs.length >= 4 && new Set(qs.map((q) => q.answerIndex)).size === 1);
  if (allSame.length) {
    errors.push(`${allSame.length} lesson(s) have every question keyed to the same option (e.g. ${allSame.slice(0, 3).map(([id]) => id).join(", ")})`);
  }
}

loadDir("strategy", StrategyArticleSchema, ids);
const curriculumFile = path.join(CONTENT, "curriculum", "curriculum.json");
if (fs.existsSync(curriculumFile)) {
  const r = CurriculumSchema.safeParse(JSON.parse(fs.readFileSync(curriculumFile, "utf8")));
  if (!r.success) errors.push(`curriculum: ${r.error.issues[0]?.path.join(".")}: ${r.error.issues[0]?.message}`);
  else {
    const days = r.data.days.map((d) => d.day);
    const maxDay = Math.max(...r.data.phases.map((p) => p.endDay));
    for (let d = 1; d <= maxDay; d++) if (!days.includes(d)) errors.push(`curriculum: missing day ${d}`);
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
for (const q of questions) {
  if (q.answerIndex >= q.options.length) errors.push(`${q.id}: answerIndex out of range`);
  if (new Set(q.options).size !== q.options.length) errors.push(`${q.id}: duplicate options`);
  if (q.options.some((o: string) => !o.trim())) errors.push(`${q.id}: empty option`);
  // Per-option notes: two marker conventions are in use ("(correct answer)" and a "Correct:" prefix),
  // and the UI highlights the key from answerIndex, so a marker is optional. What must never happen is
  // a note calling a NON-key option the correct one — that is a mis-keyed question.
  if (q.distractorExplanations.length === q.options.length) {
    // Match only the three marker forms actually in use. A mid-sentence "(correct answer)" is
    // skipped because it also occurs as the English gloss of the word 正解.
    const isMarker = (d: string) => {
      const t = d.trim();
      return /^\(correct answer\)/i.test(t) || /^correct[::]/i.test(t) || /is the ★ item \(correct answer\)/i.test(t);
    };
    const marked = q.distractorExplanations.flatMap((d: string, i: number) => (isMarker(d) ? [i] : []));
    const wrong = marked.filter((i: number) => i !== q.answerIndex);
    if (wrong.length) errors.push(`${q.id}: option(s) ${wrong.join(", ")} marked correct but the key is ${q.answerIndex}`);
  }
  // Ordering questions: the ★ slot in the prompt must match the keyed option, given the "Full order: a b c d →" in the explanation.
  if (q.type === "ordering") {
    const m = /Full order:\s*(.+?)\s*→/.exec(q.explanation);
    const slots = [...q.prompt.matchAll(/★|＿＿|＿/g)].map((x) => x[0]);
    const starPos = slots.indexOf("★");
    if (m && starPos >= 0 && slots.length === 4) {
      const optSet = new Set<string>(q.options);
      const order = m[1].trim().split(/\s+/).filter((t) => optSet.has(t));
      if (order.length === 4 && new Set(order).size === 4 && order[starPos] !== q.options[q.answerIndex]) {
        errors.push(`${q.id}: ★ slot (${order[starPos]}) does not match keyed option (${q.options[q.answerIndex]})`);
      }
    }
  }
}
// Comparison diagrams must have one cell per column (the row label is rendered separately).
for (const level of ["n5", "n4", "n3", "n2", "n1"]) {
  const dir = path.join(CONTENT, level, "grammar");
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    const g = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    if (g.diagram?.kind === "comparison") {
      const n = g.diagram.columns.length;
      g.diagram.rows.forEach((r: { cells: string[] }, i: number) => {
        if (r.cells.length !== n) errors.push(`${g.id}: comparison row ${i} has ${r.cells.length} cells for ${n} columns`);
      });
    }
  }
}

for (const w of warnings.slice(0, 20)) console.warn(" ! " + w);
if (errors.length) {
  console.error(`Content validation failed with ${errors.length} error(s):`);
  for (const e of errors.slice(0, 50)) console.error(" - " + e);
  process.exit(1);
}
console.log(`Content OK: ${questions.length} questions, ${exams.length} exams, ${foundation.length} foundation lessons, ${ids.size} enriched items.${warnings.length ? ` ${warnings.length} warning(s).` : ""}`);
