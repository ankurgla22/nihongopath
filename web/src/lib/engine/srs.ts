/**
 * Spaced-repetition engine (SM-2 variant).
 *
 * Status ladder: new → learning → review → strong → mastered.
 * A wrong answer drops the item back to "learning" with a 1-day interval so it
 * returns to the review queue tomorrow. Pure module — no firebase imports.
 */
import type { ProgressDoc, ProgressStatus, ReviewItemDoc, Skill } from "@/lib/firestore/types";

export const EASE_MIN = 1.3;
export const EASE_MAX = 3.0;
export const EASE_DEFAULT = 2.5;
/** Interval (days) at or above which a streak of correct answers marks an item mastered. */
export const MASTERED_INTERVAL_DAYS = 30;
/** Correct answers in a row (since the last miss) required for mastery. */
export const MASTERED_STREAK = 3;

/** Add `n` days to a YYYY-MM-DD string (UTC arithmetic, no DST surprises). */
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d) + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Whole days from `a` to `b` (positive when b is later). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

export function clampEase(e: number): number {
  if (!Number.isFinite(e)) return EASE_DEFAULT;
  return Math.min(EASE_MAX, Math.max(EASE_MIN, e));
}

/** A fresh, never-reviewed progress record for a content item. */
export function initialProgress(contentId: string, type: Skill, level: ProgressDoc["level"], today: string): ProgressDoc {
  return {
    contentId,
    type,
    level,
    status: "new",
    firstLearned: today,
    lastReviewed: today,
    attempts: 0,
    correct: 0,
    incorrect: 0,
    ease: EASE_DEFAULT,
    intervalDays: 0,
    nextReview: today,
    completed: false,
  };
}

/**
 * Derive the status from the interval and history. Kept as a pure function so
 * UI and persistence agree on the ladder regardless of how the doc was built.
 */
export function statusFor(p: Pick<ProgressDoc, "attempts" | "intervalDays" | "correct" | "incorrect" | "status">): ProgressStatus {
  if (p.attempts === 0) return "new";
  if (p.intervalDays <= 1) return "learning";
  if (p.intervalDays < 7) return "review";
  if (p.intervalDays < MASTERED_INTERVAL_DAYS) return "strong";
  // Mastery additionally requires the streak, which is tracked in status by applyAnswer.
  return p.status === "mastered" ? "mastered" : "strong";
}

/**
 * Number of consecutive correct answers cannot be recovered from counts alone,
 * so we approximate it: after a miss, `intervalDays` resets to 1, and each
 * subsequent correct answer grows the interval. We therefore infer the streak
 * from the interval ladder position (1 → 3 → 7 → 14 → ...).
 */
function nextInterval(prev: number, ease: number, status: ProgressStatus): number {
  if (status === "new" || status === "learning" || prev <= 1) return 3; // learning → review
  if (prev < 7) return 7; // review → strong
  // strong+: grow by ease, always at least +1 day
  return Math.max(prev + 1, Math.round(prev * ease));
}

/**
 * Apply one answer. Returns a new ProgressDoc (input is not mutated).
 *
 * - Wrong: ease −0.2 (clamped), interval 1 day, status "learning", due tomorrow.
 * - Right: ease +0.1 (clamped), interval climbs 3 → 7 → 14 → ... and the status
 *   follows learning → review → strong → mastered (interval ≥ 30 with a streak
 *   of at least MASTERED_STREAK correct answers since the last miss).
 */
export function applyAnswer(p: ProgressDoc, correct: boolean, today: string): ProgressDoc {
  const attempts = p.attempts + 1;
  if (!correct) {
    return {
      ...p,
      attempts,
      incorrect: p.incorrect + 1,
      ease: clampEase(p.ease - 0.2),
      intervalDays: 1,
      status: "learning",
      lastReviewed: today,
      nextReview: addDays(today, 1),
    };
  }

  const ease = clampEase(p.ease + 0.1);
  const intervalDays = nextInterval(p.intervalDays, ease, p.status);
  const streak = streakEstimate(p) + 1;
  let status: ProgressStatus;
  if (intervalDays >= MASTERED_INTERVAL_DAYS && streak >= MASTERED_STREAK) status = "mastered";
  else if (intervalDays >= 7) status = "strong";
  else status = "review";

  return {
    ...p,
    attempts,
    correct: p.correct + 1,
    ease,
    intervalDays,
    status,
    lastReviewed: today,
    nextReview: addDays(today, intervalDays),
  };
}

/**
 * Estimate the current run of correct answers from the interval ladder.
 * 0 or 1 day → 0 (fresh or just missed); 3 → 1; 7 → 2; 14+ → 3 and up.
 */
function streakEstimate(p: ProgressDoc): number {
  if (p.status === "new" || p.status === "learning" || p.intervalDays <= 1) return 0;
  if (p.intervalDays < 7) return 1;
  if (p.intervalDays < 14) return 2;
  return 3;
}

/** Overdue days (0 when due today, negative when not yet due). */
export function overdueDays(p: Pick<ProgressDoc, "nextReview">, today: string): number {
  return daysBetween(p.nextReview, today);
}

/** Priority score used by the review queue: more overdue and lower ease first. */
export function priorityFor(p: Pick<ProgressDoc, "nextReview" | "ease">, today: string): number {
  return Math.max(0, overdueDays(p, today)) * 10 + Math.round((EASE_MAX - p.ease) * 10);
}

/**
 * All items due on or before `today`, sorted so the most overdue come first and,
 * among equally overdue items, the hardest (lowest ease) first. Ties are broken
 * by contentId to keep the order stable.
 */
export function dueItems(all: ProgressDoc[], today: string): ProgressDoc[] {
  return all
    .filter((p) => p.nextReview <= today)
    .sort((a, b) => {
      const od = overdueDays(b, today) - overdueDays(a, today);
      if (od !== 0) return od;
      if (a.ease !== b.ease) return a.ease - b.ease;
      return a.contentId < b.contentId ? -1 : a.contentId > b.contentId ? 1 : 0;
    });
}

/** Build a queue document for a progress record. */
export function toReviewItem(
  p: ProgressDoc,
  source: ReviewItemDoc["source"],
  questionIds: string[],
  today: string = p.lastReviewed
): ReviewItemDoc {
  return {
    contentId: p.contentId,
    type: p.type,
    due: p.nextReview,
    priority: priorityFor(p, today),
    source,
    addedAt: today,
    questionIds: Array.from(new Set(questionIds)),
  };
}

export const STATUS_ORDER: ProgressStatus[] = ["new", "learning", "review", "strong", "mastered"];

/** Human-readable label and hint for a status, for the UI. */
export function describeStatus(status: ProgressStatus): { label: string; description: string } {
  switch (status) {
    case "new":
      return { label: "New", description: "Not studied yet." };
    case "learning":
      return { label: "Learning", description: "Recently learned or missed — comes back tomorrow." };
    case "review":
      return { label: "Review", description: "Answered correctly once; reviewed again in a few days." };
    case "strong":
      return { label: "Strong", description: "Consistently correct; reviewed every week or two." };
    case "mastered":
      return { label: "Mastered", description: "Long-term memory — only occasional checks." };
  }
}
