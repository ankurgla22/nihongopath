/**
 * Wire format for the slim question index shipped to private pages (daily study, tests, review).
 *
 * A plain `QuestionIndexEntry[]` repeats `level`/`skill`/`difficulty` keys and empty tag arrays for
 * every question (~830 KB for a phase-4 learner). Packed, questions are grouped under a
 * "level|skill|difficulty" key and each entry is the bare id, or `[id, ...contentIds]` when the
 * question is tagged with lesson content (~200 KB). `unpackQuestionIndex` restores entries that
 * `pickQuestions`/`questionContentIds` understand (they read `contentIds` when present).
 */
import type { PackedQuestionIndex, Question, QuestionIndexEntry } from "@/lib/content/schemas";
import { questionContentIds } from "@/lib/engine/scoring";

export function packQuestionIndex(entries: QuestionIndexEntry[]): PackedQuestionIndex {
  const out: PackedQuestionIndex = {};
  for (const q of entries) {
    const key = `${q.level}|${q.skill}|${q.difficulty}`;
    const ids = questionContentIds(q);
    (out[key] ??= []).push(ids.length ? [q.id, ...ids] : q.id);
  }
  return out;
}

export function unpackQuestionIndex(packed: PackedQuestionIndex): QuestionIndexEntry[] {
  const out: QuestionIndexEntry[] = [];
  for (const [key, list] of Object.entries(packed)) {
    const [level, skill, diff] = key.split("|") as [Question["level"], Question["skill"], string];
    const difficulty = Number(diff);
    for (const item of list) {
      if (typeof item === "string") out.push({ id: item, level, skill, difficulty, contentIds: [] });
      else out.push({ id: item[0], level, skill, difficulty, contentIds: item.slice(1) });
    }
  }
  return out;
}
