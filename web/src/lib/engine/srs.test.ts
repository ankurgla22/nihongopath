import { describe, expect, it } from "vitest";
import type { ProgressDoc } from "@/lib/firestore/types";
import {
  EASE_MAX,
  EASE_MIN,
  addDays,
  applyAnswer,
  daysBetween,
  describeStatus,
  dueItems,
  initialProgress,
  overdueDays,
  priorityFor,
  statusFor,
  toReviewItem,
} from "./srs";

const T = "2026-09-17";

describe("addDays / daysBetween", () => {
  it("adds and subtracts across month and year boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays(T, 0)).toBe(T);
  });
  it("computes whole-day differences", () => {
    expect(daysBetween("2026-09-10", T)).toBe(7);
    expect(daysBetween(T, "2026-09-10")).toBe(-7);
    expect(daysBetween(T, T)).toBe(0);
  });
});

describe("initialProgress", () => {
  it("creates a new, due-today record", () => {
    const p = initialProgress("g1", "grammar", "n2", T);
    expect(p).toEqual({
      contentId: "g1",
      type: "grammar",
      level: "n2",
      status: "new",
      firstLearned: T,
      lastReviewed: T,
      attempts: 0,
      correct: 0,
      incorrect: 0,
      ease: 2.5,
      intervalDays: 0,
      nextReview: T,
      completed: false,
    });
    expect(statusFor(p)).toBe("new");
  });
});

describe("applyAnswer", () => {
  it("does not mutate the input", () => {
    const p = initialProgress("g1", "grammar", "n2", T);
    const copy = { ...p };
    applyAnswer(p, true, T);
    applyAnswer(p, false, T);
    expect(p).toEqual(copy);
  });

  it("wrong answer → learning, 1 day, ease −0.2, due tomorrow", () => {
    const p = applyAnswer(initialProgress("g1", "grammar", "n2", T), false, T);
    expect(p.status).toBe("learning");
    expect(p.intervalDays).toBe(1);
    expect(p.attempts).toBe(1);
    expect(p.incorrect).toBe(1);
    expect(p.correct).toBe(0);
    expect(p.ease).toBeCloseTo(2.3);
    expect(p.nextReview).toBe(addDays(T, 1));
    expect(p.lastReviewed).toBe(T);
    expect(statusFor(p)).toBe("learning");
  });

  it("climbs new → review (3d) → strong (7d) → ... → mastered when interval ≥ 30 with a streak", () => {
    let p = initialProgress("g1", "grammar", "n2", T);
    let day = T;
    const trail: { status: string; interval: number }[] = [];
    for (let i = 0; i < 6; i++) {
      p = applyAnswer(p, true, day);
      trail.push({ status: p.status, interval: p.intervalDays });
      expect(p.nextReview).toBe(addDays(day, p.intervalDays));
      day = p.nextReview;
    }
    expect(trail[0]).toEqual({ status: "review", interval: 3 });
    expect(trail[1]).toEqual({ status: "strong", interval: 7 });
    expect(trail[2].interval).toBeGreaterThan(7);
    expect(trail[2].status).toBe("strong");
    const mastered = trail.find((t) => t.status === "mastered");
    expect(mastered).toBeDefined();
    expect(mastered!.interval).toBeGreaterThanOrEqual(30);
    expect(p.correct).toBe(6);
    expect(p.attempts).toBe(6);
    expect(statusFor(p)).toBe("mastered");
  });

  it("intervals always grow on a correct answer", () => {
    let p = initialProgress("v1", "vocabulary", "n3", T);
    p = { ...p, ease: EASE_MIN }; // slowest possible growth
    let prev = 0;
    for (let i = 0; i < 10; i++) {
      p = applyAnswer(p, true, T);
      expect(p.intervalDays).toBeGreaterThan(prev);
      prev = p.intervalDays;
    }
  });

  it("a miss after strong drops back to learning and mastery needs a fresh streak", () => {
    let p = initialProgress("g1", "grammar", "n2", T);
    for (let i = 0; i < 4; i++) p = applyAnswer(p, true, T);
    expect(["strong", "mastered"]).toContain(p.status);
    p = applyAnswer(p, false, T);
    expect(p.status).toBe("learning");
    expect(p.intervalDays).toBe(1);
    p = applyAnswer(p, true, T);
    expect(p.status).toBe("review");
    expect(p.intervalDays).toBe(3);
  });

  it("clamps ease to [1.3, 3.0]", () => {
    let p = initialProgress("g1", "grammar", "n2", T);
    for (let i = 0; i < 20; i++) p = applyAnswer(p, false, T);
    expect(p.ease).toBe(EASE_MIN);
    for (let i = 0; i < 20; i++) p = applyAnswer(p, true, T);
    expect(p.ease).toBe(EASE_MAX);
    // and a wrong answer at the max moves down again
    expect(applyAnswer(p, false, T).ease).toBeCloseTo(2.8);
  });
});

