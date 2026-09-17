import { z } from "zod";

export const LevelSchema = z.enum(["n5", "n4", "n3", "n2"]);
export type Level = z.infer<typeof LevelSchema>;

export const LEVELS: Level[] = ["n5", "n4", "n3", "n2"];
export const LEVEL_LABEL: Record<Level, string> = {
  n5: "N5",
  n4: "N4",
  n3: "N3",
  n2: "N2",
};

export const ExampleSchema = z.object({
  ja: z.string().min(1),
  reading: z.string().optional(),
  en: z.string().min(1),
  note: z.string().optional(),
});
export type Example = z.infer<typeof ExampleSchema>;

/** Diagram data rendered by components/diagrams. */
export const DiagramSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("conjugation-tree"),
    root: z.string(),
    rootLabel: z.string().optional(),
    branches: z.array(
      z.object({ suffix: z.string(), result: z.string(), label: z.string() })
    ),
  }),
  z.object({
    kind: z.literal("comparison"),
    title: z.string().optional(),
    columns: z.array(z.string()),
    rows: z.array(z.object({ label: z.string(), cells: z.array(z.string()) })),
  }),
  z.object({
    kind: z.literal("sentence-structure"),
    parts: z.array(
      z.object({ text: z.string(), role: z.string(), highlight: z.boolean().optional() })
    ),
    translation: z.string(),
  }),
  z.object({
    kind: z.literal("transformation"),
    steps: z.array(z.object({ ja: z.string(), en: z.string() })),
  }),
  z.object({
    kind: z.literal("scale"),
    title: z.string(),
    items: z.array(z.object({ label: z.string(), description: z.string() })),
  }),
]);
export type Diagram = z.infer<typeof DiagramSchema>;

export const QuestionTypeSchema = z.enum(["mc", "ordering", "cloze"]);

export const QuestionLevelSchema = z.enum(["foundation", "n5", "n4", "n3", "n2"]);
export type QuestionLevel = z.infer<typeof QuestionLevelSchema>;

export const QuestionSchema = z.object({
  id: z.string(),
  type: QuestionTypeSchema,
  level: QuestionLevelSchema,
  difficulty: z.number().int().min(1).max(5),
  skill: z.enum(["kana", "grammar", "vocabulary", "kanji", "reading", "listening"]),
  topic: z.string(),
  tags: z
    .object({
      grammarIds: z.array(z.string()).default([]),
      vocabIds: z.array(z.string()).default([]),
      kanjiIds: z.array(z.string()).default([]),
      readingId: z.string().optional(),
      listeningId: z.string().optional(),
      foundationId: z.string().optional(),
    })
    .default({ grammarIds: [], vocabIds: [], kanjiIds: [] }),
  prompt: z.string(),
  /** For reading/listening questions, a short passage or script shown above the prompt. */
  context: z.string().optional(),
  options: z.array(z.string()).min(2).max(6),
  /** Index into options. For ordering questions, options are shown shuffled and answerIndex marks the ★ item. */
  answerIndex: z.number().int().min(0),
  explanation: z.string(),
  distractorExplanations: z.array(z.string()).default([]),
});
export type Question = z.infer<typeof QuestionSchema>;
/** Slim question record (no prompt/options/explanations) used to pick question sets on the client. */
export type QuestionIndexEntry = Pick<Question, "id" | "level" | "skill" | "difficulty" | "tags">;

export const GrammarLessonSchema = z.object({
  id: z.string(),
  slug: z.string(),
  level: LevelSchema,
  order: z.number().int(),
  title: z.string(),
  romaji: z.string(),
  meaning: z.string(),
  simpleExplanation: z.string(),
  whenUsed: z.string().optional(),
  formation: z.array(z.string()),
  diagram: DiagramSchema.optional(),
  examples: z.array(ExampleSchema).min(1),
  similarGrammar: z
    .array(z.object({ id: z.string().optional(), pattern: z.string(), difference: z.string() }))
    .default([]),
  commonMistakes: z
    .array(z.object({ wrong: z.string(), right: z.string(), why: z.string() }))
    .default([]),
  usageNotes: z.array(z.string()).default([]),
  jlptTips: z.array(z.string()).default([]),
  practiceQuestionIds: z.array(z.string()).default([]),
  jlptQuestionIds: z.array(z.string()).default([]),
  reviewAfterDays: z.number().int().default(3),
  /** True for fully enriched lessons; false for base entries imported from study materials. */
  enriched: z.boolean().default(false),
});
export type GrammarLesson = z.infer<typeof GrammarLessonSchema>;

export const VocabItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  level: LevelSchema,
  order: z.number().int(),
  word: z.string(),
  reading: z.string(),
  pos: z.string(),
  meaning: z.string(),
  theme: z.string().optional(),
  examples: z.array(ExampleSchema).min(1),
  collocations: z.array(z.object({ ja: z.string(), en: z.string() })).default([]),
  related: z.array(z.string()).default([]),
  synonyms: z.array(z.string()).default([]),
  antonyms: z.array(z.string()).default([]),
  difficulty: z.number().int().min(1).max(5).default(3),
  memoryTip: z.string().optional(),
  kanjiIds: z.array(z.string()).default([]),
  enriched: z.boolean().default(false),
});
export type VocabItem = z.infer<typeof VocabItemSchema>;

