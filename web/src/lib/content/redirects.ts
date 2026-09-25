import map from "../../../content/redirects.json";

/**
 * Where a page that has moved now lives.
 *
 * Slugs carry the entry's order number and a romaji spelling of its reading, and both have changed
 * since the site was first crawled: re-bucketing moved entries to their reference level, which
 * renumbered them, and a later pass rebuilt romaji that had lost its long vowels on import. Google
 * still holds the old URLs — /japanese/n5/vocabulary/245-doyoubi among them — and they 404.
 *
 * scripts/build-redirects.mjs mines every slug each headword has ever had out of git history and
 * writes content/redirects.json. The lookup lives here, not in middleware, for two reasons: the map
 * is ~500KB and would be bundled into the edge runtime on every request, and only a miss needs it.
 * A page that resolves normally never touches this.
 */
const REDIRECTS = map as Record<string, string>;

/**
 * @returns the path to redirect to, or null when this URL has simply never existed.
 */
export function movedTo(level: string, kind: "vocabulary" | "kanji" | "grammar", slug: string): string | null {
  const to = REDIRECTS[`${level}/${kind}/${slug}`];
  return to ? `/japanese/${to}` : null;
}
