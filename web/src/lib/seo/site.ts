export const SITE_NAME = "Nihongo Path";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Absolute URL for a site path, percent-encoded the way Next writes canonical tags.
 * Kanji slugs contain the character itself (/kanji/1-一); the sitemap, breadcrumb and
 * Article URLs used to carry it raw while the canonical carried %E4%B8%80, so the same
 * page had two spellings. Every absolute URL in schema and sitemaps goes through this.
 */
export function absUrl(path: string): string {
  return `${SITE_URL}${encodeURI(path)}`;
}
export const SITE_TAGLINE = "Learn Japanese every day, from your first kana to JLPT N1.";

/**
 * One-sentence description of the publisher, used for Organization.description.
 * Kept short: it is a description of the organisation, not of the site's contents.
 */
export const SITE_DESCRIPTION =
  "Nihongo Path publishes a free, complete Japanese course for every JLPT level, from hiragana to N1, with daily study plans and full-length mock exams.";

/**
 * The company that owns, builds and operates the site (an in-house project). Used for
 * Organization.parentOrganization and the About page. Name as written on its own site.
 */
export const SITE_OPERATOR = { name: "Opusify IT Solutions", url: "https://opusify.co.in/" };

/**
 * Where data requests and privacy grievances go. On this hostname rather than the operator's
 * generic contact page, because a privacy policy that offers only a company-wide contact form makes
 * a data request indistinguishable from a sales enquiry — and the DPDP Act expects a grievance to
 * have somewhere specific to land.
 *
 * This address must keep receiving mail for as long as the policy names it.
 */
export const PRIVACY_EMAIL = "privacy@nihongopath.app";

/**
 * Date the site first published content (schema datePublished).
 * Content is continuously revised, so dateModified tracks the build instead.
 */
export const SITE_PUBLISHED = "2026-09-17T00:00:00.000Z";

/** The longest meta description search engines render before truncating. */
export const DESCRIPTION_MAX = 170;

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
