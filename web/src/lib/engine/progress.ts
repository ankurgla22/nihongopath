/**
 * Progress roll-ups: per-skill percentages, weekly time/accuracy series,
 * streak bookkeeping and rolling accuracy. Pure — no firebase imports.
 */
import type { Curriculum } from "@/lib/content/schemas";
import type { DailyProgressDoc, ProgressDoc, Skill, UserDoc } from "@/lib/firestore/types";
import { SKILLS } from "@/lib/firestore/types";
import { addDays, daysBetween } from "./srs";

export const CURRICULUM_DAYS = 180;

export type SkillSummary = { learned: number; mastered: number; total: number; percent: number };

export type ProgressSummary = {
  bySkill: Record<Skill, SkillSummary>;
  /** 0..100, learned items over the sum of `totals`. */
  overallPercent: number;
};

function percent(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((part / whole) * 100)));
}

/**
 * Roll the progress collection up per skill. An item is "learned" once it has
 * been attempted or its lesson was marked complete; "mastered" follows status.
 * `totals` is the number of content items per skill in the catalog.
 */
export function summarizeProgress(all: ProgressDoc[], totals: Record<Skill, number>): ProgressSummary {
  const bySkill = {} as Record<Skill, SkillSummary>;
  for (const s of SKILLS) bySkill[s] = { learned: 0, mastered: 0, total: Math.max(0, totals[s] ?? 0), percent: 0 };

  const seen = new Set<string>();
  for (const p of all) {
    if (seen.has(p.contentId) || !bySkill[p.type]) continue;
    seen.add(p.contentId);
    const learned = p.completed || p.attempts > 0 || p.status !== "new";
    if (learned) bySkill[p.type].learned += 1;
    if (p.status === "mastered") bySkill[p.type].mastered += 1;
  }

  let learnedSum = 0;
  let totalSum = 0;
  for (const s of SKILLS) {
    const b = bySkill[s];
    // Never report more learned than the catalog total.
    b.learned = b.total > 0 ? Math.min(b.learned, b.total) : b.learned;
    b.mastered = Math.min(b.mastered, b.learned);
    b.percent = percent(b.learned, b.total);
    learnedSum += b.total > 0 ? b.learned : 0;
    totalSum += b.total;
  }
  return { bySkill, overallPercent: percent(learnedSum, totalSum) };
}

export type WeekPoint = {
  weekLabel: string;
  /** Monday of the week, YYYY-MM-DD. */
  weekStart: string;
  minutes: number;
  /** 0..1 over all answers that week; 0 when nothing was answered. */
  accuracy: number;
  correct: number;
  total: number;
  /** Days with any study minutes. */
  activeDays: number;
};

/** Monday of the week containing `iso`. */
export function weekStartOf(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  const back = (dow + 6) % 7;
  return addDays(iso, -back);
}

/**
 * Weekly study series for the progress chart. Covers the last `weeks` weeks
 * ending with the week containing `endDate` (defaults to the latest record).
 * Weeks are labelled relative to the learner's first recorded day
 * ("Week 1" = the week of their first study day), so labels are stable as time
 * passes. Weeks before the first study week are never emitted (they would all
 * have to read "Week 1"); empty weeks after it are included with zero minutes.
 * With no records but an explicit `endDate`, `weeks` empty weeks are returned.
 */
