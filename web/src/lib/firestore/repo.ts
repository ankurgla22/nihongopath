"use client";
/**
 * Client-side typed Firestore repository. Every function takes the authenticated uid
 * from the Firebase Auth user object; security rules enforce ownership server-side.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  deleteDoc,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/db";
import type {
  DailyProgressDoc,
  ExamResultDoc,
  ProgressDoc,
  QuizResultDoc,
  ReviewItemDoc,
  SavedItemDoc,
  StudySessionDoc,
  UserDoc,
} from "./types";

const userRef = (uid: string) => doc(getClientDb(), "users", uid);
const sub = (uid: string, name: string) => collection(getClientDb(), "users", uid, name);

export async function getUser(uid: string): Promise<UserDoc | null> {
  const snap = await getDoc(userRef(uid));
  return snap.exists() ? (snap.data() as UserDoc) : null;
}

export async function ensureUser(u: { uid: string; email: string | null; displayName: string | null; photoURL: string | null }): Promise<UserDoc> {
  const existing = await getUser(u.uid);
  if (existing) {
    // Refresh the provider-owned identity fields. Without this the stored copy is frozen at
    // signup, so a changed email address (or a new Google avatar) would never catch up and the
    // profile would keep showing the old one.
    const patch: Partial<UserDoc> = {};
    if (u.email !== existing.email) patch.email = u.email;
    if (u.photoURL !== existing.photoURL) patch.photoURL = u.photoURL;
    if (Object.keys(patch).length) {
      await updateUser(u.uid, patch);
      return { ...existing, ...patch };
    }
    return existing;
  }
  const docData: UserDoc = {
    uid: u.uid,
    email: u.email,
    displayName: u.displayName,
    photoURL: u.photoURL,
    createdAt: new Date().toISOString(),
    currentDay: 1,
    currentPhase: 1,
    currentLevel: "n5",
    streak: 0,
    longestStreak: 0,
    lastStudyDate: null,
    totalStudyMinutes: 0,
    totalLessonsCompleted: 0,
    skillAccuracy: {},
    settings: { dailyMinutesTarget: 125, showFurigana: true },
  };
  await setDoc(userRef(u.uid), docData);
  return docData;
}

export async function updateUser(uid: string, patch: Partial<UserDoc>) {
  await updateDoc(userRef(uid), patch as Record<string, unknown>);
}

// ---- progress ----
export async function getProgress(uid: string, contentId: string): Promise<ProgressDoc | null> {
  const snap = await getDoc(doc(sub(uid, "progress"), contentId));
  return snap.exists() ? (snap.data() as ProgressDoc) : null;
}
export async function getAllProgress(uid: string): Promise<ProgressDoc[]> {
  const snap = await getDocs(sub(uid, "progress"));
  return snap.docs.map((d) => d.data() as ProgressDoc);
}
/** Firestore allows at most 500 writes per batch; commit in chunks of 400. */
const BATCH_MAX = 400;

export async function setProgressBatch(uid: string, items: ProgressDoc[]) {
  for (let i = 0; i < items.length; i += BATCH_MAX) {
    const batch = writeBatch(getClientDb());
    for (const p of items.slice(i, i + BATCH_MAX)) batch.set(doc(sub(uid, "progress"), p.contentId), p, { merge: true });
    await batch.commit();
  }
}

// ---- daily ----
export async function getDaily(uid: string, date: string): Promise<DailyProgressDoc | null> {
  const snap = await getDoc(doc(sub(uid, "dailyProgress"), date));
  return snap.exists() ? (snap.data() as DailyProgressDoc) : null;
}
export async function setDaily(uid: string, d: DailyProgressDoc) {
  await setDoc(doc(sub(uid, "dailyProgress"), d.date), d, { merge: true });
}
export async function listDaily(uid: string, max = 60): Promise<DailyProgressDoc[]> {
  const q = query(sub(uid, "dailyProgress"), orderBy("date", "desc"), limit(max));
  return (await getDocs(q)).docs.map((d) => d.data() as DailyProgressDoc);
}

