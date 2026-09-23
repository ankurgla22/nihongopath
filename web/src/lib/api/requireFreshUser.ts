import "server-only";
import { adminAuth, adminConfigured } from "@/lib/firebase/admin";

/** How recently the learner must have signed in to run a destructive account operation. */
export const REAUTH_MAX_AGE_SECONDS = 10 * 60;

export type FreshUser = { uid: string; email: string | null };
export type FreshUserResult = { ok: true; user: FreshUser } | { ok: false; status: number; error: string; message: string };

/**
 * Verify a *fresh* ID token for a destructive operation (reset, delete, export).
 *
 * The session cookie is not enough here. It lives for 14 days, so anyone with a borrowed
 * laptop could wipe an account; Firebase's own guidance is to require a recent sign-in for
 * account-level changes. The client re-authenticates, then sends the ID token it gets back.
 *
 * `verifyIdToken(token, true)` also checks revocation, so a token from a session the learner
 * has already signed out of is rejected.
 */
export async function requireFreshUser(idToken: unknown): Promise<FreshUserResult> {
  if (!adminConfigured()) {
    return {
      ok: false,
      status: 503,
      error: "not-configured",
      message: "Account management needs server credentials. Set FIREBASE_SERVICE_ACCOUNT_JSON, or run on Firebase App Hosting where they are provided.",
    };
  }
  if (typeof idToken !== "string" || !idToken || idToken.length > 4096) {
    return { ok: false, status: 400, error: "bad-request", message: "A fresh idToken is required." };
  }
  try {
    const decoded = await adminAuth().verifyIdToken(idToken, true);
    const authAge = Math.floor(Date.now() / 1000) - Number(decoded.auth_time ?? 0);
    if (!Number.isFinite(authAge) || authAge > REAUTH_MAX_AGE_SECONDS) {
      return { ok: false, status: 401, error: "reauth-required", message: "Please sign in again to confirm this change." };
    }
    return { ok: true, user: { uid: decoded.uid, email: decoded.email ?? null } };
  } catch {
    return { ok: false, status: 401, error: "invalid-token", message: "Could not verify your sign-in. Please sign in again." };
  }
}
