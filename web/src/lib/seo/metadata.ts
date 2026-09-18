import type { Metadata } from "next";
import { ABOUT_ENTITIES, LAST_MODIFIED, SITE_NAME, SITE_SAME_AS, SITE_TAGLINE, SITE_URL } from "./site";

/** Default social preview, rendered by src/app/opengraph-image.tsx. */
export const OG_IMAGE = { url: `${SITE_URL}/opengraph-image`, width: 1200, height: 630, alt: `${SITE_NAME} — ${SITE_TAGLINE}` };

export function pageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
}): Metadata {
  const url = `${SITE_URL}${opts.path}`;
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: url },
    // Explicit on public pages so nothing relies on crawler defaults; private/search pages opt out.
    robots: opts.noIndex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title: `${opts.title} | ${SITE_NAME}`,
      description: opts.description,
      url,
      siteName: SITE_NAME,
      type: "article",
      locale: "en_US",
      // A per-route openGraph object replaces the layout's file-based image, so restate it here.
      images: [OG_IMAGE],
    },
    twitter: { card: "summary_large_image", title: opts.title, description: opts.description, images: [OG_IMAGE.url] },
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
      item: `${SITE_URL}${it.path}`,
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
    logo: { "@type": "ImageObject", url: `${SITE_URL}/opengraph-image`, width: 1200, height: 630 },
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

export function articleJsonLd(opts: { headline: string; description: string; path: string; inLanguage?: string; level?: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    headline: opts.headline,
    name: opts.headline,
    description: opts.description,
    url: `${SITE_URL}${opts.path}`,
    inLanguage: opts.inLanguage ?? "en",
    educationalLevel: opts.level ? `JLPT ${opts.level.toUpperCase()}` : "JLPT",
    learningResourceType: "Lesson",
    teaches: "Japanese language",
    isAccessibleForFree: true,
    dateModified: LAST_MODIFIED,
    author: { "@id": `${SITE_URL}/#organization` },
    publisher: { "@id": `${SITE_URL}/#organization` },
    isPartOf: { "@id": `${SITE_URL}/#website` },
    about: ABOUT_ENTITIES,
  };
}
