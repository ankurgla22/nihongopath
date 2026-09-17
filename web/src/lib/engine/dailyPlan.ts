/**
 * Daily plan engine: turns a curriculum day into today's task list, adapted to
 * the learner's rolling per-skill accuracy and the size of their review queue.
 * Deterministic and pure — no firebase imports.
 */
import type { CurriculumDay } from "@/lib/content/schemas";
import type { QuizResultDoc, Skill, UserDoc } from "@/lib/firestore/types";
import { SKILLS } from "@/lib/firestore/types";

export type TaskType = CurriculumDay["tasks"][number]["type"];

export type PlanTask = {
  id: string;
  type: TaskType;
  minutes: number;
  contentIds: string[];
  questionCount?: number;
  examId?: string;
  title: string;
  /** True when minutes were increased because the skill is weak. Boosted tasks are never trimmed. */
  boosted?: boolean;
};

export type DailyPlan = {
  tasks: PlanTask[];
  totalMinutes: number;
};

export type DailyPlanInput = {
  day: CurriculumDay;
  user: Pick<UserDoc, "skillAccuracy" | "settings">;
  dueReviewCount: number;
  /** Extra skills to boost regardless of accuracy (e.g. from a weak-area analysis). */
  weakSkills?: Skill[];
};

/** Accuracy below this marks a skill weak. */
export const WEAK_THRESHOLD = 0.6;
/** Accuracy above this marks a skill strong. */
export const STRONG_THRESHOLD = 0.9;
export const BOOST_MINUTES = 5;
export const TRIM_MINUTES = 5;
export const MIN_TASK_MINUTES = 5;
export const REVIEW_MINUTES_PER_10_DUE = 5;
export const REVIEW_MINUTES_CAP = 30;
export const TARGET_TOLERANCE = 0.2;

const TITLES: Record<TaskType, string> = {
  kana: "Kana",
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  kanji: "Kanji",
  reading: "Reading",
  listening: "Listening",
  review: "Review",
  quiz: "Mini Test",
  "weekly-test": "Weekly Test",
  "phase-test": "Phase Test",
  "mock-exam": "Mock Exam",
};

export function taskTitle(type: TaskType): string {
  return TITLES[type];
}

export function skillLabel(skill: Skill): string {
  return TITLES[skill];
}

const SKILL_SET = new Set<string>(SKILLS);
function isSkill(t: string): t is Skill {
  return SKILL_SET.has(t);
}

/** Review minutes for a queue size: 5 min per 10 due (rounded up), between 5 and 30. */
export function reviewMinutesFor(dueReviewCount: number): number {
  const due = Math.max(0, Math.floor(dueReviewCount));
  const raw = Math.ceil(due / 10) * REVIEW_MINUTES_PER_10_DUE;
  return Math.min(REVIEW_MINUTES_CAP, Math.max(MIN_TASK_MINUTES, raw));
}

/** Skills whose rolling accuracy is recorded and below WEAK_THRESHOLD, weakest first. */
export function weakSkills(user: Pick<UserDoc, "skillAccuracy">): Skill[] {
  const acc = user.skillAccuracy ?? {};
  return SKILLS.filter((s) => typeof acc[s] === "number" && (acc[s] as number) < WEAK_THRESHOLD).sort(
    (a, b) => (acc[a] as number) - (acc[b] as number)
  );
}

/** Skills whose rolling accuracy is recorded and above STRONG_THRESHOLD. */
export function strongSkills(user: Pick<UserDoc, "skillAccuracy">): Skill[] {
  const acc = user.skillAccuracy ?? {};
  return SKILLS.filter((s) => typeof acc[s] === "number" && (acc[s] as number) > STRONG_THRESHOLD);
}

function sumMinutes(tasks: PlanTask[]): number {
  return tasks.reduce((n, t) => n + t.minutes, 0);
}

/**
 * Proportionally trim non-boosted tasks (never below MIN_TASK_MINUTES) until
 * the total is at most `limit`. Boosted tasks are untouched. If every trimmable
 * task is already at the minimum the total may still exceed the limit.
 */
export function trimToLimit(tasks: PlanTask[], limit: number): PlanTask[] {
  const total = sumMinutes(tasks);
  let excess = total - limit;
  if (excess <= 0) return tasks;

  const trimmable = tasks.filter((t) => !t.boosted && t.minutes > MIN_TASK_MINUTES);
  const reducible = trimmable.reduce((n, t) => n + (t.minutes - MIN_TASK_MINUTES), 0);
  if (reducible === 0) return tasks;
  excess = Math.min(excess, reducible);

  const cuts = new Map<string, number>();
  let assigned = 0;
  for (const t of trimmable) {
    const cut = Math.floor((excess * (t.minutes - MIN_TASK_MINUTES)) / reducible);
    cuts.set(t.id, cut);
    assigned += cut;
  }
  // Distribute the rounding remainder one minute at a time to the largest tasks.
  const byHeadroom = [...trimmable].sort(
    (a, b) => b.minutes - (cuts.get(b.id) ?? 0) - (a.minutes - (cuts.get(a.id) ?? 0))
  );
  let i = 0;
  while (assigned < excess && byHeadroom.length) {
    const t = byHeadroom[i % byHeadroom.length];
    const cut = cuts.get(t.id) ?? 0;
    if (t.minutes - cut > MIN_TASK_MINUTES) {
      cuts.set(t.id, cut + 1);
      assigned += 1;
    }
    i += 1;
    if (i > excess * byHeadroom.length + byHeadroom.length) break; // safety
  }

  return tasks.map((t) => (cuts.has(t.id) ? { ...t, minutes: t.minutes - (cuts.get(t.id) ?? 0) } : t));
}

