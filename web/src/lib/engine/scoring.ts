/**
 * Scoring engine: pure functions to grade quizzes and mock exams and to
 * draw question sets from the question bank deterministically.
 *
 * No firebase / server-only imports — used from both client and server.
 */
import type { Question, QuestionIndexEntry, ExamBlueprint, QuestionLevel, Level } from "@/lib/content/schemas";
import type { AnswerRecord, ExamResultDoc, Skill } from "@/lib/firestore/types";
import { SKILLS } from "@/lib/firestore/types";

export type SubmittedAnswer = {
  questionId: string;
  selectedIndex: number | null;
  seconds: number;
};

export type WeakTags = {
  grammarIds: string[];
  vocabIds: string[];
  kanjiIds: string[];
  readingIds: string[];
  listeningIds: string[];
};

export type SkillBreakdown = Partial<Record<Skill, { correct: number; total: number }>>;

export type QuizScore = {
  score: number;
  total: number;
  /** 0..1; 0 when total is 0 */
  accuracy: number;
  answers: AnswerRecord[];
  skillBreakdown: SkillBreakdown;
  /** Every content id tagged on a wrongly answered question, de-duplicated, in first-seen order. */
  weakContentIds: string[];
  weakTags: WeakTags;
};

/** Exam result without the persistence-only fields. */
export type ExamScore = Omit<ExamResultDoc, "id" | "createdAt" | "date">;

/** Every level is scored out of 180 in total; a single scoring section is out of 60 or 120. */
export const SECTION_SCALED_MAX = 60;
export const TOTAL_SCALED_MAX = 180;
/**
 * Kept for stored results written before scoring became level-aware, which carry no per-section
 * max/min. New code reads the values on the section itself.
 */
export const PASS_TOTAL_MIN = 90;
export const PASS_SECTION_MIN = 19;

/**
 * Official JLPT scoring, which is not the same shape as the test booklet.
 *
 * A blueprint's sections are the timed *sittings* (N1 sits vocabulary and grammar as two
 * separate parts), but scoring groups them by skill: N3-N1 report three sections of 0-60, and
 * N5/N4 report language knowledge and reading as one combined 0-120 alongside listening 0-60.
 * Scaling each blueprint section to 60 independently is what made a four-part level total 240
 * before the cap, so a 75% paper displayed as a perfect 180.
 *
 * Pass marks and sectional minimums from the official results page (see lib/seo/sources).
 */
type ExamSkill = ExamBlueprint["sections"][number]["skill"];
type ScoringGroup = { id: string; name: string; skills: ExamSkill[]; max: number; min: number };

const THREE_SECTION: ScoringGroup[] = [
  { id: "language", name: "言語知識（文字・語彙・文法）", skills: ["language"], max: 60, min: 19 },
  { id: "reading", name: "読解", skills: ["reading"], max: 60, min: 19 },
  { id: "listening", name: "聴解", skills: ["listening"], max: 60, min: 19 },
];
const TWO_SECTION: ScoringGroup[] = [
  { id: "language-reading", name: "言語知識・読解", skills: ["language", "reading"], max: 120, min: 38 },
  { id: "listening", name: "聴解", skills: ["listening"], max: 60, min: 19 },
];

export const SCORING_RULES: Record<Level, { passTotal: number; groups: ScoringGroup[] }> = {
  n5: { passTotal: 80, groups: TWO_SECTION },
  n4: { passTotal: 90, groups: TWO_SECTION },
  n3: { passTotal: 95, groups: THREE_SECTION },
  n2: { passTotal: 90, groups: THREE_SECTION },
  n1: { passTotal: 100, groups: THREE_SECTION },
};

/** Scale a raw score onto a scoring section's own maximum (60, or 120 for the combined one). */
export function scaleTo(raw: number, total: number, max: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(max, Math.round((raw / total) * max)));
}

function pushUnique(list: string[], seen: Set<string>, id: string | undefined) {
  if (!id || seen.has(id)) return;
  seen.add(id);
  list.push(id);
}

/** All content ids attached to a question's tags, in a stable order. */
export function questionContentIds(q: { tags?: Question["tags"]; contentIds?: string[] }): string[] {
  if (q.contentIds) return q.contentIds;
  const t: Partial<NonNullable<Question["tags"]>> = q.tags ?? {};
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of t.grammarIds ?? []) pushUnique(out, seen, id);
  for (const id of t.vocabIds ?? []) pushUnique(out, seen, id);
  for (const id of t.kanjiIds ?? []) pushUnique(out, seen, id);
  pushUnique(out, seen, t.readingId);
  pushUnique(out, seen, t.listeningId);
  pushUnique(out, seen, t.foundationId);
  return out;
}

