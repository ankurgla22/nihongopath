/**
 * Sign-in links from public pages must all point at ONE URL. With `/login?next=<page>` every
 * lesson produced its own blocked URL and Search Console counted 2,352 of them. The return path
 * now rides in the fragment, which crawlers discard. This pins both halves: the links are built
 * that way, and the login page can read the fragment back.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { nextFromHash, safeNext } from "@/components/auth/sessionClient";

const src = (rel: string) => fs.readFileSync(path.join(__dirname, "..", "src", rel), "utf8");

describe("sign-in links on public pages", () => {
  it("carry the return path in the fragment, never the query string", () => {
    for (const rel of ["components/content/MarkComplete.tsx", "components/content/SaveButton.tsx"]) {
      const s = src(rel);
      expect(s, rel).toContain("/login#next=");
      expect(s, rel).not.toContain("/login?next=");
    }
  });
});

describe("nextFromHash", () => {
  const withHash = (hash: string) => {
    const w = globalThis as unknown as { window?: { location: { hash: string } } };
    const prev = w.window;
    w.window = { location: { hash } };
    try {
      return nextFromHash();
    } finally {
      if (prev === undefined) delete w.window;
      else w.window = prev;
    }
  };

  it("reads an encoded path back out of the fragment", () => {
    expect(withHash("#next=%2Fjapanese%2Fn5%2Fgrammar%2Fdesu")).toBe("/japanese/n5/grammar/desu");
  });

  it("returns null for no fragment, another fragment, or a broken encoding", () => {
    expect(withHash("")).toBeNull();
    expect(withHash("#books")).toBeNull();
    expect(withHash("#next=%E0%A4%A")).toBeNull();
  });

  it("still goes through safeNext, so the fragment cannot send anyone off-site", () => {
    expect(safeNext(withHash("#next=https%3A%2F%2Fevil.example"))).toBe("/dashboard");
    expect(safeNext(withHash("#next=%2F%2Fevil.example"))).toBe("/dashboard");
    expect(safeNext(withHash("#next=%2Fprogress"))).toBe("/progress");
  });
});
