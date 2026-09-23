import "server-only";
import { NextResponse } from "next/server";

/**
 * CSRF guard for state-changing endpoints. Browsers always attach Origin to cross-site
 * POST/DELETE and to same-origin fetch(); a cross-site HTML form with enctype=text/plain
 * could otherwise smuggle a JSON body. Sec-Fetch-Site is checked when present.
 *
 * Shared by /api/auth/session and /api/account/*, which all act on the signed-in user.
 */
export function isSameOrigin(req: Request): boolean {
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;
  const origin = req.headers.get("origin");
  if (!origin) return fetchSite === "same-origin";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return host !== null && new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function jsonError(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

export const forbidden = () => jsonError(403, "forbidden", "Cross-site request rejected.");
