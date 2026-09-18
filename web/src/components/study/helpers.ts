/**
 * Small client-safe helpers shared by the dashboard, daily study, review and tests pages.
 * Pure functions only — no firebase imports.
 */
import type { Level, QuestionIndexEntry, QuestionLevel } from "@/lib/content/schemas";
import type { QuizKind, Skill } from "@/lib/firestore/types";
import { LEVELS } from "@/lib/content/levels";
import { pickQuestions, type PickOptions } from "@/lib/engine/scoring";
import type { TaskType } from "@/lib/engine/dailyPlan";

/** Matches any kana or kanji: used to decide whether a string can be read aloud in Japanese. */
export const JA_RE = /[぀-ヿ一-鿿]/;

export type ContentLink = { href: string; title: string; type?: string };
export type ContentLinks = Record<string, ContentLink>;

/** Serializable plan task as stored in dailyProgress.plannedTasks plus the fields the UI needs. */
export type ClientTask = {
  id: string;
  type: TaskType;
  title: string;
  minutes: number;
  contentIds: string[];
  questionCount?: number;
  examId?: string;
  boosted?: boolean;
};

/** Level studied during a curriculum phase. */
export function levelForPhase(phase: number): Level {
  if (phase <= 1) return "n5";
  if (phase === 2) return "n4";
  if (phase === 3) return "n3";
  return "n2";
}

/** All levels from n5 up to and including `level`. */
export function levelsUpTo(level: Level): Level[] {
  const i = LEVELS.indexOf(level);
  return LEVELS.slice(0, i + 1);
}

/** Question levels to draw from for `level`: the foundation (kana) bank first, then n5 up to and including `level`. */
export function questionLevelsUpTo(level: Level): QuestionLevel[] {
  return ["foundation", ...levelsUpTo(level)];
}

/** Type and level of a content id such as `n4-grammar-12`, `n5-kanji-一` or `foundation-3`. */
export function contentMeta(id: string): { type: Skill; level: Level | "foundation" } | null {
  if (/^foundation-/.test(id)) return { type: "kana", level: "foundation" };
  const m = /^(n5|n4|n3|n2|n1)-(grammar|vocab|kanji|reading|listening)-/.exec(id);
  if (!m) return null;
  const level = m[1] as Level;
  const type: Skill = m[2] === "vocab" ? "vocabulary" : (m[2] as Skill);
  return { type, level };
}

export const SKILL_TASKS: TaskType[] = ["kana", "grammar", "vocabulary", "kanji", "reading", "listening"];

export function isSkillTask(type: TaskType): type is Skill {
  return (SKILL_TASKS as string[]).includes(type);
}

export function isQuizTask(type: TaskType): boolean {
  return type === "quiz" || type === "weekly-test" || type === "phase-test" || type === "review";
}

export function quizKindForTask(type: TaskType): QuizKind {
  switch (type) {
    case "weekly-test":
      return "weekly";
    case "phase-test":
      return "phase";
    case "review":
      return "review";
    default:
      return "daily";
  }
}

export function defaultQuestionCount(type: TaskType): number {
  switch (type) {
    case "weekly-test":
      return 25;
    case "phase-test":
      return 40;
    default:
      return 10;
  }
}

/**
 * pickQuestions with graceful fallback: the question bank is unevenly distributed across
 * levels, so when a level/skill filter yields too few questions we widen the filter rather
 * than returning a near-empty quiz.
 */
export function pickWithFallback<T extends QuestionIndexEntry>(pool: T[], opts: PickOptions): T[] {
  let picked = pickQuestions(pool, opts);
  if (picked.length >= opts.count) return picked;
  const seen = new Set(picked.map((q) => q.id));
  const widen = (o: PickOptions) => {
    const more = pickQuestions(pool, { ...o, count: opts.count - picked.length, excludeIds: [...seen, ...(opts.excludeIds ?? [])] });
    for (const q of more) seen.add(q.id);
    picked = picked.concat(more);
  };
  if (opts.levels?.length) widen({ ...opts, levels: undefined });
  if (picked.length < opts.count && opts.skills?.length) widen({ ...opts, levels: undefined, skills: undefined });
  return picked;
}

/** Questions for a review session: the queue's own question ids first, then questions tagged with the due content ids. */
export function reviewQuestions<T extends QuestionIndexEntry>(pool: T[], items: { contentId: string; questionIds: string[] }[], count: number, seed: string): T[] {
  const byId = new Map(pool.map((q) => [q.id, q]));
  const out: T[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    for (const qid of it.questionIds) {
      const q = byId.get(qid);
      if (q && !seen.has(q.id)) {
        seen.add(q.id);
        out.push(q);
      }
      if (out.length >= count) return out;
    }
  }
  const more = pickQuestions(pool, { count: count - out.length, preferContentIds: items.map((i) => i.contentId), excludeIds: seen, seed });
  return out.concat(more);
}

/** True when the study service threw its "saved locally, will sync" error. */
export function isQueuedError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { queued?: boolean }).queued === true;
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${r}s`;
  return `${m}m ${r.toString().padStart(2, "0")}s`;
}

export function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function addDaysISO(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
}
