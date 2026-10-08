import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/site";

// Private (session-only) routes; the public /japanese/[level]/tests and /mock-exams pages are not affected.
//
// /login is in here for a different reason: every lesson page shows Save and Mark-complete to
// signed-out visitors as a link to the login page. Those links once carried `?next=<that page>`,
// so a crawler found one unique login URL per lesson — Search Console reported 2,352 of them,
// all blocked, all the same form. The return path now travels in the fragment (`/login#next=…`),
// which crawlers drop, so there is one login URL. It stays blocked, and the links carry nofollow.
const PRIVATE = ["/dashboard", "/daily-study", "/progress", "/history", "/tests", "/mock-exams", "/review", "/saved", "/profile", "/api", "/login", "/signup", "/forgot-password"];

/**
 * Next.js prefetches pages as `<url>?_rsc=<hash>`. A browser needs those; a crawler does not, and
 * the ones that run JavaScript (OpenAI's search bot, Meta's) were recording the prefetches as
 * URLs and fetching them as pages — 10% of all requests in the logs, every one a duplicate of a
 * page they already had. Both forms, since the token can follow another parameter.
 */
const PREFETCH = ["/*?_rsc=", "/*&_rsc="];

/**
 * Crawlers that take and give nothing back: they scrape the site to sell backlink data. Together
 * they were a fifth of all requests. Both document that they honour a robots.txt disallow.
 * (Semrush and Ahrefs are deliberately not here — their data is useful to the site's owner.)
 */
const SCRAPERS = ["MJ12bot", "SERankingBacklinksBot"];

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
      ...SCRAPERS.map((userAgent) => ({ userAgent, disallow: "/" })),
      ...CRAWLERS.map((userAgent) => ({ userAgent, allow: "/", disallow: [...PRIVATE, ...PREFETCH] })),
      { userAgent: "*", allow: "/", disallow: [...PRIVATE, ...PREFETCH] },
    ],
    // Only the index. It already points at every child sitemap, so listing the children here as
    // well just repeats 26 lines a crawler would fetch anyway.
    sitemap: `${SITE_URL}/sitemap.xml`,
    // No `host:`. Google ignores it, and the canonical tags say the same thing more reliably.
  };
}
