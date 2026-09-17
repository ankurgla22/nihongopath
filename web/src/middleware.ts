import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge middleware: redirects unauthenticated visitors away from private routes.
 * It only checks that the session cookie exists; verification happens in
 * server components via getSessionUser()/requireUser() (Admin SDK is not edge-compatible).
 */
// Must match SESSION_COOKIE in src/lib/firebase/session.ts (which is server-only and cannot be imported here).
const SESSION_COOKIE = "__session";

const PRIVATE_PREFIXES = ["/dashboard", "/daily-study", "/progress", "/history", "/tests", "/mock-exams", "/review", "/saved", "/profile"];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isPrivate = PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!isPrivate) return NextResponse.next();
  if (req.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/dashboard/:path*", "/daily-study/:path*", "/progress/:path*", "/history/:path*", "/tests/:path*", "/mock-exams/:path*", "/review/:path*", "/saved/:path*", "/profile/:path*"],
};