/**
 * Build today's plan.
 *
 * 1. Start from the curriculum day's tasks (ids `d{day}-{index}-{type}`).
 * 2. Boost: each skill with accuracy < 0.6 (or listed in `weakSkills`) gets
 *    +BOOST_MINUTES on its task and is marked `boosted`; a missing task for a
 *    weak skill is appended.
 * 3. Trim: each skill with accuracy > 0.9 loses TRIM_MINUTES on its task (min 5).
 * 4. Review task minutes scale with `dueReviewCount` (5 min per 10 due, 5..30);
 *    a review task is appended when the day has none but items are due.
 * 5. Total is capped at dailyMinutesTarget × 1.2 by proportionally trimming
 *    non-boosted tasks, never below 5 minutes. Lighter days are left as-is.
 */
export function buildDailyPlan(input: DailyPlanInput): DailyPlan {
  const { day, user, dueReviewCount } = input;
  const weak = new Set<Skill>([...weakSkills(user), ...(input.weakSkills ?? [])]);
  const strong = new Set<Skill>(strongSkills(user).filter((s) => !weak.has(s)));

  let tasks: PlanTask[] = day.tasks.map((t, index) => ({
    id: `d${day.day}-${index}-${t.type}`,
    type: t.type,
    minutes: Math.max(MIN_TASK_MINUTES, Math.round(t.minutes)),
    contentIds: [...(t.contentIds ?? [])],
    ...(t.questionCount !== undefined ? { questionCount: t.questionCount } : {}),
    ...(t.examId !== undefined ? { examId: t.examId } : {}),
    title: TITLES[t.type],
  }));

  // Boost weak skills.
  for (const skill of SKILLS) {
    if (!weak.has(skill)) continue;
    const existing = tasks.find((t) => t.type === skill);
    if (existing) {
      existing.minutes += BOOST_MINUTES;
      existing.boosted = true;
      existing.title = `${TITLES[skill]} (boosted)`;
    } else {
      tasks.push({
        id: `d${day.day}-${tasks.length}-${skill}`,
        type: skill,
        minutes: MIN_TASK_MINUTES + BOOST_MINUTES,
        contentIds: [],
        title: `${TITLES[skill]} (boosted)`,
        boosted: true,
      });
    }
  }

  // Trim strong skills.
  for (const t of tasks) {
    if (isSkill(t.type) && strong.has(t.type) && !t.boosted) {
      t.minutes = Math.max(MIN_TASK_MINUTES, t.minutes - TRIM_MINUTES);
    }
  }

  // Scale the review task with the queue size.
  const reviewMinutes = reviewMinutesFor(dueReviewCount);
  const review = tasks.find((t) => t.type === "review");
  if (review) {
    review.minutes = reviewMinutes;
  } else if (dueReviewCount > 0) {
    tasks.push({
      id: `d${day.day}-${tasks.length}-review`,
      type: "review",
      minutes: reviewMinutes,
      contentIds: [],
      title: TITLES.review,
    });
  }

  // Keep within target × (1 + tolerance).
  const target = Math.max(0, user.settings?.dailyMinutesTarget ?? 0);
  if (target > 0) {
    const limit = Math.floor(target * (1 + TARGET_TOLERANCE));
    tasks = trimToLimit(tasks, limit);
  }

  return { tasks, totalMinutes: sumMinutes(tasks) };
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/**
 * Human-readable explanations of today's adaptations, e.g.
 * "Grammar accuracy is 54% — 5 extra minutes of grammar review added today".
 */
export function recommendations(
  user: Pick<UserDoc, "skillAccuracy">,
  recentResults: QuizResultDoc[] = []
): string[] {
  const acc = user.skillAccuracy ?? {};
  const out: string[] = [];

  for (const s of weakSkills(user)) {
    const label = skillLabel(s);
    const a = pct(acc[s] as number);
    if (s === "reading") out.push(`Reading accuracy is ${a} — ${BOOST_MINUTES} extra minutes of reading practice added today; try one more passage.`);
    else if (s === "listening") out.push(`Listening accuracy is ${a} — ${BOOST_MINUTES} extra minutes of listening practice added today; replay scripts you missed.`);
    else out.push(`${label} accuracy is ${a} — ${BOOST_MINUTES} extra minutes of ${label.toLowerCase()} review added today.`);
  }

  for (const s of strongSkills(user)) {
    const label = skillLabel(s);
    out.push(`${label} accuracy is ${pct(acc[s] as number)} — basic ${label.toLowerCase()} review shortened by ${TRIM_MINUTES} minutes.`);
  }

  const recent = [...recentResults].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  const latest = recent[0];
  if (latest) {
    const missed = new Set(latest.weakContentIds ?? []).size;
    if (missed > 0) {
      out.push(
        `Your last ${latest.kind === "lesson" ? "lesson quiz" : latest.kind === "practice" ? "practice set" : `${latest.kind} test`} had ${missed} item${missed === 1 ? "" : "s"} to revisit — they are in today's review.`
      );
    } else if (latest.total > 0) {
      out.push(`Perfect score on your last ${latest.kind === "lesson" ? "lesson quiz" : "test"} — keep the streak going.`);
    }
  }

  if (out.length === 0) {
    out.push(
      Object.keys(acc).length === 0
        ? "Complete today's mini test to unlock adaptive recommendations."
        : "All skills are on track — follow today's plan in order."
    );
  }
  return out;
}
