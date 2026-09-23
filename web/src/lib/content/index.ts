import "server-only";
import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import { shuffleQuestionBank } from "@/lib/questions/shuffle";
import {
  CurriculumSchema,
  ExamBlueprintSchema,
  FoundationLessonSchema,
  GrammarLessonSchema,
  KanjiItemSchema,
  LEVELS,
  ListeningExerciseSchema,
  QuestionSchema,
  ReadingPassageSchema,
  StrategyArticleSchema,
  VocabItemSchema,
  type Curriculum,
  type ExamBlueprint,
  type FoundationLesson,
  type GrammarLesson,
  type KanjiItem,
  type Level,
  type ListeningExercise,
  type Question,
  type QuestionIndexEntry,
  type ReadingPassage,
  type StrategyArticle,
  type VocabItem,
} from "./schemas";
import { z } from "zod";

const CONTENT_DIR = path.join(process.cwd(), "content");

function readJson<T>(rel: string, schema: z.ZodType<T>): T[] {
  const file = path.join(CONTENT_DIR, rel);
  if (!fs.existsSync(file)) return [];
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  // A file may hold either an array of records or a single record (content/<level>/grammar/*.json).
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr.map((item, i) => {
    const r = schema.safeParse(item);
    if (!r.success) throw new Error(`${rel}[${i}]: ${r.error.issues[0]?.path.join(".")} ${r.error.issues[0]?.message}`);
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

/** Enriched lessons in content/<level>/grammar/*.json override base entries with the same order. */
export const getGrammar = cache((level: Level): GrammarLesson[] => {
  const base = readJson(`${level}/grammar-base.json`, GrammarLessonSchema);
  const enriched = readDirJson(`${level}/grammar`, GrammarLessonSchema);
  const byOrder = new Map<number, GrammarLesson>();
  for (const g of base) byOrder.set(g.order, g);
  for (const g of enriched) byOrder.set(g.order, { ...g, enriched: true });
  return [...byOrder.values()].sort((a, b) => a.order - b.order);
});

export const getVocabulary = cache((level: Level): VocabItem[] => {
  const base = readJson(`${level}/vocabulary.json`, VocabItemSchema);
  const enriched = readDirJson(`${level}/vocabulary`, VocabItemSchema);
  const byWord = new Map<string, VocabItem>();
  for (const v of base) byWord.set(v.word, v);
  for (const v of enriched) {
    const prev = byWord.get(v.word);
    byWord.set(v.word, { ...(prev ?? {}), ...v, order: prev?.order ?? v.order, enriched: true });
  }
  return [...byWord.values()].sort((a, b) => a.order - b.order);
});

export const getKanji = cache((level: Level): KanjiItem[] => {
  const base = readJson(`${level}/kanji.json`, KanjiItemSchema);
  const enriched = readDirJson(`${level}/kanji`, KanjiItemSchema);
  const byChar = new Map<string, KanjiItem>();
  for (const k of base) byChar.set(k.character, k);
  for (const k of enriched) {
    const prev = byChar.get(k.character);
    byChar.set(k.character, { ...(prev ?? {}), ...k, order: prev?.order ?? k.order, day: prev?.day ?? k.day, enriched: true });
  }
  return [...byChar.values()].sort((a, b) => a.order - b.order);
});

export const getReading = cache((level: Level): ReadingPassage[] =>
  readDirJson(`${level}/reading`, ReadingPassageSchema).sort((a, b) => a.order - b.order)
);

export const getListening = cache((level: Level): ListeningExercise[] =>
  readDirJson(`${level}/listening`, ListeningExerciseSchema).sort((a, b) => a.order - b.order)
);

export const getFoundation = cache((): FoundationLesson[] => readDirJson("foundation", FoundationLessonSchema).sort((a, b) => a.order - b.order));
export function findFoundation(slug: string) {
  return getFoundation().find((f) => f.slug === slug);
}

/**
 * The question bank, with multiple-choice options shuffled deterministically per question id
 * (see lib/questions/shuffle). The authored data is heavily keyed to the first option, so the
 * shuffle happens once here rather than at each of the six render sites, which keeps
 * `answerIndex`, the per-option notes and every consumer consistent.
 */
export const getQuestions = cache((): Question[] => shuffleQuestionBank(readDirJson("questions", QuestionSchema)));

/** Slim index of the whole bank (id/level/skill/difficulty/tags) — a fraction of the size of the full records. */
export const getQuestionIndex = cache((): QuestionIndexEntry[] =>
  getQuestions().map(({ id, level, skill, difficulty, tags }) => ({ id, level, skill, difficulty, tags }))
);

export const getQuestionMap = cache((): Map<string, Question> => {
  const m = new Map<string, Question>();
  for (const q of getQuestions()) m.set(q.id, q);
  return m;
});

export const getExams = cache((): ExamBlueprint[] => readDirJson("exams", ExamBlueprintSchema));

export const getStrategy = cache((): StrategyArticle[] => readDirJson("strategy", StrategyArticleSchema));

export const getCurriculum = cache((): Curriculum => {
  const file = path.join(CONTENT_DIR, "curriculum", "curriculum.json");
  if (!fs.existsSync(file)) return { phases: [], days: [] };
  return CurriculumSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
});

// ---- lookups ----

export function findGrammar(level: Level, slug: string) {
  return getGrammar(level).find((g) => g.slug === slug);
}
export function findVocab(level: Level, slug: string) {
  return getVocabulary(level).find((v) => v.slug === slug);
}
export function findKanji(level: Level, slug: string) {
  return getKanji(level).find((k) => k.slug === slug);
}
export function findReading(level: Level, slug: string) {
  return getReading(level).find((r) => r.slug === slug);
}
export function findListening(level: Level, slug: string) {
  return getListening(level).find((l) => l.slug === slug);
}
export function findExam(id: string) {
  return getExams().find((e) => e.id === id);
}

/** Resolve any content id to a public URL and title. */
export const resolveContentId = cache((id: string): { href: string; title: string; type: string } | null => {
  if (id.startsWith("foundation-")) {
    const f = getFoundation().find((x) => x.id === id);
    return f ? { href: `/japanese/foundation/${f.slug}`, title: f.title, type: "kana" } : null;
  }
  for (const level of LEVELS) {
    if (id.startsWith(`${level}-grammar-`)) {
      const g = getGrammar(level).find((x) => x.id === id);
      return g ? { href: `/japanese/${level}/grammar/${g.slug}`, title: g.title, type: "grammar" } : null;
    }
    if (id.startsWith(`${level}-vocab-`)) {
      const v = getVocabulary(level).find((x) => x.id === id);
      return v ? { href: `/japanese/${level}/vocabulary/${v.slug}`, title: v.word, type: "vocabulary" } : null;
    }
    if (id.startsWith(`${level}-kanji-`)) {
      const k = getKanji(level).find((x) => x.id === id);
      return k ? { href: `/japanese/${level}/kanji/${k.slug}`, title: k.character, type: "kanji" } : null;
    }
    if (id.startsWith(`${level}-reading-`)) {
      const r = getReading(level).find((x) => x.id === id);
      return r ? { href: `/japanese/${level}/reading/${r.slug}`, title: r.title, type: "reading" } : null;
    }
    if (id.startsWith(`${level}-listening-`)) {
      const l = getListening(level).find((x) => x.id === id);
      return l ? { href: `/japanese/${level}/listening/${l.slug}`, title: l.title, type: "listening" } : null;
    }
  }
  return null;
});

export const contentStats = cache(() => {
  const per = LEVELS.map((level) => ({
    level,
    grammar: getGrammar(level).length,
    vocabulary: getVocabulary(level).length,
    kanji: getKanji(level).length,
    reading: getReading(level).length,
    listening: getListening(level).length,
  }));
  return { per, questions: getQuestions().length, exams: getExams().length };
});
