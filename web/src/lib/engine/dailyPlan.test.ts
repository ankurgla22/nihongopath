import { describe, expect, it } from "vitest";
import type { CurriculumDay } from "@/lib/content/schemas";
import type { QuizResultDoc, Skill, UserDoc } from "@/lib/firestore/types";
import {
  BOOST_MINUTES,
  MIN_TASK_MINUTES,
  buildDailyPlan,
  recommendations,
  reviewMinutesFor,
  strongSkills,
  trimToLimit,
  weakSkills,
} from "./dailyPlan";

const day43: CurriculumDay = {
  day: 43,
  phase: 2,
  title: "Day 43",
  objectives: [],
  tasks: [
    { type: "grammar", minutes: 25, contentIds: ["g1", "g2"] },
    { type: "vocabulary", minutes: 20, contentIds: ["v1"] },
    { type: "kanji", minutes: 15, contentIds: ["k1"] },
    { type: "reading", minutes: 20, contentIds: ["r1"] },
    { type: "listening", minutes: 20, contentIds: ["l1"] },
    { type: "review", minutes: 15, contentIds: [] },
    { type: "quiz", minutes: 10, contentIds: [], questionCount: 10 },
  ],
};

function user(skillAccuracy: Partial<Record<Skill, number>> = {}, target = 125): Pick<UserDoc, "skillAccuracy" | "settings"> {
  return { skillAccuracy, settings: { dailyMinutesTarget: target, showFurigana: true } };
}

describe("weakSkills / strongSkills", () => {
  it("classifies recorded accuracies only", () => {
    const u = user({ grammar: 0.54, vocabulary: 0.95, kanji: 0.6, reading: 0.3 });
    expect(weakSkills(u)).toEqual(["reading", "grammar"]); // weakest first
    expect(strongSkills(u)).toEqual(["vocabulary"]);
    expect(weakSkills(user())).toEqual([]);
    expect(weakSkills({ skillAccuracy: undefined as unknown as UserDoc["skillAccuracy"] })).toEqual([]);
  });
});

describe("reviewMinutesFor", () => {
  it("scales 5 min per 10 due, between 5 and 30", () => {
    expect(reviewMinutesFor(0)).toBe(5);
    expect(reviewMinutesFor(1)).toBe(5);
    expect(reviewMinutesFor(10)).toBe(5);
    expect(reviewMinutesFor(11)).toBe(10);
    expect(reviewMinutesFor(35)).toBe(20);
    expect(reviewMinutesFor(60)).toBe(30);
    expect(reviewMinutesFor(1000)).toBe(30);
    expect(reviewMinutesFor(-5)).toBe(5);
  });
});

