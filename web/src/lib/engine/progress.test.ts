import { describe, expect, it } from "vitest";
import type { DailyProgressDoc, ProgressDoc, Skill } from "@/lib/firestore/types";
import { initialProgress } from "./srs";
import {
  applySkillBreakdown,
  curriculumDayFor,
  phaseForDay,
  rollingAccuracy,
  summarizeProgress,
  updateStreak,
  weekStartOf,
  weeklySeries,
} from "./progress";

const T = "2026-09-17"; // Thursday

function p(id: string, type: Skill, over: Partial<ProgressDoc> = {}): ProgressDoc {
  return { ...initialProgress(id, type, "n2", T), ...over };
}

const totals: Record<Skill, number> = { kana: 0, grammar: 10, vocabulary: 20, kanji: 4, reading: 0, listening: 5 };

describe("summarizeProgress", () => {
  it("returns zeros for no progress", () => {
    const s = summarizeProgress([], totals);
    expect(s.bySkill.grammar).toEqual({ learned: 0, mastered: 0, total: 10, percent: 0 });
    expect(s.bySkill.reading).toEqual({ learned: 0, mastered: 0, total: 0, percent: 0 });
    expect(s.overallPercent).toBe(0);
  });

  it("counts learned (attempted/completed/non-new) and mastered per skill", () => {
    const all = [
      p("g1", "grammar", { attempts: 2, status: "review" }),
      p("g2", "grammar", { completed: true }),
      p("g3", "grammar"), // untouched → not learned
      p("g4", "grammar", { status: "mastered", attempts: 9, intervalDays: 40 }),
      p("v1", "vocabulary", { attempts: 1, status: "learning" }),
      p("k1", "kanji", { status: "mastered", attempts: 5 }),
      p("k1", "kanji", { status: "mastered", attempts: 5 }), // duplicate ignored
    ];
    const s = summarizeProgress(all, totals);
    expect(s.bySkill.grammar).toEqual({ learned: 3, mastered: 1, total: 10, percent: 30 });
    expect(s.bySkill.vocabulary).toEqual({ learned: 1, mastered: 0, total: 20, percent: 5 });
    expect(s.bySkill.kanji).toEqual({ learned: 1, mastered: 1, total: 4, percent: 25 });
    expect(s.bySkill.listening.learned).toBe(0);
    // (3 + 1 + 1) / (10 + 20 + 4 + 0 + 5) = 5/39 ≈ 12.8 → 13
    expect(s.overallPercent).toBe(13);
  });

  it("caps learned at the catalog total so percent never exceeds 100", () => {
    const all = Array.from({ length: 6 }, (_, i) => p(`k${i}`, "kanji", { attempts: 1 }));
    const s = summarizeProgress(all, totals);
    expect(s.bySkill.kanji).toEqual({ learned: 4, mastered: 0, total: 4, percent: 100 });
  });
});

describe("weekStartOf", () => {
  it("returns the Monday of the week", () => {
    expect(weekStartOf("2026-09-17")).toBe("2026-09-14"); // Thu → Mon
    expect(weekStartOf("2026-09-14")).toBe("2026-09-14"); // Mon
    expect(weekStartOf("2026-09-13")).toBe("2026-09-07"); // Sun → previous Mon
  });
});

describe("weeklySeries", () => {
  const dp = (date: string, minutes: number, correct = 0, total = 0): DailyProgressDoc => ({
    date,
    curriculumDay: 1,
    plannedTasks: [],
    completedTaskIds: [],
    minutes,
    accuracyBySkill: total ? { grammar: { correct, total } } : {},
    completed: minutes > 0,
  });

  it("returns [] for no data and for weeks <= 0", () => {
    expect(weeklySeries([])).toEqual([]);
    expect(weeklySeries([dp(T, 10)], 0)).toEqual([]);
  });

  it("buckets by week, labels from the first study week, fills empty weeks", () => {
    const daily = [
      dp("2026-09-01", 30, 8, 10), // week of Aug 31 → Week 1
      dp("2026-09-02", 20, 2, 10),
      dp("2026-09-09", 40, 5, 5), // week of Sep 7 → Week 2
      dp("2026-09-16", 25), // week of Sep 14 → Week 3
    ];
    const s = weeklySeries(daily, 4);
    // Weeks before the first study week are not emitted, so the series starts at "Week 1".
    expect(s.map((w) => w.weekLabel)).toEqual(["Week 1", "Week 2", "Week 3"]);
    expect(s.map((w) => w.weekStart)).toEqual(["2026-08-31", "2026-09-07", "2026-09-14"]);
    expect(s[0]).toMatchObject({ minutes: 50, correct: 10, total: 20, accuracy: 0.5, activeDays: 2 });
    expect(s[1]).toMatchObject({ minutes: 40, accuracy: 1 });
    expect(s[2]).toMatchObject({ minutes: 25, accuracy: 0, total: 0 });
  });

  it("never repeats a week number: a first-day learner gets a single Week 1 column", () => {
    const s = weeklySeries([dp(T, 15)], 8);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ weekLabel: "Week 1", weekStart: "2026-09-14", minutes: 15 });
    const labels = weeklySeries([dp("2026-09-02", 10), dp("2026-09-16", 10)], 8).map((w) => w.weekLabel);
    expect(labels).toEqual(["Week 1", "Week 2", "Week 3"]);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("fills empty weeks after a gap and keeps the week count from the first study week", () => {
    const s = weeklySeries([dp("2026-07-01", 10), dp("2026-09-16", 25)], 3);
    expect(s.map((w) => w.weekLabel)).toEqual(["Week 10", "Week 11", "Week 12"]);
    expect(s.map((w) => w.minutes)).toEqual([0, 0, 25]);
  });

  it("limits to the last N weeks and honours an explicit end date", () => {
    const daily = [dp("2026-07-01", 10), dp("2026-09-16", 25)];
    expect(weeklySeries(daily, 2).map((w) => w.minutes)).toEqual([0, 25]);
    const s = weeklySeries(daily, 2, "2026-09-30");
    expect(s.map((w) => w.weekStart)).toEqual(["2026-09-21", "2026-09-28"]);
    expect(s.map((w) => w.minutes)).toEqual([0, 0]);
    expect(weeklySeries([], 3, T)).toHaveLength(3);
  });
});

