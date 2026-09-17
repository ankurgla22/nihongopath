import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "./site";

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
    robots: opts.noIndex ? { index: false, follow: false } : undefined,
    openGraph: {
      title: `${opts.title} | ${SITE_NAME}`,
      description: opts.description,
      url,
      siteName: SITE_NAME,
      type: "article",
    },
    twitter: { card: "summary", title: opts.title, description: opts.description },
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

export function articleJsonLd(opts: { headline: string; description: string; path: string; inLanguage?: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    headline: opts.headline,
    description: opts.description,
    url: `${SITE_URL}${opts.path}`,
    inLanguage: opts.inLanguage ?? "en",
    educationalLevel: "JLPT",
    learningResourceType: "Lesson",
    publisher: { "@type": "Organization", name: SITE_NAME },
  };
}