describe("buildDailyPlan", () => {
  it("mirrors the curriculum day with stable ids and titles when the learner is average", () => {
    const plan = buildDailyPlan({ day: day43, user: user({ grammar: 0.75 }), dueReviewCount: 25 });
    expect(plan.tasks.map((t) => t.id)).toEqual([
      "d43-0-grammar",
      "d43-1-vocabulary",
      "d43-2-kanji",
      "d43-3-reading",
      "d43-4-listening",
      "d43-5-review",
      "d43-6-quiz",
    ]);
    expect(plan.tasks[0]).toMatchObject({ type: "grammar", minutes: 25, contentIds: ["g1", "g2"], title: "Grammar" });
    expect(plan.tasks[6]).toMatchObject({ type: "quiz", questionCount: 10, title: "Daily quiz" });
    expect(plan.tasks[6]).not.toHaveProperty("examId");
    expect(plan.tasks[5].minutes).toBe(15); // 25 due → 15
    expect(plan.totalMinutes).toBe(125);
    expect(plan.tasks.every((t) => !t.boosted)).toBe(true);
  });

  it("is deterministic and does not mutate the curriculum day", () => {
    const snapshot = JSON.stringify(day43);
    const a = buildDailyPlan({ day: day43, user: user({ grammar: 0.5 }), dueReviewCount: 3 });
    const b = buildDailyPlan({ day: day43, user: user({ grammar: 0.5 }), dueReviewCount: 3 });
    expect(a).toEqual(b);
    expect(JSON.stringify(day43)).toBe(snapshot);
  });

  it("boosts weak skills by 5 minutes and marks them", () => {
    const plan = buildDailyPlan({ day: day43, user: user({ grammar: 0.54, listening: 0.2 }, 500), dueReviewCount: 0 });
    const g = plan.tasks.find((t) => t.type === "grammar")!;
    const l = plan.tasks.find((t) => t.type === "listening")!;
    expect(g).toMatchObject({ minutes: 25 + BOOST_MINUTES, boosted: true, title: "Grammar (boosted)" });
    expect(l).toMatchObject({ minutes: 20 + BOOST_MINUTES, boosted: true });
    expect(plan.tasks.find((t) => t.type === "kanji")!.boosted).toBeUndefined();
  });

  it("boosts explicitly passed weakSkills and appends a task when the day lacks one", () => {
    const day: CurriculumDay = { ...day43, tasks: [{ type: "grammar", minutes: 20, contentIds: [] }] };
    const plan = buildDailyPlan({ day, user: user({}, 500), dueReviewCount: 0, weakSkills: ["reading"] });
    expect(plan.tasks.map((t) => t.id)).toEqual(["d43-0-grammar", "d43-1-reading"]);
    expect(plan.tasks[1]).toMatchObject({ type: "reading", boosted: true, minutes: MIN_TASK_MINUTES + BOOST_MINUTES, contentIds: [] });
  });

  it("trims strong skills by 5 minutes but never below 5", () => {
    const day: CurriculumDay = {
      ...day43,
      tasks: [
        { type: "vocabulary", minutes: 20, contentIds: [] },
        { type: "kanji", minutes: 7, contentIds: [] },
      ],
    };
    const plan = buildDailyPlan({ day, user: user({ vocabulary: 0.95, kanji: 0.99 }, 500), dueReviewCount: 0 });
    expect(plan.tasks[0].minutes).toBe(15);
    expect(plan.tasks[1].minutes).toBe(5);
  });

  it("weak beats strong when both lists name a skill", () => {
    const plan = buildDailyPlan({ day: day43, user: user({ grammar: 0.95 }, 500), dueReviewCount: 0, weakSkills: ["grammar"] });
    expect(plan.tasks[0]).toMatchObject({ minutes: 30, boosted: true });
  });

  it("scales the review task with due count and appends one when needed", () => {
    expect(buildDailyPlan({ day: day43, user: user({}, 500), dueReviewCount: 0 }).tasks.find((t) => t.type === "review")!.minutes).toBe(5);
    expect(buildDailyPlan({ day: day43, user: user({}, 500), dueReviewCount: 100 }).tasks.find((t) => t.type === "review")!.minutes).toBe(30);

    const noReview: CurriculumDay = { ...day43, tasks: day43.tasks.filter((t) => t.type !== "review") };
    const none = buildDailyPlan({ day: noReview, user: user({}, 500), dueReviewCount: 0 });
    expect(none.tasks.some((t) => t.type === "review")).toBe(false);
    const some = buildDailyPlan({ day: noReview, user: user({}, 500), dueReviewCount: 12 });
    const r = some.tasks.find((t) => t.type === "review")!;
    expect(r).toMatchObject({ id: "d43-6-review", minutes: 10, title: "Review" });
  });

  it("never exceeds target × 1.2 when trimming is possible, and never trims boosted tasks", () => {
    for (const target of [80, 90, 100, 110, 125]) {
      for (const due of [0, 15, 40, 100]) {
        const plan = buildDailyPlan({ day: day43, user: user({ grammar: 0.4, reading: 0.5 }, target), dueReviewCount: due });
        expect(plan.totalMinutes).toBeLessThanOrEqual(Math.floor(target * 1.2));
        expect(plan.totalMinutes).toBe(plan.tasks.reduce((n, t) => n + t.minutes, 0));
        for (const t of plan.tasks) {
          expect(t.minutes).toBeGreaterThanOrEqual(MIN_TASK_MINUTES);
          expect(Number.isInteger(t.minutes)).toBe(true);
        }
        expect(plan.tasks.find((t) => t.type === "grammar")!.minutes).toBe(30);
        expect(plan.tasks.find((t) => t.type === "reading")!.minutes).toBe(25);
      }
    }
  });

  it("bottoms out at boosted + 5-minute tasks when the target is unreachable", () => {
    // limit 72, but boosted grammar (30) + reading (25) + five tasks at the 5-minute floor = 80
    const plan = buildDailyPlan({ day: day43, user: user({ grammar: 0.4, reading: 0.5 }, 60), dueReviewCount: 0 });
    expect(plan.totalMinutes).toBe(80);
    for (const t of plan.tasks) expect(t.boosted ? t.minutes : 5).toBe(t.minutes);
  });

  it("trims proportionally (larger tasks lose more)", () => {
    const plan = buildDailyPlan({ day: day43, user: user({}, 80), dueReviewCount: 25 });
    expect(plan.totalMinutes).toBe(96);
    const by = Object.fromEntries(plan.tasks.map((t) => [t.type, t.minutes]));
    expect(by.grammar).toBeGreaterThan(by.vocabulary);
    expect(by.vocabulary).toBeGreaterThanOrEqual(by.kanji);
    expect(by.quiz).toBeGreaterThanOrEqual(5);
  });

  it("leaves light days alone and ignores a zero target", () => {
    const light: CurriculumDay = { ...day43, tasks: [{ type: "grammar", minutes: 20, contentIds: [] }] };
    expect(buildDailyPlan({ day: light, user: user({}, 125), dueReviewCount: 0 }).totalMinutes).toBe(20);
    expect(buildDailyPlan({ day: day43, user: user({}, 0), dueReviewCount: 25 }).totalMinutes).toBe(125);
  });

  it("returns an empty plan for a day with no tasks and nothing due", () => {
    const empty: CurriculumDay = { ...day43, tasks: [] };
    expect(buildDailyPlan({ day: empty, user: user(), dueReviewCount: 0 })).toEqual({ tasks: [], totalMinutes: 0 });
  });
});

