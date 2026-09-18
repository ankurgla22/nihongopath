export const SITE_NAME = "Nihongo Path";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export const SITE_TAGLINE = "Learn Japanese every day, from your first kana to JLPT N1.";

/**
 * Official profiles of the organisation behind the site (Organization.sameAs). Fill in when
 * social or directory profiles exist; an empty list omits the property rather than lying.
 */
export const SITE_SAME_AS: string[] = [];

/** Build time, used as dateModified in schema and as sitemap lastmod. Content changes ship as a rebuild. */
export const LAST_MODIFIED = new Date().toISOString();

/** Known entities the site is about, for schema.org `about` (entity linking). */
export const ABOUT_ENTITIES = [
  {
    "@type": "Thing",
    name: "Japanese-Language Proficiency Test",
    alternateName: "JLPT",
    sameAs: ["https://en.wikipedia.org/wiki/Japanese-Language_Proficiency_Test", "https://www.wikidata.org/wiki/Q1195012", "https://www.jlpt.jp/"],
  },
  {
    "@type": "Thing",
    name: "Japanese language",
    sameAs: ["https://en.wikipedia.org/wiki/Japanese_language", "https://www.wikidata.org/wiki/Q5287"],
  },
];
