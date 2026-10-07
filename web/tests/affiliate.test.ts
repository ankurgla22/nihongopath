/**
 * Book links: the visitor must land on the store that can actually sell to them, the link must
 * be marked as what it is, and a tag must appear only where one is configured. The store choice
 * is pure, so it is tested with the browser values passed in.
 */
import { describe, expect, it } from "vitest";
import { bookUrl, inferStore, STORES } from "@/lib/affiliate/stores";

describe("inferStore", () => {
  it("places visitors by timezone, with Japanese speakers always on amazon.co.jp", () => {
    expect(inferStore("Asia/Kolkata", ["en-IN"])).toBe("in");
    expect(inferStore("Asia/Calcutta", ["en-US"])).toBe("in");
    expect(inferStore("Asia/Tokyo", ["en-US"])).toBe("jp");
    expect(inferStore("America/New_York", ["ja-JP", "en"])).toBe("jp");
    expect(inferStore("America/New_York", ["en-US"])).toBe("us");
    expect(inferStore("America/Toronto", ["en-CA"])).toBe("us"); // no Canadian store yet; amazon.com ships there
    expect(inferStore("Europe/Berlin", ["de"])).toBe("us");
  });

  it("uses language for India when the timezone is unknown", () => {
    expect(inferStore(undefined, ["hi-IN"])).toBe("in");
    expect(inferStore("", ["en-IN"])).toBe("in");
    expect(inferStore(undefined, undefined)).toBe("us");
  });
});

describe("bookUrl", () => {
  const noTag = { ...STORES.us, tag: null };
  const tagged = { ...STORES.in, tag: "nihongopath-21" };

  it("builds a search for the exact edition when there is no verified ASIN", () => {
    const u = new URL(bookUrl({ query: "Genki I 3rd edition" }, noTag));
    expect(u.hostname).toBe("www.amazon.com");
    expect(u.pathname).toBe("/s");
    expect(u.searchParams.get("k")).toBe("Genki I 3rd edition");
    expect(u.searchParams.has("tag")).toBe(false);
  });

  it("builds a product page when an ASIN is known", () => {
    const u = new URL(bookUrl({ asin: "4789017303" }, noTag));
    expect(u.pathname).toBe("/dp/4789017303");
  });

  it("adds the tag only for a store that has one", () => {
    expect(new URL(bookUrl({ query: "x" }, tagged)).searchParams.get("tag")).toBe("nihongopath-21");
    expect(new URL(bookUrl({ query: "x" }, noTag)).searchParams.get("tag")).toBeNull();
  });

  it("encodes Japanese queries so the link survives copy and paste", () => {
    const u = bookUrl({ query: "みんなの日本語 初級I" }, { ...STORES.jp, tag: null });
    expect(u.startsWith("https://www.amazon.co.jp/s?k=")).toBe(true);
    expect(u).not.toMatch(/[ぁ-ん]/);
  });
});
