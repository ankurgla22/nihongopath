import { NextResponse } from "next/server";
import { adminAuth, adminConfigured } from "@/lib/firebase/admin";
import { SESSION_COOKIE, SESSION_DAYS } from "@/lib/firebase/session";
import { publicProjectId, verifyFirebaseIdToken } from "@/lib/firebase/verifyIdToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cookieOptions = {
  httpOnly: true,
  // Always Secure in production. Set SESSION_COOKIE_INSECURE=1 only for a plain-http staging box.
  secure: process.env.NODE_ENV === "production" && process.env.SESSION_COOKIE_INSECURE !== "1",
  sameSite: "lax" as const,
  path: "/",
};

const MAX_AGE = SESSION_DAYS * 24 * 60 * 60;
const MAX_TOKEN_LENGTH = 4096;

/**
 * CSRF guard for the cookie-setting endpoints. Browsers always attach Origin to
 * cross-site POST/DELETE and to same-origin fetch(); a cross-site HTML form with
 * enctype=text/plain could otherwise smuggle a JSON body and log the victim into an
 * attacker-controlled account (login CSRF). Sec-Fetch-Site is checked when present.
 */
function isSameOrigin(req: Request): boolean {
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

function forbidden() {
  return NextResponse.json({ error: "forbidden", message: "Cross-site request rejected." }, { status: 403 });
}

/**
 * POST { idToken } -> verifies the ID token and sets the session cookie.
 * With a service account: a Firebase session cookie (Admin SDK).
 * Without one: the ID token itself, verified with Google's public keys.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return forbidden();
  if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "bad-request", message: "Expected application/json." }, { status: 415 });
  }
  let idToken: unknown;
  try {
    ({ idToken } = await req.json());
  } catch {
    return NextResponse.json({ error: "bad-request", message: "Expected a JSON body with idToken." }, { status: 400 });
  }
  if (typeof idToken !== "string" || !idToken || idToken.length > MAX_TOKEN_LENGTH) {
    return NextResponse.json({ error: "bad-request", message: "idToken is required." }, { status: 400 });
  }

  if (adminConfigured()) {
    try {
      const auth = adminAuth();
      const decoded = await auth.verifyIdToken(idToken, true);
      const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn: MAX_AGE * 1000 });
      const res = NextResponse.json({ ok: true, uid: decoded.uid, mode: "admin" });
      res.cookies.set(SESSION_COOKIE, sessionCookie, { ...cookieOptions, maxAge: MAX_AGE });
      return res;
    } catch (err) {
      // A token the Admin SDK actively rejected (expired, revoked, disabled user, wrong
      // project) must not be rescued by the public-key path below; only fall back when
      // the Admin SDK itself is unusable (missing credentials / IAM).
      const code = (err as { code?: string } | null)?.code ?? "";
      if (code.startsWith("auth/")) {
        console.warn("admin rejected id token", code);
        return NextResponse.json({ error: "invalid-token", message: "Could not verify sign-in. Please try again." }, { status: 401 });
      }
      console.warn("admin session create failed, falling back to public-key verification", err);
    }
  }

  const projectId = publicProjectId();
  if (!projectId) {
    return NextResponse.json(
      { error: "not-configured", message: "NEXT_PUBLIC_FIREBASE_PROJECT_ID is not set. Copy .env.example to .env.local and fill in the Firebase values." },
      { status: 503 }
    );
  }
  try {
    const v = await verifyFirebaseIdToken(idToken, { projectId });
    const res = NextResponse.json({ ok: true, uid: v.uid, mode: "public-key" });
    res.cookies.set(SESSION_COOKIE, idToken, { ...cookieOptions, maxAge: MAX_AGE });
    return res;
  } catch (err) {
    console.warn("session create failed", err);
    return NextResponse.json({ error: "invalid-token", message: "Could not verify sign-in. Please try again." }, { status: 401 });
  }
}

/** DELETE -> clears the session cookie. */
export async function DELETE(req: Request) {
  if (!isSameOrigin(req)) return forbidden();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  return res;
}
