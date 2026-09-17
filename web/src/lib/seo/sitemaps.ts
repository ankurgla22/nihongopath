import { LEVELS, type Level } from "@/lib/content/schemas";
import { SITE_URL } from "./site";

/**
 * The sitemap is split into one file per content section (about 6,000 URLs would otherwise be a
 * single ~1.2 MB document). Next serves each part at /sitemap/<id>.xml (src/app/sitemap.ts) and
 * robots.txt lists every part; the ids are the indexes into SITEMAP_SECTIONS.
 */
export type SitemapSection = { kind: "core" } | { kind: "grammar" | "vocabulary" | "kanji" | "practice"; level: Level };

export const SITEMAP_SECTIONS: SitemapSection[] = [
  { kind: "core" },
  ...LEVELS.flatMap((level): SitemapSection[] => [
    { kind: "grammar", level },
    { kind: "vocabulary", level },
    { kind: "kanji", level },
    { kind: "practice", level },
  ]),
];

/** Absolute URL of every sitemap part, for robots.txt. */
export function sitemapUrls(): string[] {
  return SITEMAP_SECTIONS.map((_, id) => `${SITE_URL}/sitemap/${id}.xml`);
}
