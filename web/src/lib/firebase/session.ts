import "server-only";
import { cookies } from "next/headers";
import { adminAuth, adminConfigured } from "./admin";
import { publicProjectId, verifyFirebaseIdToken } from "./verifyIdToken";

export const SESSION_COOKIE = "__session";
export const SESSION_DAYS = 14;

export type SessionUser = { uid: string; email: string | null; name: string | null; picture: string | null };

/**
 * Returns the signed-in user from the session cookie, or null. Never trusts client-supplied ids.
 * With a service account the cookie is a Firebase session cookie verified by the Admin SDK.
 * Without one, the cookie holds a Firebase ID token verified against Google's public keys.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  if (adminConfigured()) {
    try {
      const decoded = await adminAuth().verifySessionCookie(token, true);
      return {
        uid: decoded.uid,
        email: decoded.email ?? null,
        name: (decoded.name as string | undefined) ?? null,
        picture: (decoded.picture as string | undefined) ?? null,
      };
    } catch {
      /* fall through: the cookie may be a raw ID token from before the service account was added */
    }
  }
  const projectId = publicProjectId();
  if (!projectId) return null;
  // In admin mode the Admin SDK is the authority (it checks revocation); a legacy raw
  // ID-token cookie is honoured only while unexpired (<= 1 h), never for the 14-day grace,
  // otherwise a revoked/disabled account could keep a session alive for two weeks.
  const graceSeconds = adminConfigured() ? 0 : SESSION_DAYS * 24 * 60 * 60;
  try {
    const v = await verifyFirebaseIdToken(token, { projectId, graceSeconds });
    return { uid: v.uid, email: v.email, name: v.name, picture: v.picture };
  } catch {
    return null;
  }
}