// ---- sessions ----
export async function addSession(uid: string, s: StudySessionDoc) {
  await setDoc(doc(sub(uid, "studySessions"), s.id), s);
}
export async function listSessions(uid: string, max = 200): Promise<StudySessionDoc[]> {
  const q = query(sub(uid, "studySessions"), orderBy("startedAt", "desc"), limit(max));
  return (await getDocs(q)).docs.map((d) => d.data() as StudySessionDoc);
}
export async function listSessionsForDate(uid: string, date: string): Promise<StudySessionDoc[]> {
  const q = query(sub(uid, "studySessions"), where("date", "==", date));
  return (await getDocs(q)).docs.map((d) => d.data() as StudySessionDoc);
}

// ---- quiz results ----
export async function addQuizResult(uid: string, r: QuizResultDoc) {
  await setDoc(doc(sub(uid, "quizResults"), r.id), r);
}
export async function getQuizResult(uid: string, id: string): Promise<QuizResultDoc | null> {
  const snap = await getDoc(doc(sub(uid, "quizResults"), id));
  return snap.exists() ? (snap.data() as QuizResultDoc) : null;
}
export async function listQuizResults(uid: string, max = 100): Promise<QuizResultDoc[]> {
  const q = query(sub(uid, "quizResults"), orderBy("createdAt", "desc"), limit(max));
  return (await getDocs(q)).docs.map((d) => d.data() as QuizResultDoc);
}
/** Quiz results taken on one local date (single-field equality; no composite index needed). */
export async function listQuizResultsForDate(uid: string, date: string): Promise<QuizResultDoc[]> {
  const q = query(sub(uid, "quizResults"), where("date", "==", date));
  return (await getDocs(q)).docs.map((d) => d.data() as QuizResultDoc).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// ---- exam results ----
export async function addExamResult(uid: string, r: ExamResultDoc) {
  await setDoc(doc(sub(uid, "examResults"), r.id), r);
}
export async function getExamResult(uid: string, id: string): Promise<ExamResultDoc | null> {
  const snap = await getDoc(doc(sub(uid, "examResults"), id));
  return snap.exists() ? (snap.data() as ExamResultDoc) : null;
}
export async function listExamResults(uid: string, max = 50): Promise<ExamResultDoc[]> {
  const q = query(sub(uid, "examResults"), orderBy("createdAt", "desc"), limit(max));
  return (await getDocs(q)).docs.map((d) => d.data() as ExamResultDoc);
}

// ---- review items ----
export async function setReviewItems(uid: string, items: ReviewItemDoc[]) {
  for (let i = 0; i < items.length; i += BATCH_MAX) {
    const batch = writeBatch(getClientDb());
    for (const it of items.slice(i, i + BATCH_MAX)) batch.set(doc(sub(uid, "reviewItems"), it.contentId), it, { merge: true });
    await batch.commit();
  }
}
export async function listReviewItems(uid: string): Promise<ReviewItemDoc[]> {
  const snap = await getDocs(sub(uid, "reviewItems"));
  return snap.docs.map((d) => d.data() as ReviewItemDoc);
}
export async function removeReviewItem(uid: string, contentId: string) {
  await deleteDoc(doc(sub(uid, "reviewItems"), contentId));
}
/** Delete many queue items in chunks (see BATCH_MAX). */
export async function removeReviewItems(uid: string, contentIds: string[]) {
  for (let i = 0; i < contentIds.length; i += BATCH_MAX) {
    const batch = writeBatch(getClientDb());
    for (const id of contentIds.slice(i, i + BATCH_MAX)) batch.delete(doc(sub(uid, "reviewItems"), id));
    await batch.commit();
  }
}

// ---- saved ----
export async function saveItem(uid: string, item: SavedItemDoc) {
  await setDoc(doc(sub(uid, "saved"), item.contentId), item);
}
export async function unsaveItem(uid: string, contentId: string) {
  await deleteDoc(doc(sub(uid, "saved"), contentId));
}
export async function listSaved(uid: string): Promise<SavedItemDoc[]> {
  const snap = await getDocs(sub(uid, "saved"));
  return snap.docs.map((d) => d.data() as SavedItemDoc).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}
export async function isSaved(uid: string, contentId: string): Promise<boolean> {
  return (await getDoc(doc(sub(uid, "saved"), contentId))).exists();
}
