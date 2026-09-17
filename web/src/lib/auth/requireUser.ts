import "server-only";
import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "@/lib/firebase/session";

/**
 * For private server pages: returns the verified session user or redirects to /login.
 * Pass `path` (the page's own route) so the learner returns there after logging in.
 * Handles the expired/invalid-cookie case that middleware cannot check (it only tests presence).
 */
export async function requireUser(path = "/dashboard"): Promise<SessionUser> {
  const user = await getSessionUser();
  if (user) return user;
  redirect(`/login?next=${encodeURIComponent(path)}`);
}