export const KanjiItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  level: LevelSchema,
  order: z.number().int(),
  day: z.number().int(),
  character: z.string().length(1),
  meanings: z.array(z.string()).min(1),
  onyomi: z.array(z.string()).default([]),
  kunyomi: z.array(z.string()).default([]),
  words: z.array(z.object({ word: z.string(), reading: z.string(), meaning: z.string() })).min(1),
  examples: z.array(ExampleSchema).default([]),
  similarKanji: z.array(z.object({ character: z.string(), note: z.string() })).default([]),
  commonMistakes: z.array(z.string()).default([]),
  memoryAid: z.string().optional(),
  enriched: z.boolean().default(false),
});
export type KanjiItem = z.infer<typeof KanjiItemSchema>;

export const ReadingKindSchema = z.enum(["short", "medium", "long", "integrated", "info"]);

export const ReadingPassageSchema = z.object({
  id: z.string(),
  slug: z.string(),
  level: LevelSchema,
  order: z.number().int(),
  kind: ReadingKindSchema,
  title: z.string(),
  paragraphs: z.array(z.string()).min(1),
  /** For integrated-comprehension passages: text B. */
  paragraphsB: z.array(z.string()).optional(),
  vocab: z.array(z.object({ word: z.string(), reading: z.string(), meaning: z.string() })),
  questionIds: z.array(z.string()).min(1),
  strategyNotes: z.array(z.string()).default([]),
  timeLimitSeconds: z.number().int(),
});
export type ReadingPassage = z.infer<typeof ReadingPassageSchema>;

export const ListeningKindSchema = z.enum(["task", "point", "summary", "integrated", "quick-response"]);

export const ListeningExerciseSchema = z.object({
  id: z.string(),
  slug: z.string(),
  level: LevelSchema,
  order: z.number().int(),
  kind: ListeningKindSchema,
  title: z.string(),
  setting: z.string(),
  script: z.array(z.object({ speaker: z.string(), line: z.string() })).min(1),
  /** Optional audio file path under /public/audio. If absent, the player uses browser speech synthesis. */
  audioSrc: z.string().optional(),
  vocab: z.array(z.object({ word: z.string(), reading: z.string(), meaning: z.string() })),
  questionIds: z.array(z.string()).min(1),
});
export type ListeningExercise = z.infer<typeof ListeningExerciseSchema>;

export const TaskTypeSchema = z.enum([
  "kana",
  "grammar",
  "vocabulary",
  "kanji",
  "reading",
  "listening",
  "review",
  "quiz",
  "weekly-test",
  "phase-test",
  "mock-exam",
]);

export const CurriculumDaySchema = z.object({
  day: z.number().int().min(1).max(180),
  phase: z.number().int().min(1).max(6),
  title: z.string(),
  objectives: z.array(z.string()),
  tasks: z.array(
    z.object({
      type: TaskTypeSchema,
      minutes: z.number().int(),
      contentIds: z.array(z.string()).default([]),
      /** For quiz/test tasks: how many questions to draw and from which levels. */
      questionCount: z.number().int().optional(),
      examId: z.string().optional(),
    })
  ),
});
export type CurriculumDay = z.infer<typeof CurriculumDaySchema>;

export const CurriculumSchema = z.object({
  phases: z.array(
    z.object({
      id: z.number().int(),
      name: z.string(),
      description: z.string(),
      startDay: z.number().int(),
      endDay: z.number().int(),
    })
  ),
  days: z.array(CurriculumDaySchema),
});
export type Curriculum = z.infer<typeof CurriculumSchema>;

export const ExamBlueprintSchema = z.object({
  id: z.string(),
  level: LevelSchema,
  title: z.string(),
  description: z.string(),
  sections: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      skill: z.enum(["language", "reading", "listening"]),
      timeLimitSeconds: z.number().int(),
      questionIds: z.array(z.string()).min(1),
    })
  ),
});
export type ExamBlueprint = z.infer<typeof ExamBlueprintSchema>;

export const StrategyArticleSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  sections: z.array(z.object({ heading: z.string(), paragraphs: z.array(z.string()), bullets: z.array(z.string()).default([]) })),
});
export type StrategyArticle = z.infer<typeof StrategyArticleSchema>;

/** Foundation lessons: kana, pronunciation, numbers, counters, greetings. Level "foundation" sits before N5. */
export const FoundationBlockSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), paragraphs: z.array(z.string()) }),
  z.object({
    kind: z.literal("kana-chart"),
    title: z.string(),
    /** rows of cells; each cell may be null for gaps (e.g. yi/ye) */
    rows: z.array(z.array(z.object({ kana: z.string(), romaji: z.string() }).nullable())),
    rowLabels: z.array(z.string()).optional(),
  }),
  z.object({ kind: z.literal("table"), title: z.string().optional(), columns: z.array(z.string()), rows: z.array(z.array(z.string())) }),
  z.object({ kind: z.literal("list"), title: z.string().optional(), items: z.array(z.string()) }),
  z.object({ kind: z.literal("words"), title: z.string().optional(), items: z.array(z.object({ ja: z.string(), reading: z.string().optional(), en: z.string() })) }),
  z.object({ kind: z.literal("callout"), title: z.string().optional(), text: z.string(), tone: z.enum(["neutral", "accent", "ok", "warn", "info"]).default("info") }),
]);
export type FoundationBlock = z.infer<typeof FoundationBlockSchema>;

export const FoundationLessonSchema = z.object({
  id: z.string(),
  slug: z.string(),
  order: z.number().int(),
  kind: z.enum(["hiragana", "katakana", "pronunciation", "numbers", "greetings"]),
  title: z.string(),
  summary: z.string(),
  minutes: z.number().int().default(25),
  sections: z.array(z.object({ heading: z.string(), blocks: z.array(FoundationBlockSchema) })),
  practiceQuestionIds: z.array(z.string()).default([]),
});
export type FoundationLesson = z.infer<typeof FoundationLessonSchema>;