describe("trimToLimit", () => {
  it("returns the same tasks when already under the limit or nothing is trimmable", () => {
    const tasks = [{ id: "a", type: "grammar" as const, minutes: 5, contentIds: [], title: "G" }];
    expect(trimToLimit(tasks, 100)).toBe(tasks);
    expect(trimToLimit(tasks, 1)).toBe(tasks);
  });
  it("hits the limit exactly when there is enough headroom", () => {
    const tasks = [
      { id: "a", type: "grammar" as const, minutes: 30, contentIds: [], title: "G" },
      { id: "b", type: "kanji" as const, minutes: 20, contentIds: [], title: "K" },
      { id: "c", type: "reading" as const, minutes: 10, contentIds: [], title: "R", boosted: true },
    ];
    const out = trimToLimit(tasks, 33);
    expect(out.reduce((n, t) => n + t.minutes, 0)).toBe(33);
    expect(out[2].minutes).toBe(10);
    expect(out[0].minutes).toBeGreaterThan(out[1].minutes);
  });
});

describe("recommendations", () => {
  const result = (over: Partial<QuizResultDoc>): QuizResultDoc => ({
    id: "r",
    kind: "daily",
    title: "Daily",
    createdAt: "2026-09-17T10:00:00Z",
    date: "2026-09-17",
    questionIds: [],
    answers: [],
    score: 8,
    total: 10,
    accuracy: 0.8,
    seconds: 100,
    weakContentIds: [],
    skillBreakdown: {},
    ...over,
  });

  it("explains boosts with the accuracy percentage", () => {
    const out = recommendations(user({ grammar: 0.54 }));
    expect(out).toEqual([`Grammar accuracy is 54% — ${BOOST_MINUTES} extra minutes of grammar review added today.`]);
  });

  it("mentions reading/listening practice, strong-skill trims and recent misses", () => {
    const out = recommendations(user({ reading: 0.4, listening: 0.5, vocabulary: 0.93 }), [
      result({ createdAt: "2026-09-10T00:00:00Z", weakContentIds: ["old"] }),
      result({ createdAt: "2026-09-17T00:00:00Z", weakContentIds: ["g1", "g1", "v2"] }),
    ]);
    expect(out.some((s) => s.startsWith("Reading accuracy is 40%"))).toBe(true);
    expect(out.some((s) => s.startsWith("Listening accuracy is 50%"))).toBe(true);
    expect(out.some((s) => s.startsWith("Vocabulary accuracy is 93%") && s.includes("shortened"))).toBe(true);
    expect(out).toContain("Your last daily test had 2 items to revisit — they are in today's review.");
  });

  it("falls back to a single sentence when there is nothing to adapt", () => {
    expect(recommendations(user())).toEqual(["Complete today's daily quiz to unlock adaptive recommendations."]);
    expect(recommendations(user({ grammar: 0.8 }))).toEqual(["All skills are on track — follow today's plan in order."]);
    expect(recommendations(user({ grammar: 0.8 }), [result({ kind: "lesson" })])).toEqual(["Perfect score on your last lesson quiz — keep the streak going."]);
  });
});
