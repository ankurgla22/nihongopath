import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/site";
import { sitemapUrls } from "@/lib/seo/sitemaps";

// Private (session-only) routes; the public /japanese/[level]/tests and /mock-exams pages are not affected.
const PRIVATE = ["/dashboard", "/daily-study", "/progress", "/history", "/tests", "/mock-exams", "/review", "/saved", "/profile", "/api"];

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
    sitemap: [`${SITE_URL}/sitemap.xml`, ...sitemapUrls()],
    host: SITE_URL,
  };
}
