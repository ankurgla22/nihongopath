import { cache } from "react";
import { getQuestions } from "@/lib/content";
import { LEVEL_LABEL, type Question } from "@/lib/content/schemas";
import { QUIZ_LENGTH, QUIZ_SKILLS, type QuizLevel, type QuizQuestion, type QuizSkill } from "./shared";

/**
 * The public ten-question quiz.
 *
 * Everything else that asks questions on this site sits behind a sign-in, because it writes to a
 * progress record. This one deliberately does not: it is the page someone lands on from a search
 * for "JLPT N5 kanji quiz", and asking them to make an account first would lose them.
 *
 * Reading and listening are left out on purpose. Both need a passage or a recording before the
 * question makes sense, which does not fit ten quick questions — they stay in the practice
 * sections where the passage is on the page.
 */
export { QUIZ_LENGTH, QUIZ_SKILLS } from "./shared";
export type { QuizLevel, QuizQuestion, QuizSkill } from "./shared";

/** The pool each page ships, big enough that a reset gives a genuinely different set. */
export const POOL = 60;

export type QuizCombo = { level: QuizLevel; skill: QuizSkill; count: number };

/** What each combination is called on the page and in the title. */
export function comboLabel(level: QuizLevel, skill: QuizSkill): string {
  if (level === "foundation") return skill === "kana" ? "Hiragana and katakana" : "Foundation";
  return `${LEVEL_LABEL[level]} ${skill}`;
}

export function comboTitle(level: QuizLevel, skill: QuizSkill): string {
  if (level === "foundation") return "Hiragana and katakana quiz";
  const s = skill === "kana" ? "kana" : skill;
  return `JLPT ${LEVEL_LABEL[level]} ${s} quiz`;
}

export function quizPath(level: QuizLevel, skill: QuizSkill): string {
  return `/quiz/${level}/${skill}`;
}

const isQuizLevel = (v: string): v is QuizLevel => v === "foundation" || ["n5", "n4", "n3", "n2", "n1"].includes(v);
const isQuizSkill = (v: string): v is QuizSkill => (QUIZ_SKILLS as readonly string[]).includes(v);

export function parseCombo(level: string, skill: string): { level: QuizLevel; skill: QuizSkill } | undefined {
  if (!isQuizLevel(level) || !isQuizSkill(skill)) return undefined;
  return { level, skill };
}

/**
 * Questions that stand on their own: no passage, no recording, and small enough to read on a
 * phone. A question whose prompt refers to "the passage above" is unanswerable here.
 */
function selfContained(q: Question): boolean {
  if (q.context) return false;
  if (q.tags?.readingId || q.tags?.listeningId) return false;
  return q.options.length >= 2 && q.prompt.length <= 160;
}

const bank = cache((): Question[] => getQuestions().filter(selfContained));

/** Every combination with enough questions to be worth a page. */
export const quizCombos = cache((): QuizCombo[] => {
  const out: QuizCombo[] = [];
  for (const level of ["foundation", "n5", "n4", "n3", "n2", "n1"] as QuizLevel[])
    for (const skill of QUIZ_SKILLS) {
      const count = bank().filter((q) => q.level === level && q.skill === skill).length;
      if (count >= QUIZ_LENGTH * 2) out.push({ level, skill, count });
    }
  return out;
});


/**
 * A pool for one combination, big enough that "new questions" is meaningfully new.
 *
 * The page is statically rendered, so the pool is fixed at build time and the client draws its ten
 * from it. That keeps the page cacheable — a server-side random draw would make every request
 * dynamic — while still giving a different quiz on each reset.
 */
export const quizPool = cache((level: QuizLevel, skill: QuizSkill): QuizQuestion[] => {
  const all = bank().filter((q) => q.level === level && q.skill === skill);
  // Take an even stride through the level rather than the first 60. The bank is in authoring
  // order, so the head of it is clustered by lesson — slicing meant a level's later questions
  // could never appear in the quiz at all, and every player saw the same opening set.
  const step = Math.max(1, Math.floor(all.length / POOL));
  const spread = all.filter((_, i) => i % step === 0).slice(0, POOL);
  return spread.map((q) => ({
    id: q.id,
    prompt: q.prompt,
    options: q.options,
    answerIndex: q.answerIndex,
    explanation: q.explanation,
    difficulty: q.difficulty,
  }));
});