describe("statusFor", () => {
  const base = initialProgress("x", "kanji", "n2", T);
  it("follows the interval ladder", () => {
    expect(statusFor({ ...base, attempts: 1, intervalDays: 1 })).toBe("learning");
    expect(statusFor({ ...base, attempts: 1, intervalDays: 3 })).toBe("review");
    expect(statusFor({ ...base, attempts: 1, intervalDays: 7 })).toBe("strong");
    expect(statusFor({ ...base, attempts: 1, intervalDays: 29 })).toBe("strong");
    expect(statusFor({ ...base, attempts: 1, intervalDays: 40, status: "strong" })).toBe("strong");
    expect(statusFor({ ...base, attempts: 1, intervalDays: 40, status: "mastered" })).toBe("mastered");
  });
});

describe("dueItems", () => {
  const mk = (id: string, nextReview: string, ease = 2.5): ProgressDoc => ({
    ...initialProgress(id, "grammar", "n2", "2026-09-01"),
    nextReview,
    ease,
  });

  it("returns only items due on or before today, most overdue then lowest ease first", () => {
    const all = [
      mk("future", addDays(T, 1)),
      mk("today-easy", T, 2.8),
      mk("today-hard", T, 1.5),
      mk("week-late", addDays(T, -7)),
      mk("day-late", addDays(T, -1)),
    ];
    expect(dueItems(all, T).map((p) => p.contentId)).toEqual(["week-late", "day-late", "today-hard", "today-easy"]);
  });

  it("breaks full ties by contentId and handles empty input", () => {
    expect(dueItems([], T)).toEqual([]);
    expect(dueItems([mk("b", T), mk("a", T)], T).map((p) => p.contentId)).toEqual(["a", "b"]);
  });

  it("does not mutate the input array order", () => {
    const all = [mk("b", T), mk("a", T)];
    dueItems(all, T);
    expect(all.map((p) => p.contentId)).toEqual(["b", "a"]);
  });
});

describe("priority / review items", () => {
  it("ranks overdue and hard items higher", () => {
    const p = initialProgress("g1", "grammar", "n2", T);
    expect(overdueDays({ nextReview: addDays(T, -3) }, T)).toBe(3);
    expect(priorityFor({ ...p, nextReview: addDays(T, -3) }, T)).toBeGreaterThan(priorityFor(p, T));
    expect(priorityFor({ ...p, ease: 1.3 }, T)).toBeGreaterThan(priorityFor({ ...p, ease: 2.9 }, T));
    expect(priorityFor({ ...p, nextReview: addDays(T, 5) }, T)).toBeGreaterThanOrEqual(0);
  });

  it("toReviewItem copies the essentials and de-duplicates question ids", () => {
    const p = applyAnswer(initialProgress("g1", "grammar", "n2", T), false, T);
    const item = toReviewItem(p, "wrong-answer", ["q1", "q1", "q2"]);
    expect(item).toMatchObject({
      contentId: "g1",
      type: "grammar",
      due: addDays(T, 1),
      source: "wrong-answer",
      addedAt: T,
      questionIds: ["q1", "q2"],
    });
    expect(typeof item.priority).toBe("number");
    expect(toReviewItem(p, "srs", [], "2026-10-01").addedAt).toBe("2026-10-01");
  });
});

describe("describeStatus", () => {
  it("has a label and description for each status", () => {
    for (const s of ["new", "learning", "review", "strong", "mastered"] as const) {
      const d = describeStatus(s);
      expect(d.label.length).toBeGreaterThan(0);
      expect(d.description.length).toBeGreaterThan(0);
    }
    expect(describeStatus("mastered").label).toBe("Mastered");
  });
});
