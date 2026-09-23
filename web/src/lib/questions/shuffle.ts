import type { Question } from "@/lib/content/schemas";

/**
 * Deterministic per-question option shuffle.
 *
 * The authored bank is badly skewed towards the first option: 49% of the 6,675 practice
 * questions are keyed to option 1, and in the N5 grammar file it is 100%. Options were
 * rendered in stored order, so a learner could score full marks on a lesson quiz by always
 * clicking the first answer, and every mastery signal the review engine derives from those
 * quizzes was meaningless.
 *
 * The permutation is derived from the question id alone, so it is stable across a server
 * render and the client hydration that follows, stable between visits, and stable across
 * deploys. That matters because a learner's stored answer is an index: a shuffle that changed
 * between renders would mark correct answers wrong.
 *
 * Deliberately narrow:
 * - Only `mc`. An `ordering` question's options are sentence chunks and its explanation names
 *   their positions ("(1-2-3-4). ★ is the second slot"), so reordering them would make the
 *   explanation false. `cloze` and `ordering` are also already well distributed (30% and 38%).
 * - Skipped when the wording refers to an option by number ("Only option 1 uses …"), which a
 *   handful of questions do.
 * - `distractorExplanations` move with their options when there is one per option; when the
 *   list is shorter it is a generic set keyed by marker, not by position, so it is left alone
 *   (see wrongOptionNotes).
 */

/** Explanation text that names an option by number; reordering would make it wrong. */
const REFERS_TO_OPTION_NUMBER = /\b(?:option|choice)\s*\d\b/i;

/** FNV-1a: a small, stable string hash. Nothing here is security-sensitive. */
function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: tiny seeded PRNG, so the same id always yields the same permutation. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates over the index positions, so callers can permute parallel arrays identically. */
function permutation(n: number, seed: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  const rand = rng(seed);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** True when this question's options may be reordered without invalidating its wording. */
export function isShuffleable(q: Question): boolean {
  if (q.type !== "mc") return false;
  if (q.options.length < 2) return false;
  if (REFERS_TO_OPTION_NUMBER.test(q.explanation)) return false;
  if (q.distractorExplanations.some((d) => REFERS_TO_OPTION_NUMBER.test(d))) return false;
  return true;
}

/**
 * The question with its options reordered, `answerIndex` following the correct option.
 * `salt` re-rolls the permutation; shuffleQuestionBank uses it to break up a lesson whose
 * questions all landed on the same option by chance.
 */
export function shuffleQuestionOptions(q: Question, salt = 0): Question {
  if (!isShuffleable(q)) return q;
  const order = permutation(q.options.length, hashId(q.id) + salt * 0x9e3779b9);
  // A permutation that changes nothing is legal but pointless; keep the original object.
  if (order.every((from, to) => from === to)) return q;

  const options = order.map((from) => q.options[from]);
  const answerIndex = order.indexOf(q.answerIndex);
  const aligned = q.distractorExplanations.length === q.options.length;
  return {
    ...q,
    options,
    answerIndex,
    distractorExplanations: aligned ? order.map((from) => q.distractorExplanations[from]) : q.distractorExplanations,
  };
}

/**
 * Shuffle a whole bank, then make sure no single lesson ends up with every question keyed to
 * the same option.
 *
 * Per-question shuffling fixes the bank-wide skew, but a short quiz can still land on one
 * option for all four questions by chance (about one lesson in sixty-four), and a learner who
 * notices can click straight through it. This re-rolls the last question of such a group until
 * it differs. Still fully deterministic: it depends only on the content, so a server render and
 * the client hydration that follows agree.
 */
export function shuffleQuestionBank(questions: Question[]): Question[] {
  const out = questions.map((q) => shuffleQuestionOptions(q));

  const byLesson = new Map<string, number[]>();
  out.forEach((q, i) => {
    for (const gid of q.tags.grammarIds ?? []) byLesson.set(gid, [...(byLesson.get(gid) ?? []), i]);
  });

  for (const idxs of byLesson.values()) {
    if (idxs.length < 2) continue;
    const distinct = new Set(idxs.map((i) => out[i].answerIndex));
    if (distinct.size > 1) continue;
    // Re-roll the last shuffleable question in the group until its key differs.
    const target = [...idxs].reverse().find((i) => isShuffleable(questions[i]));
    if (target === undefined) continue;
    const keyed = out[target].answerIndex;
    for (let salt = 1; salt <= 8; salt++) {
      const candidate = shuffleQuestionOptions(questions[target], salt);
      if (candidate.answerIndex !== keyed) {
        out[target] = candidate;
        break;
      }
    }
  }
  return out;
}
