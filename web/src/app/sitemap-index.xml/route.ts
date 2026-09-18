import { sitemapUrls } from "@/lib/seo/sitemaps";
import { LAST_MODIFIED } from "@/lib/seo/site";

/**
* Sitemap index, served at /sitemap-index.xml and rewritten from the conventional /sitemap.xml
 * (next.config.mjs), pointing at the per-section parts that
 * Next serves from src/app/sitemap.ts (/sitemap/<id>.xml). Crawlers that only look for
 * /sitemap.xml still discover every URL.
 */
export const dynamic = "force-static";

export function GET() {
  const parts = sitemapUrls()
    .map((loc) => `  <sitemap>\n    <loc>${loc}</loc>\n    <lastmod>${LAST_MODIFIED}</lastmod>\n  </sitemap>`)
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${parts}\n</sitemapindex>\n`;
  return new Response(xml, {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600, s-maxage=86400" },
  });
}