export function weeklySeries(daily: DailyProgressDoc[], weeks = 8, endDate?: string): WeekPoint[] {
  if (weeks <= 0) return [];
  const dated = daily.filter((d) => typeof d.date === "string" && d.date.length === 10);
  if (dated.length === 0 && !endDate) return [];

  const dates = dated.map((d) => d.date).sort();
  const first = dates[0];
  const last = endDate ?? dates[dates.length - 1];
  const lastWeek = weekStartOf(last);
  const firstWeek = first ? weekStartOf(first) : addDays(lastWeek, -7 * (weeks - 1));
  const earliest = addDays(lastWeek, -7 * (weeks - 1));
  const startWeek = firstWeek > earliest ? firstWeek : earliest;
  const count = Math.max(1, Math.round(daysBetween(startWeek, lastWeek) / 7) + 1);

  const buckets = new Map<string, WeekPoint>();
  for (let i = 0; i < count; i++) {
    const ws = addDays(startWeek, 7 * i);
    const n = Math.round(daysBetween(firstWeek, ws) / 7) + 1;
    buckets.set(ws, { weekLabel: `Week ${Math.max(1, n)}`, weekStart: ws, minutes: 0, accuracy: 0, correct: 0, total: 0, activeDays: 0 });
  }

  for (const d of dated) {
    const b = buckets.get(weekStartOf(d.date));
    if (!b) continue;
    b.minutes += Math.max(0, d.minutes || 0);
    if ((d.minutes || 0) > 0) b.activeDays += 1;
    for (const s of SKILLS) {
      const a = d.accuracyBySkill?.[s];
      if (!a) continue;
      b.correct += a.correct;
      b.total += a.total;
    }
  }

  return Array.from(buckets.values()).map((b) => ({ ...b, accuracy: b.total > 0 ? b.correct / b.total : 0 }));
}

export type StreakState = { streak: number; longestStreak: number; lastStudyDate: string | null };

/**
 * Update the study streak for a study event on `today`:
 * consecutive day → +1, same day → unchanged, any gap (or first study) → 1.
 */
export function updateStreak(user: Pick<UserDoc, "streak" | "longestStreak" | "lastStudyDate">, today: string): StreakState {
  const last = user.lastStudyDate;
  let streak: number;
  if (!last) streak = 1;
  else {
    const gap = daysBetween(last, today);
    if (gap === 0) streak = Math.max(1, user.streak);
    else if (gap === 1) streak = Math.max(0, user.streak) + 1;
    else streak = 1; // gap > 1, or a date earlier than the last study date
  }
  return {
    streak,
    longestStreak: Math.max(user.longestStreak ?? 0, streak),
    lastStudyDate: last && last > today ? last : today,
  };
}

/**
 * Exponentially weighted rolling accuracy. With no previous value the new
 * session's accuracy is used as-is. Returns `prev` (or 0) when total is 0.
 */
export function rollingAccuracy(prev: number | undefined, correct: number, total: number, weight = 0.3): number {
  if (total <= 0) return prev ?? 0;
  const now = Math.max(0, Math.min(1, correct / total));
  if (prev === undefined || !Number.isFinite(prev)) return now;
  const w = Math.max(0, Math.min(1, weight));
  return prev * (1 - w) + now * w;
}

/** Update every skill's rolling accuracy from a quiz breakdown. */
export function applySkillBreakdown(
  prev: Partial<Record<Skill, number>>,
  breakdown: Partial<Record<Skill, { correct: number; total: number }>>,
  weight = 0.3
): Partial<Record<Skill, number>> {
  const next: Partial<Record<Skill, number>> = { ...prev };
  for (const s of SKILLS) {
    const b = breakdown[s];
    if (!b || b.total <= 0) continue;
    next[s] = rollingAccuracy(prev[s], b.correct, b.total, weight);
  }
  return next;
}

/**
 * The curriculum day the learner should study on `today`. The curriculum is
 * self-paced: it is the user's currentDay, clamped to 1..180. Today's date is
 * accepted so a calendar-paced policy can be swapped in without changing callers.
 */
export function curriculumDayFor(user: Pick<UserDoc, "currentDay">, today?: string): number {
  void today;
  const d = Math.floor(user.currentDay ?? 1);
  if (!Number.isFinite(d)) return 1;
  return Math.max(1, Math.min(CURRICULUM_DAYS, d));
}

export type Phase = Curriculum["phases"][number];

/** The phase containing `day`, or undefined when no phase covers it. */
export function phaseForDay<P extends Pick<Phase, "startDay" | "endDay">>(day: number, phases: P[]): P | undefined {
  return phases.find((p) => day >= p.startDay && day <= p.endDay);
}