function indexAnswers(answers: SubmittedAnswer[]): Map<string, SubmittedAnswer> {
  const m = new Map<string, SubmittedAnswer>();
  for (const a of answers) {
    // Last submission for a question wins.
    m.set(a.questionId, a);
  }
  return m;
}

function gradeOne(q: Question, a: SubmittedAnswer | undefined): AnswerRecord {
  const selectedIndex = a?.selectedIndex ?? null;
  const seconds = Math.max(0, Number.isFinite(a?.seconds) ? (a!.seconds as number) : 0);
  return {
    questionId: q.id,
    selectedIndex,
    correct: selectedIndex !== null && selectedIndex === q.answerIndex,
    seconds,
  };
}

/**
 * Grade a quiz. Every question in `questions` is graded; questions without a
 * submitted answer (or with selectedIndex null) count as wrong. Answers for
 * unknown question ids are ignored.
 */
export function scoreQuiz(questions: Question[], answers: SubmittedAnswer[]): QuizScore {
  const byId = indexAnswers(answers);
  const records: AnswerRecord[] = [];
  const skillBreakdown: SkillBreakdown = {};
  const weakContentIds: string[] = [];
  const weakSeen = new Set<string>();
  const weakTags: WeakTags = { grammarIds: [], vocabIds: [], kanjiIds: [], readingIds: [], listeningIds: [] };
  const tagSeen = {
    grammarIds: new Set<string>(),
    vocabIds: new Set<string>(),
    kanjiIds: new Set<string>(),
    readingIds: new Set<string>(),
    listeningIds: new Set<string>(),
  };

  let score = 0;
  for (const q of questions) {
    const rec = gradeOne(q, byId.get(q.id));
    records.push(rec);
    const sb = (skillBreakdown[q.skill] ??= { correct: 0, total: 0 });
    sb.total += 1;
    if (rec.correct) {
      sb.correct += 1;
      score += 1;
      continue;
    }
    for (const id of questionContentIds(q)) pushUnique(weakContentIds, weakSeen, id);
    const t = q.tags ?? {};
    for (const id of t.grammarIds ?? []) pushUnique(weakTags.grammarIds, tagSeen.grammarIds, id);
    for (const id of t.vocabIds ?? []) pushUnique(weakTags.vocabIds, tagSeen.vocabIds, id);
    for (const id of t.kanjiIds ?? []) pushUnique(weakTags.kanjiIds, tagSeen.kanjiIds, id);
    pushUnique(weakTags.readingIds, tagSeen.readingIds, t.readingId);
    pushUnique(weakTags.listeningIds, tagSeen.listeningIds, t.listeningId);
  }

  const total = questions.length;
  return {
    score,
    total,
    accuracy: total === 0 ? 0 : score / total,
    answers: records,
    skillBreakdown,
    weakContentIds,
    weakTags,
  };
}

/** raw/total × 60, rounded half-up; 0 for an empty section. */
export function scaleSection(raw: number, total: number): number {
  if (total <= 0) return 0;
  const scaled = Math.round((raw / total) * SECTION_SCALED_MAX);
  return Math.max(0, Math.min(SECTION_SCALED_MAX, scaled));
}

/**
 * Grade a mock exam section by section. Questions referenced by the blueprint
 * but missing from `questionMap` are skipped (they neither count for nor
 * against the learner) so a partially loaded bank never crashes grading.
 */
