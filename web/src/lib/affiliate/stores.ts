/**
 * Amazon stores the book links can point at, and how a visitor is matched to one.
 *
 * Amazon Associates is one programme per marketplace: a click on amazon.com from India earns
 * nothing even if the visitor buys, and amazon.com will not ship most Japanese textbooks there at
 * a sane price anyway. The three stores here are where visitors actually come from (Google
 * Analytics, October 2026: US, India, Japan). Canada sends visitors too, but amazon.com ships there
 * and a .com purchase credits the .com tag, so it has no store of its own yet. Everyone else is
 * sent to amazon.com.
 *
 * The visitor's store is inferred in the browser from the timezone and language, which is
 * accurate at marketplace granularity, costs nothing, and sends nothing to anyone — unlike an IP
 * lookup, which the privacy page would have to disclose. The visitor can override it, and the
 * choice is remembered in localStorage.
 *
 * Tags come from NEXT_PUBLIC_AMZ_TAG_<STORE>. A store with no tag still links — the
 * recommendation is the point, the commission is incidental — but the Amazon Associates
 * disclosure only appears once at least one tag is set, because until then it would be false.
 *
 * This module is imported by client components: no Node APIs, no server-only imports.
 */
export const STORE_IDS = ["us", "in", "jp"] as const;
export type StoreId = (typeof STORE_IDS)[number];

export type Store = { id: StoreId; name: string; domain: string; tag: string | null };

const TAGS: Record<StoreId, string | undefined> = {
  us: process.env.NEXT_PUBLIC_AMZ_TAG_US,
  in: process.env.NEXT_PUBLIC_AMZ_TAG_IN,
  jp: process.env.NEXT_PUBLIC_AMZ_TAG_JP,
};

export const STORES: Record<StoreId, Store> = {
  us: { id: "us", name: "Amazon.com", domain: "www.amazon.com", tag: TAGS.us?.trim() || null },
  in: { id: "in", name: "Amazon.in", domain: "www.amazon.in", tag: TAGS.in?.trim() || null },
  jp: { id: "jp", name: "Amazon.co.jp", domain: "www.amazon.co.jp", tag: TAGS.jp?.trim() || null },
};

/** The store crawlers, no-JS visitors and the server render see. */
export const DEFAULT_STORE: StoreId = "us";

export const STORE_STORAGE_KEY = "nihongo-path:book-store";

/** True once any store has a tag — the condition for showing the Associates disclosure. */
export function affiliateEnabled(): boolean {
  return STORE_IDS.some((id) => STORES[id].tag !== null);
}

export function isStoreId(s: unknown): s is StoreId {
  return typeof s === "string" && (STORE_IDS as readonly string[]).includes(s);
}

/**
 * Best guess at the visitor's store. Pure, so it is testable: the browser values are passed in.
 * Language wins for Japanese (a Japanese speaker abroad still buys from amazon.co.jp); otherwise
 * the timezone places the visitor, with the language as a tiebreak for India.
 */
export function inferStore(timeZone: string | undefined, languages: readonly string[] | undefined): StoreId {
  const tz = (timeZone ?? "").trim();
  const langs = (languages ?? []).map((l) => l.toLowerCase());
  if (langs.some((l) => l.startsWith("ja"))) return "jp";
  if (tz === "Asia/Tokyo") return "jp";
  if (tz === "Asia/Kolkata" || tz === "Asia/Calcutta") return "in";
  if (langs.some((l) => l === "hi" || l.startsWith("hi-") || l === "en-in")) return "in";
  return DEFAULT_STORE;
}

export type BookStoreEntry = { asin?: string; query?: string; title?: string };

/**
 * The link for one book in one store. A verified ASIN gives a product page; otherwise an Amazon
 * search for the exact edition, which never 404s and never lands on the wrong printing — the
 * failure modes of a guessed ASIN. The tag is added only when the store has one.
 */
export function bookUrl(entry: BookStoreEntry, store: Store): string {
  const base = `https://${store.domain}`;
  const url = entry.asin ? new URL(`/dp/${entry.asin}`, base) : new URL("/s", base);
  if (!entry.asin) url.searchParams.set("k", entry.query ?? "");
  if (store.tag) url.searchParams.set("tag", store.tag);
  return url.toString();
}
