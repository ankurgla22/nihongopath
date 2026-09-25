import type { MetadataRoute } from "next";
import { getFoundation, getGrammar, getKanji, getListening, getReading, getStrategy, getVocabulary } from "@/lib/content";
import { LEVELS } from "@/lib/content/schemas";
import { absUrl } from "@/lib/seo/site";
import { contentLastMod } from "@/lib/content/lastmod";
import { SITEMAP_SECTIONS } from "@/lib/seo/sitemaps";
import { pairPath, pairsForLevel } from "@/lib/content/compare";
import { vocabComparePath, vocabComparisons } from "@/lib/content/vocabCompare";
import { vocabPageCount, vocabPagePath } from "@/components/content/VocabularyIndex";

/** One sitemap part per section (see src/lib/seo/sitemaps.ts); each is served at /sitemap/<id>.xml. */
export function generateSitemaps() {
  return SITEMAP_SECTIONS.map((_, id) => ({ id }));
}

type Entry = MetadataRoute.Sitemap[number];

export default function sitemap({ id }: { id: number }): MetadataRoute.Sitemap {
  const section = SITEMAP_SECTIONS[Number(id)];
  if (!section) return [];
  const now = new Date();
  // `id` selects the content item's own last-modified date (content/lastmod.json); pages with no
  // single content item (hubs, indexes) keep the build time.
  const url = (path: string, priority: number, changeFrequency: Entry["changeFrequency"] = "weekly", id?: string): Entry => ({
    url: absUrl(path),
    lastModified: id ? contentLastMod(id) : now,
    changeFrequency,
    priority,
  });
  const entries: Entry[] = [];

  if (section.kind === "core") {
    entries.push(url("/", 1, "daily"), url("/japanese", 0.9), url("/japanese/curriculum", 0.8, "monthly"), url("/about", 0.6, "monthly"), url("/privacy", 0.3, "yearly"), url("/terms", 0.3, "yearly"), url("/jlpt", 0.8, "monthly"), url("/jlpt/strategy", 0.8, "monthly"), url("/search", 0.3, "monthly"));
    for (const a of getStrategy()) entries.push(url(`/jlpt/strategy/${a.slug}`, 0.7, "monthly", a.id));
    entries.push(url("/japanese/foundation", 0.9));
    for (const f of getFoundation()) entries.push(url(`/japanese/foundation/${f.slug}`, 0.7, "weekly", f.id));
    for (const level of LEVELS) {
      const base = `/japanese/${level}`;
      entries.push(url(base, 0.9));
      for (const s of ["grammar", "vocabulary", "kanji", "reading", "listening", "tests", "mock-exams"]) entries.push(url(`${base}/${s}`, 0.8));
      for (let p = 2; p <= vocabPageCount(level); p++) entries.push(url(vocabPagePath(level, p), 0.7));
    }
    return entries;
  }

  const base = `/japanese/${section.level}`;
  switch (section.kind) {
    case "grammar":
      for (const g of getGrammar(section.level)) entries.push(url(`${base}/grammar/${g.slug}`, g.enriched ? 0.7 : 0.5, "weekly", g.id));
      break;
    case "vocabulary":
      for (const v of getVocabulary(section.level)) entries.push(url(`${base}/vocabulary/${v.slug}`, v.enriched ? 0.6 : 0.4, "monthly", v.id));
      // "会う vs 合う" pages sit under the level of the earlier word. They answer a question
      // learners search directly, so they rank above an ordinary entry rather than below it.
      for (const c of vocabComparisons()) if (c.level === section.level) entries.push(url(vocabComparePath(c), 0.7, "monthly"));
      break;
    case "kanji":
      for (const k of getKanji(section.level)) entries.push(url(`${base}/kanji/${k.slug}`, k.enriched ? 0.6 : 0.4, "monthly", k.id));
      break;
    case "practice":
      for (const r of getReading(section.level)) entries.push(url(`${base}/reading/${r.slug}`, 0.7, "weekly", r.id));
      // One-line quick-response drills are noindex (see the listening page); keep them out of the sitemap too.
      for (const l of getListening(section.level)) if (l.script.length >= 3) entries.push(url(`${base}/listening/${l.slug}`, 0.7, "weekly", l.id));
      break;
    case "compare":
      for (const p of pairsForLevel(section.level)) entries.push(url(pairPath(p), 0.6, "monthly", contentLastMod(p.a.id) > contentLastMod(p.b.id) ? p.a.id : p.b.id));
      break;
  }
  return entries;
}