export function scoreExam(
  exam: ExamBlueprint,
  questionMap: Map<string, Question>,
  answers: SubmittedAnswer[]
): ExamScore {
  const byId = indexAnswers(answers);
  const allAnswers: AnswerRecord[] = [];
  const weakContentIds: string[] = [];
  const weakSeen = new Set<string>();
  let totalSeconds = 0;

  // Grade each blueprint section (the timed sittings) first.
  const raw = exam.sections.map((s) => {
    let score = 0;
    let total = 0;
    let seconds = 0;
    for (const qid of s.questionIds) {
      const q = questionMap.get(qid);
      if (!q) continue;
      const rec = gradeOne(q, byId.get(qid));
      allAnswers.push(rec);
      total += 1;
      seconds += rec.seconds;
      if (rec.correct) score += 1;
      else for (const id of questionContentIds(q)) pushUnique(weakContentIds, weakSeen, id);
    }
    totalSeconds += seconds;
    return { ...s, score, total, seconds };
  });

  // Then fold them into the official scoring sections for this level.
  const rules = SCORING_RULES[exam.level];
  const sections = rules.groups
    .map((g) => {
      const parts = raw.filter((r) => g.skills.includes(r.skill));
      const score = parts.reduce((n, r) => n + r.score, 0);
      const total = parts.reduce((n, r) => n + r.total, 0);
      const seconds = parts.reduce((n, r) => n + r.seconds, 0);
      return { id: g.id, name: g.name, skill: g.skills[0], score, total, seconds, scaled: scaleTo(score, total, g.max), max: g.max, min: g.min };
    })
    // A blueprint missing a skill entirely (or whose questions are all absent) contributes nothing.
    .filter((s) => s.total > 0);

  // No cap needed: the group maxima already sum to 180.
  const totalScaled = sections.reduce((sum, s) => sum + s.scaled, 0);
  const passedEstimate = sections.length === rules.groups.length && totalScaled >= rules.passTotal && sections.every((s) => s.scaled >= s.min);

  return {
    examId: exam.id,
    title: exam.title,
    passTotal: rules.passTotal,
    sections,
    answers: allAnswers,
    totalScaled,
    passedEstimate,
    seconds: totalSeconds,
    weakContentIds,
  };
}

/* ------------------------------------------------------------------------ */
/* Deterministic question picking                                            */
/* ------------------------------------------------------------------------ */

/** mulberry32 — small, fast, seedable 32-bit PRNG. Returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Turn any string into a 32-bit seed (FNV-1a). */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** In-place Fisher–Yates shuffle using the supplied PRNG. */
export function shuffle<T>(items: T[], rand: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export type PickOptions = {
  count: number;
  levels?: QuestionLevel[];
  skills?: Skill[];
  /** Inclusive upper bound on question.difficulty (1..5). */
  difficultyMax?: number;
  excludeIds?: Iterable<string>;
  /** Questions tagged with any of these content ids are drawn first. */
  preferContentIds?: Iterable<string>;
  /** Number or string seed. Defaults to 0 so calls are reproducible. */
  seed?: number | string;
};

/**
 * Draw `count` distinct questions from `pool`. Questions tagged with one of
 * `preferContentIds` are drawn first (in seeded random order), then the rest
 * of the eligible pool fills the remaining slots. Results are deterministic
 * for a given seed and pool ordering, and never contain duplicates (by id).
 */
export function pickQuestions<T extends QuestionIndexEntry>(pool: T[], opts: PickOptions): T[] {
  const count = Math.max(0, Math.floor(opts.count));
  if (count === 0) return [];

  const levels = opts.levels && opts.levels.length ? new Set(opts.levels) : null;
  const skills = opts.skills && opts.skills.length ? new Set(opts.skills) : null;
  const exclude = new Set(opts.excludeIds ?? []);
  const prefer = new Set(opts.preferContentIds ?? []);
  const seed = typeof opts.seed === "string" ? hashSeed(opts.seed) : (opts.seed ?? 0);
  const rand = mulberry32(seed);

  const seen = new Set<string>();
  const preferred: T[] = [];
  const others: T[] = [];
  for (const q of pool) {
    if (seen.has(q.id) || exclude.has(q.id)) continue;
    if (levels && !levels.has(q.level)) continue;
    if (skills && !skills.has(q.skill)) continue;
    if (opts.difficultyMax !== undefined && q.difficulty > opts.difficultyMax) continue;
    seen.add(q.id);
    const isPreferred = prefer.size > 0 && questionContentIds(q).some((id) => prefer.has(id));
    (isPreferred ? preferred : others).push(q);
  }

  shuffle(preferred, rand);
  shuffle(others, rand);
  return preferred.concat(others).slice(0, count);
}

/** Convenience: all skills present in a set of questions, in canonical order. */
export function skillsIn(questions: Pick<Question, "skill">[]): Skill[] {
  const present = new Set(questions.map((q) => q.skill));
  return SKILLS.filter((s) => present.has(s));
}
