import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware, two jobs:
 *
 * 1. Redirect unauthenticated visitors away from private routes. It only checks that the session
 *    cookie exists; verification happens in server components via getSessionUser()/requireUser()
 *    (the Admin SDK is not edge-compatible).
 *
 * 2. Refuse to render a page for a crawler that asks for a prefetch URL. Next.js prefetches pages
 *    as `<url>?_rsc=<hash>` and the browser sends an `RSC: 1` header with them. Crawlers that run
 *    JavaScript see those URLs, request them *without* the header, and get a full HTML render of a
 *    page they already have — and because the hash varies, the URL space is unbounded. Meta's
 *    crawler did exactly that: 68,952 requests in a day, 93% of all traffic, 63,000 distinct URLs,
 *    and the origin rate-limited real visitors while it ran. robots.txt disallows `?_rsc=` too, but
 *    that storm began five hours after the rule went live. A redirect to the clean URL costs
 *    nothing to serve, consolidates anything a search engine indexed, and leaves browsers untouched.
 */
// Must match SESSION_COOKIE in src/lib/firebase/session.ts (which is server-only and cannot be imported here).
const SESSION_COOKIE = "__session";

const PRIVATE_PREFIXES = ["/dashboard", "/daily-study", "/progress", "/history", "/tests", "/mock-exams", "/review", "/saved", "/profile"];

export function middleware(req: NextRequest) {
  const { pathname, search, searchParams } = req.nextUrl;

  if (searchParams.has("_rsc") && !req.headers.get("rsc")) {
    const url = req.nextUrl.clone();
    url.searchParams.delete("_rsc");
    return NextResponse.redirect(url, 308);
  }

  const isPrivate = PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!isPrivate) return NextResponse.next();
  if (req.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except static assets, which never carry ?_rsc= and never need a session.
  matcher: ["/((?!_next/static|_next/image|audio/|kanjivg/|icon|opengraph-image|favicon\\.ico).*)"],
};
