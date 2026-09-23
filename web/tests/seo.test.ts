import { describe, expect, it } from "vitest";
import { clampDescription } from "@/lib/seo/metadata";
import { DESCRIPTION_MAX } from "@/lib/seo/site";

describe("clampDescription", () => {
  it("leaves a short description untouched", () => {
    const s = "Short and already within budget.";
    expect(clampDescription(s)).toBe(s);
  });

  it("normalises whitespace", () => {
    expect(clampDescription("a  b\n c ")).toBe("a b c");
  });

  it("never exceeds the limit", () => {
    const long = "word ".repeat(200);
    expect(clampDescription(long).length).toBeLessThanOrEqual(DESCRIPTION_MAX);
  });

  it("stays within the limit at every input length and word alignment", () => {
    // A single off-by-one only shows up at particular alignments of the last space,
    // so sweep both the input length and the word width instead of testing one string.
    for (const width of [3, 4, 5, 7, 11]) {
      const unit = `${"x".repeat(width)} `;
      for (let len = DESCRIPTION_MAX - 5; len <= DESCRIPTION_MAX + 40; len++) {
        const input = unit.repeat(Math.ceil(len / unit.length)).slice(0, len);
        const out = clampDescription(input);
        expect(out.length, `width=${width} len=${len} -> ${out.length}`).toBeLessThanOrEqual(DESCRIPTION_MAX);
      }
    }
  });

  it("prefers ending on a sentence boundary", () => {
    // First sentence ends at 120 chars, comfortably past the 60% threshold.
    const first = `${"x".repeat(118)}.`;
    const out = clampDescription(`${first} ${"y".repeat(120)}`);
    expect(out).toBe(first);
  });

  it("falls back to a word boundary with an ellipsis", () => {
    const out = clampDescription(`${"alpha ".repeat(60)}`);
    expect(out.endsWith("…")).toBe(true);
    // The cut must land between words, never inside one.
    expect(out.replace("…", "").endsWith("alpha")).toBe(true);
  });

  it("does not leave dangling punctuation before the ellipsis", () => {
    const out = clampDescription(`${"beta, ".repeat(60)}`);
    expect(out).not.toMatch(/[,;:.\s]…$/);
  });

  it("clamps a real over-length lesson description", () => {
    const real =
      'です means "to be; is". Learn how it is formed, when Japanese people use it, natural example sentences, common mistakes and JLPT N5 tips for the exam itself.';
    const out = clampDescription(real);
    expect(out.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
  });
});
