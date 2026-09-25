/**
 * The parts of the quiz contract the browser is allowed to see.
 *
 * Kept apart from quickQuiz.ts because that module reads the question bank off disk and is marked
 * `server-only`; importing a single constant from it into the client component pulled the whole
 * server module into the browser bundle and failed the build. Types alone would have been erased,
 * but QUIZ_LENGTH is a value.
 */

/** How many questions one round asks. */
export const QUIZ_LENGTH = 10;

/** What the client needs to run a round: no ids of lessons, no tags, no answer key beyond the index. */
export type QuizQuestion = {
  id: string;
  prompt: string;
  options: string[];
  answerIndex: number;
  explanation: string;
  difficulty: number;
};

export const QUIZ_SKILLS = ["kana", "vocabulary", "kanji", "grammar"] as const;
export type QuizSkill = (typeof QUIZ_SKILLS)[number];
export type QuizLevel = "foundation" | "n5" | "n4" | "n3" | "n2" | "n1";
