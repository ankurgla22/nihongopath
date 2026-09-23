"use client";
import type { User } from "firebase/auth";

/**
 * Client side of /api/account.
 *
 * The server demands an ID token whose `auth_time` is recent. A forced token refresh does NOT
 * move `auth_time`, so the learner has to actually re-authenticate: a Google popup for Google
 * accounts, the password for password accounts. That is the point of the check, so it cannot
 * be worked around here.
 */

export type ReauthNeeds = "google" | "password";

/** Which credential this account signs in with, so the caller knows what to ask for. */
export function reauthNeeds(user: User): ReauthNeeds {
  return user.providerData.some((p) => p.providerId === "google.com") ? "google" : "password";
}

/** Prove the learner is present: Google popup, or the account password. Throws on cancel or a wrong password. */
export async function reauthenticate(user: User, password?: string): Promise<void> {
  const { EmailAuthProvider, GoogleAuthProvider, browserPopupRedirectResolver, reauthenticateWithCredential, reauthenticateWithPopup } = await import("firebase/auth");
  if (reauthNeeds(user) === "google") {
    await reauthenticateWithPopup(user, new GoogleAuthProvider(), browserPopupRedirectResolver);
  } else {
    if (!password) throw new Error("password-required");
    if (!user.email) throw new Error("no-email");
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  }
}

/** Re-authenticate and return a token with a fresh `auth_time`, which the server checks. */
export async function freshIdToken(user: User, password?: string): Promise<string> {
  await reauthenticate(user, password);
  // Only after a real re-authentication does the refreshed token carry a new auth_time.
  return user.getIdToken(true);
}

/**
 * Change the account password. Firebase requires a recent sign-in for this, so the current
 * password (or a Google re-auth) is verified first. Google-only accounts have no password to
 * change; the caller hides the control for them.
 */
export async function changePassword(user: User, currentPassword: string, newPassword: string): Promise<void> {
  await reauthenticate(user, currentPassword);
  const { updatePassword } = await import("firebase/auth");
  await updatePassword(user, newPassword);
}

/**
 * Start an email-address change.
 *
 * Firebase's `updateEmail` is disabled for projects with email enumeration protection on, and
 * changing an address without proving it exists would lock the learner out of password reset.
 * `verifyBeforeUpdateEmail` sends a link to the NEW address; the change only lands once they
 * click it, so nothing here is immediate.
 */
export async function changeEmail(user: User, currentPassword: string | undefined, newEmail: string): Promise<void> {
  await reauthenticate(user, currentPassword);
  const { verifyBeforeUpdateEmail } = await import("firebase/auth");
  await verifyBeforeUpdateEmail(user, newEmail);
}

/** Send (or resend) the address-verification email. */
export async function sendVerification(user: User): Promise<void> {
  const { sendEmailVerification } = await import("firebase/auth");
  await sendEmailVerification(user);
}

type AccountBody = { action: "export" } | { action: "reset"; scope: "all" } | { action: "reset"; scope: "level"; level: string } | { action: "delete"; confirm: "DELETE" };

async function call(idToken: string, body: AccountBody): Promise<Response> {
  const res = await fetch("/api/account", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, idToken }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.message || "The request failed. Please try again.");
    }
  return res;
}

/** Download the account's data as a JSON file. */
export async function exportData(idToken: string): Promise<void> {
  const res = await call(idToken, { action: "export" });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `nihongo-path-data-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the download has definitely started.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type ResetSummary = { deleted: Record<string, number>; countersReset: boolean };

export async function resetProgress(idToken: string, scope: { kind: "all" } | { kind: "level"; level: string }): Promise<ResetSummary> {
  const body: AccountBody = scope.kind === "all" ? { action: "reset", scope: "all" } : { action: "reset", scope: "level", level: scope.level };
  return (await call(idToken, body)).json();
}

export async function deleteAccount(idToken: string): Promise<void> {
  await call(idToken, { action: "delete", confirm: "DELETE" });
}
