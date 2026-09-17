import "server-only";
import { adminConfigured, adminDb } from "@/lib/firebase/admin";

/** Privileged server read of the learner's current day; null when Admin Firestore is unavailable. */
export async function readCurrentDay(uid: string): Promise<number | null> {
  if (!adminConfigured()) return null;
  try {
    const snap = await adminDb().collection("users").doc(uid).get();
    const d = snap.data()?.currentDay;
    return typeof d === "number" && Number.isFinite(d) ? d : null;
  } catch {
    return null;
  }
}
