import type { Metadata } from "next";
import type { Level } from "@/lib/content/schemas";
import {
  ABOUT_ENTITIES,
  DESCRIPTION_MAX,
  TITLE_MAX,
  LAST_MODIFIED,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_OPERATOR,
  SITE_PUBLISHED,
  SITE_SAME_AS,
  SITE_TAGLINE,
  SITE_URL,
  absUrl,
} from "./site";

/** Default social preview, rendered by src/app/opengraph-image.tsx. */
export const OG_IMAGE = { url: `${SITE_URL}/opengraph-image`, width: 1200, height: 630, alt: `${SITE_NAME} — ${SITE_TAGLINE}` };

/**
 * Turn a content fragment into something that can be concatenated into a description.
 *
 * Content fields often already carry their own quotation (grammar meanings are written as
 * `"only / just ~".`), so callers must not wrap them in quotes again; this just guarantees
 * the fragment ends a sentence so the next one reads cleanly after it.
 */
export function asSentence(text: string): string {
  const s = text.replace(/\s+/g, " ").trim();
  if (!s) return "";
  return /[.!?]["'”]?$/.test(s) ? s : `${s}.`;
}

/**
 * Keep meta descriptions inside the length search engines actually render.
 * Page descriptions are generated from content templates, so lengths vary per lesson;
 * clamping here fixes every route at once instead of trusting ~1000 call sites.
 *
 * Prefers to end on a full sentence, falls back to a word boundary with an ellipsis,
 * and never cuts a word in half.
 */
export function clampDescription(text: string, max = DESCRIPTION_MAX): string {
  const s = text.replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;

  const head = s.slice(0, max + 1);
  // A sentence ending late enough to still be a useful description.
  const sentence = Math.max(head.lastIndexOf(". "), head.lastIndexOf("! "), head.lastIndexOf("? "));
  if (sentence >= max * 0.6) return s.slice(0, sentence + 1);

  // One character of the budget belongs to the ellipsis, so cut at max - 1, not max.
  const budget = s.slice(0, max - 1);
  const word = budget.lastIndexOf(" ");
  return `${budget.slice(0, word > 0 ? word : budget.length).replace(/[,;:.\s]+$/, "")}…`;
}

export function pageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
}): Metadata {
  const url = `${SITE_URL}${opts.path}`;
  const description = clampDescription(opts.description);
  return {
    // `absolute` opts out of the root layout's "%s | Nihongo Path" template. Titles that still fit
    // with the suffix keep it; the rest drop the brand rather than have their own words cut off.
    title: `${opts.title} | ${SITE_NAME}`.length <= TITLE_MAX ? opts.title : { absolute: opts.title },
    description,
    alternates: { canonical: url },
    // Explicit on public pages so nothing relies on crawler defaults; private/search pages opt out.
    robots: opts.noIndex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title: `${opts.title} | ${SITE_NAME}`,
      description,
      url,
      siteName: SITE_NAME,
      type: "article",
      locale: "en_US",
      // A per-route openGraph object replaces the layout's file-based image, so restate it here.
      images: [OG_IMAGE],
    },
    twitter: { card: "summary_large_image", title: opts.title, description, images: [OG_IMAGE.url] },
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absUrl(it.path),
    })),
  };
}

/** The organisation that publishes the site. Rendered once, site-wide, from the root layout. */
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    logo: { "@type": "ImageObject", url: `${SITE_URL}/icon`, width: 512, height: 512 },
    parentOrganization: { "@type": "Organization", name: SITE_OPERATOR.name, url: SITE_OPERATOR.url },
    ...(SITE_SAME_AS.length ? { sameAs: SITE_SAME_AS } : {}),
  };
}

export function websiteJsonLd(description: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: SITE_URL,
    description,
    inLanguage: "en",
    publisher: { "@id": `${SITE_URL}/#organization` },
    about: ABOUT_ENTITIES,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

/** A level's course id: the level hub page carries the Course node, lessons point at it. */
export function courseId(level: CourseLevel) {
  return `${SITE_URL}/japanese/${level}#course`;
}

export type CourseLevel = Level | "foundation";

function educationalLevel(level?: CourseLevel) {
  if (!level) return "JLPT";
  return level === "foundation" ? "Beginner (before JLPT N5)" : `JLPT ${level.toUpperCase()}`;
}

/**
 * Course node for a level hub (/japanese/n5 … and /japanese/foundation). `hasPart` lists the
 * section index pages (grammar, vocabulary …) or, for Foundation, the lessons themselves, so
 * the level → skill → lesson graph that the HTML links express is also explicit in schema.
 */
export function courseJsonLd(opts: { level: CourseLevel; name: string; description: string; parts: { name: string; path: string }[] }) {
  const url = `${SITE_URL}/japanese/${opts.level}`;
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    "@id": courseId(opts.level),
    name: opts.name,
    description: clampDescription(opts.description),
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    provider: { "@id": `${SITE_URL}/#organization` },
    inLanguage: "en",
    educationalLevel: educationalLevel(opts.level),
    teaches: "Japanese language",
    isAccessibleForFree: true,
    dateModified: LAST_MODIFIED,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    hasPart: opts.parts.map((p) => ({ "@type": "WebPage", name: p.name, url: absUrl(p.path) })),
    about: ABOUT_ENTITIES,
  };
}

/** The learning path (/japanese): an ordered list of the six courses, referenced by id. */
export function courseListJsonLd(levels: CourseLevel[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${SITE_URL}/japanese#courses`,
    name: "Nihongo Path learning path",
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    numberOfItems: levels.length,
    itemListElement: levels.map((level, i) => ({ "@type": "ListItem", position: i + 1, item: { "@id": courseId(level) } })),
  };
}

export function articleJsonLd(opts: { headline: string; description: string; path: string; inLanguage?: string | string[]; level?: CourseLevel; dateModified?: string }) {
  return {
    "@context": "https://schema.org",
    // LearningResource describes these pages most accurately, but generic crawlers and
    // most AI citation pipelines only look for Article. Declaring both keeps the
    // education semantics and still satisfies Article consumers.
    "@type": ["Article", "LearningResource"],
    headline: opts.headline,
    name: opts.headline,
    description: clampDescription(opts.description),
    url: absUrl(opts.path),
    mainEntityOfPage: { "@type": "WebPage", "@id": absUrl(opts.path) },
    inLanguage: opts.inLanguage ?? "en",
    educationalLevel: educationalLevel(opts.level),
    learningResourceType: "Lesson",
    teaches: "Japanese language",
    isAccessibleForFree: true,
    datePublished: SITE_PUBLISHED,
    // The item's own last change (content/lastmod.json) when the page passes it; build time otherwise.
    dateModified: opts.dateModified ?? LAST_MODIFIED,
    author: { "@id": `${SITE_URL}/#organization` },
    publisher: { "@id": `${SITE_URL}/#organization` },
    // A lesson belongs to its level's Course (declared on the level hub) as well as the site.
    isPartOf: opts.level ? [{ "@id": `${SITE_URL}/#website` }, { "@type": "Course", "@id": courseId(opts.level) }] : { "@id": `${SITE_URL}/#website` },
    about: ABOUT_ENTITIES,
  };
}
