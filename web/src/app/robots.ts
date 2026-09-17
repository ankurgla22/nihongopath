import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/site";
import { sitemapUrls } from "@/lib/seo/sitemaps";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Private (session-only) routes; the public /japanese/[level]/tests and /mock-exams pages are not affected.
        disallow: ["/dashboard", "/daily-study", "/progress", "/history", "/tests", "/mock-exams", "/review", "/saved", "/profile", "/api"],
      },
    ],
    sitemap: sitemapUrls(),
    host: SITE_URL,
  };
}
