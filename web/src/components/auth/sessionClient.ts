"use client";
/**
 * Client helpers shared by AuthProvider and the auth forms.
 * They bridge Firebase Auth (browser) and the server session cookie (/api/auth/session).
 */
import type { User } from "firebase/auth";
import { ensureUser } from "@/lib/firestore/repo";

let lastSyncedUid: string | null = null;
let lastSyncedToken: string | null = null;
/** Incremented on every logout so an in-flight session POST cannot re-set the cookie afterwards. */
let logoutEpoch = 0;
let inFlight: Promise<void> | null = null;

/** Sanitises a ?next= value so we only ever redirect within the site. */
export function safeNext(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || next.length > 2048) return fallback;
  // Reject control/whitespace chars: the URL parser strips tab/newline, so "/\t/evil.com" would become "//evil.com".
  if (/[\x00-\x20\x7f]/.test(next)) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  try {
    // Must resolve to a same-origin path (catches any other scheme/authority trick).
    if (new URL(next, "https://a.invalid").origin !== "https://a.invalid") return fallback;
  } catch {
    return fallback;
  }
  if (next.startsWith("/login") || next.startsWith("/signup") || next.startsWith("/forgot-password")) return fallback;
  return next;
}

async function deleteCookie(): Promise<void> {
  try {
    await fetch("/api/auth/session", { method: "DELETE" });
  } catch {
    /* offline: the cookie is rejected server-side once it expires */
  }
}

/**
 * Creates the user document if missing and exchanges the ID token for a server session cookie.
 * Safe to call repeatedly: the same token is never posted twice, concurrent calls share one
 * request, and a logout that happens mid-request wins (the cookie is deleted again).
 * Awaiting it guarantees middleware-protected pages accept the next navigation.
 */
export async function establishSession(user: User, { force = false } = {}): Promise<void> {
  if (inFlight) await inFlight.catch(() => {});
  const run = async () => {
    const epoch = logoutEpoch;
    if (lastSyncedUid !== user.uid) {
      try {
        await ensureUser({ uid: user.uid, email: user.email, displayName: user.displayName, photoURL: user.photoURL });
      } catch (err) {
        // Firestore unavailable or rules not deployed: auth still works, progress sync retries later.
        console.warn("ensureUser failed", err);
      }
    }
    const idToken = await user.getIdToken(force);
    if (!force && idToken === lastSyncedToken && lastSyncedUid === user.uid) return;
    if (epoch !== logoutEpoch) return;
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (epoch !== logoutEpoch) {
      // A logout raced this request; make sure the cookie it just set is gone.
      await deleteCookie();
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message ?? "Could not create a server session.");
    }
    lastSyncedUid = user.uid;
    lastSyncedToken = idToken;
  };
  inFlight = run();
  try {
    await inFlight;
  } finally {
    inFlight = null;
  }
}

/** Clears the server session cookie. Call before or after firebase signOut(). */
export async function clearSession(): Promise<void> {
  logoutEpoch++;
  lastSyncedUid = null;
  lastSyncedToken = null;
  if (inFlight) await inFlight.catch(() => {});
  await deleteCookie();
}
