/**
 * "Mark as learned" on a lesson page must count, not just schedule a review.
 *
 * The button used to write the progress document and stop. The SRS review was scheduled, but
 * nothing reached the user's totals, the day's log or the streak, so a learner could mark every
 * lesson in a level and the dashboard would still read 0 lessons, 0 minutes. Found by marking one
 * lesson and reading the database back.
 *
 * The repo is replaced with an in-memory one; the SRS, streak and daily-log logic is real.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyProgressDoc, ProgressDoc, StudySessionDoc, UserDoc } from "@/lib/firestore/types";

const db = {
  user: null as UserDoc | null,
  progress: new Map<string, ProgressDoc>(),
  daily: new Map<string, DailyProgressDoc>(),
  sessions: [] as StudySessionDoc[],
};

vi.mock("@/lib/firestore/repo", () => ({
  getUser: async () => db.user,
  updateUser: async (_uid: string, patch: Partial<UserDoc>) => {
    db.user = { ...(db.user as UserDoc), ...patch };
  },
  getProgress: async (_uid: string, id: string) => db.progress.get(id) ?? null,
  setProgressBatch: async (_uid: string, items: ProgressDoc[]) => {
    for (const p of items) db.progress.set(p.contentId, p);
  },
  getDaily: async (_uid: string, date: string) => db.daily.get(date) ?? null,
  setDaily: async (_uid: string, doc: DailyProgressDoc) => {
    db.daily.set(doc.date, doc);
  },
  addSession: async (_uid: string, s: StudySessionDoc) => {
    db.sessions.push(s);
  },
  // Unused by completeLesson; present so the module's imports resolve.
  addExamResult: async () => {},
  addQuizResult: async () => {},
  listReviewItems: async () => [],
  removeReviewItems: async () => {},
  setReviewItems: async () => {},
}));

import { completeLesson } from "@/lib/study/service";
import { todayISO } from "@/lib/firestore/types";

const freshUser = (): UserDoc =>
  ({
    uid: "u1",
    currentDay: 1,
    currentPhase: 1,
    currentLevel: "n5",
    streak: 0,
    longestStreak: 0,
    totalStudyMinutes: 0,
    totalLessonsCompleted: 0,
    skillAccuracy: {},
  }) as unknown as UserDoc;

beforeEach(() => {
  db.user = freshUser();
  db.progress.clear();
  db.daily.clear();
  db.sessions.length = 0;
});

describe("completeLesson", () => {
  it("records the lesson in totals, streak, session and daily log — not only in progress", async () => {
    const r = await completeLesson("u1", "foundation-1", "kana", "foundation");

    expect(r.alreadyDone).toBe(false);
    expect(r.minutes).toBeGreaterThan(0);

    // The half that always worked.
    const p = db.progress.get("foundation-1");
    expect(p?.completed).toBe(true);
    expect(p?.nextReview && p.nextReview > todayISO()).toBe(true);

    // The half that did not.
    expect(db.user?.totalLessonsCompleted).toBe(1);
    expect(db.user?.totalStudyMinutes).toBe(r.minutes);
    expect(db.user?.streak).toBe(1);
    expect(db.user?.lastStudyDate).toBe(todayISO());
    expect(db.sessions).toHaveLength(1);
    expect(db.sessions[0].contentIds).toEqual(["foundation-1"]);
    expect(db.daily.get(todayISO())?.minutes).toBe(r.minutes);
  });

  it("is idempotent: marking the same lesson again logs nothing more", async () => {
    await completeLesson("u1", "foundation-1", "kana", "foundation");
    const again = await completeLesson("u1", "foundation-1", "kana", "foundation");

    expect(again.alreadyDone).toBe(true);
    expect(again.minutes).toBe(0);
    expect(db.user?.totalLessonsCompleted).toBe(1);
    expect(db.sessions).toHaveLength(1);
  });

  it("ticks today's planned task, with the plan's minutes, once all its content is learned", async () => {
    db.daily.set(todayISO(), {
      date: todayISO(),
      curriculumDay: 1,
      plannedTasks: [{ id: "d1-0-kana", type: "kana", minutes: 40, contentIds: ["foundation-1", "foundation-2"] }],
      completedTaskIds: [],
      minutes: 0,
      accuracyBySkill: {},
      completed: false,
    });

    const first = await completeLesson("u1", "foundation-1", "kana", "foundation");
    // One of two lessons done: the task is not complete, so a flat estimate is credited.
    expect(first.taskId).toBeUndefined();
    expect(db.daily.get(todayISO())?.completedTaskIds).toEqual([]);

    const second = await completeLesson("u1", "foundation-2", "kana", "foundation");
    expect(second.taskId).toBe("d1-0-kana");
    expect(second.minutes).toBe(40);
    const day = db.daily.get(todayISO());
    expect(day?.completedTaskIds).toEqual(["d1-0-kana"]);
    expect(day?.completed).toBe(true);
    expect(db.user?.totalLessonsCompleted).toBe(2);
  });

  it("still saves progress when there is no user document to update", async () => {
    db.user = null;
    const r = await completeLesson("u1", "n5-grammar-1", "grammar", "n5");
    expect(r.minutes).toBe(0);
    expect(db.progress.get("n5-grammar-1")?.completed).toBe(true);
    expect(db.sessions).toHaveLength(0);
  });
});
