import "server-only";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import type { Level } from "@/lib/content/schemas";
import { USER_SUBCOLLECTIONS } from "./collections";

/**
 * Account-wide data operations: export, reset and delete.
 *
 * These run with the Admin SDK on purpose. firestore.rules deliberately makes study history
 * append-only for the client (quizResults, examResults and studySessions cannot be deleted,
 * and users/{uid} cannot be deleted at all), so a learner cannot clear their own history from
 * the browser even though it is their data. The server is the only place that can honour the
 * "reset" and "delete my account" promises the privacy policy makes.
 */

/** Study counters on users/{uid} that a full reset returns to their day-one values. */
const RESET_FIELDS = {
  currentDay: 1,
  currentPhase: 1,
  streak: 0,
  longestStreak: 0,
  lastStudyDate: null,
  totalStudyMinutes: 0,
  totalLessonsCompleted: 0,
  skillAccuracy: {},
} as const;

const userDoc = (uid: string) => adminDb().collection("users").doc(uid);

/**
 * Everything stored about one account, as a plain object suitable for download.
 * Read-only: nothing here mutates.
 */
export async function exportUserData(uid: string): Promise<Record<string, unknown>> {
  const snap = await userDoc(uid).get();
  const out: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    account: snap.exists ? snap.data() : null,
  };
  for (const name of USER_SUBCOLLECTIONS) {
    const docs = await userDoc(uid).collection(name).get();
    out[name] = docs.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  return out;
}

export type ResetScope = { kind: "all" } | { kind: "level"; level: Level | "foundation" };

export type ResetSummary = { deleted: Record<string, number>; countersReset: boolean };

/**
 * Clear study data while keeping the account, its settings and its sign-in.
 *
 * `all` removes every subcollection document and returns the study counters to day one, so the
 * learner starts genuinely fresh. `level` removes only the progress and review items for that
 * level and leaves lifetime totals alone, because those totals describe study that did happen;
 * the caller tells the learner which of the two they are getting.
 */
export async function resetStudyData(uid: string, scope: ResetScope): Promise<ResetSummary> {
  const db = adminDb();
  const deleted: Record<string, number> = {};

  if (scope.kind === "all") {
    for (const name of USER_SUBCOLLECTIONS) {
      const ref = userDoc(uid).collection(name);
      deleted[name] = (await ref.count().get()).data().count;
      await db.recursiveDelete(ref);
    }
    await userDoc(uid).set(RESET_FIELDS, { merge: true });
    return { deleted, countersReset: true };
  }

  // Level-scoped: progress rows carry `level`; review items are keyed by the same content ids.
  const progressSnap = await userDoc(uid).collection("progress").where("level", "==", scope.level).get();
  const contentIds = progressSnap.docs.map((d) => d.id);
  // Only count review items that exist: deleting a missing document succeeds silently, so
  // counting the attempts would overstate what the learner actually lost.
  const reviewRefs = contentIds.map((id) => userDoc(uid).collection("reviewItems").doc(id));
  const existingReviews = reviewRefs.length ? (await db.getAll(...reviewRefs)).filter((d) => d.exists) : [];
  const writer = db.bulkWriter();
  for (const d of progressSnap.docs) writer.delete(d.ref);
  for (const d of existingReviews) writer.delete(d.ref);
  await writer.close();
  deleted.progress = progressSnap.size;
  deleted.reviewItems = existingReviews.length;
  return { deleted, countersReset: false };
}

/**
 * Delete the account: all Firestore data, then the Firebase Auth user.
 *
 * Firestore first. If the auth deletion fails the learner still has a sign-in and can retry;
 * the reverse order would leave orphaned data no one can reach or remove.
 */
export async function deleteAccount(uid: string): Promise<{ deleted: Record<string, number> }> {
  const db = adminDb();
  const deleted: Record<string, number> = {};
  for (const name of USER_SUBCOLLECTIONS) {
    const ref = userDoc(uid).collection(name);
    deleted[name] = (await ref.count().get()).data().count;
  }
  await db.recursiveDelete(userDoc(uid));
  await adminAuth().deleteUser(uid);
  return { deleted };
}