describe("updateStreak", () => {
  it("starts at 1 with no history", () => {
    expect(updateStreak({ streak: 0, longestStreak: 0, lastStudyDate: null }, T)).toEqual({ streak: 1, longestStreak: 1, lastStudyDate: T });
  });
  it("increments on a consecutive day", () => {
    expect(updateStreak({ streak: 4, longestStreak: 4, lastStudyDate: "2026-09-16" }, T)).toEqual({ streak: 5, longestStreak: 5, lastStudyDate: T });
  });
  it("is unchanged on the same day", () => {
    expect(updateStreak({ streak: 4, longestStreak: 9, lastStudyDate: T }, T)).toEqual({ streak: 4, longestStreak: 9, lastStudyDate: T });
  });
  it("resets to 1 after a gap and keeps the longest", () => {
    expect(updateStreak({ streak: 4, longestStreak: 4, lastStudyDate: "2026-09-10" }, T)).toEqual({ streak: 1, longestStreak: 4, lastStudyDate: T });
  });
  it("handles a study date in the future defensively", () => {
    const r = updateStreak({ streak: 3, longestStreak: 3, lastStudyDate: "2026-09-20" }, T);
    expect(r.streak).toBe(1);
    expect(r.lastStudyDate).toBe("2026-09-20");
  });
});

describe("rollingAccuracy", () => {
  it("uses the session accuracy when there is no previous value", () => {
    expect(rollingAccuracy(undefined, 7, 10)).toBeCloseTo(0.7);
  });
  it("blends with the given weight", () => {
    expect(rollingAccuracy(0.5, 10, 10)).toBeCloseTo(0.65);
    expect(rollingAccuracy(0.5, 10, 10, 1)).toBeCloseTo(1);
    expect(rollingAccuracy(0.5, 0, 10, 0)).toBeCloseTo(0.5);
  });
  it("returns prev (or 0) when nothing was answered", () => {
    expect(rollingAccuracy(0.4, 0, 0)).toBe(0.4);
    expect(rollingAccuracy(undefined, 0, 0)).toBe(0);
  });
  it("applySkillBreakdown updates only skills with answers", () => {
    const next = applySkillBreakdown({ grammar: 0.5, kanji: 0.9 }, { grammar: { correct: 10, total: 10 }, vocabulary: { correct: 1, total: 2 }, reading: { correct: 0, total: 0 } });
    expect(next.grammar).toBeCloseTo(0.65);
    expect(next.vocabulary).toBeCloseTo(0.5);
    expect(next.kanji).toBe(0.9);
    expect(next.reading).toBeUndefined();
  });
});

describe("curriculumDayFor / phaseForDay", () => {
  const phases = [
    { id: 1, name: "P1", description: "", startDay: 1, endDay: 30 },
    { id: 2, name: "P2", description: "", startDay: 31, endDay: 60 },
  ];
  it("returns currentDay clamped to 1..180", () => {
    expect(curriculumDayFor({ currentDay: 43 }, T)).toBe(43);
    expect(curriculumDayFor({ currentDay: 0 })).toBe(1);
    expect(curriculumDayFor({ currentDay: 999 })).toBe(180);
    expect(curriculumDayFor({ currentDay: NaN })).toBe(1);
  });
  it("finds the phase containing the day", () => {
    expect(phaseForDay(1, phases)?.id).toBe(1);
    expect(phaseForDay(30, phases)?.id).toBe(1);
    expect(phaseForDay(31, phases)?.id).toBe(2);
    expect(phaseForDay(61, phases)).toBeUndefined();
    expect(phaseForDay(5, [])).toBeUndefined();
  });
});
