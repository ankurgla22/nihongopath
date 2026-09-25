import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/site";

// Private (session-only) routes; the public /japanese/[level]/tests and /mock-exams pages are not affected.
//
// /login is in here for a different reason: every lesson page shows Save and Mark-complete to
// signed-out visitors as `/login?next=<that page>`, so a crawler following links finds one unique
// login URL per lesson — about 14,000 of them, all rendering the same form. The request logs showed
// exactly that happening. Nothing under /login should be crawled, and the links carry nofollow too.
const PRIVATE = ["/dashboard", "/daily-study", "/progress", "/history", "/tests", "/mock-exams", "/review", "/saved", "/profile", "/api", "/login", "/signup", "/forgot-password"];

/**
 * Search and AI crawlers that fetch pages to answer questions or build indexes. Listed
 * explicitly (each with the same allow/disallow) so that a future blanket rule for some
 * other agent can never accidentally exclude them.
 */
const CRAWLERS = [
  "Googlebot",
  "Bingbot",
  "OAI-SearchBot",
  "GPTBot",
  "ChatGPT-User",
  "PerplexityBot",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "Applebot",
  "DuckDuckBot",
  "Google-Extended",
  "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      ...CRAWLERS.map((userAgent) => ({ userAgent, allow: "/", disallow: PRIVATE })),
      { userAgent: "*", allow: "/", disallow: PRIVATE },
    ],
    // Only the index. It already points at every child sitemap, so listing the children here as
    // well just repeats 26 lines a crawler would fetch anyway.
    sitemap: `${SITE_URL}/sitemap.xml`,
    // No `host:`. Google ignores it, and the canonical tags say the same thing more reliably.
  };
}
