import { describe, expect, it } from "vitest";
import { jsonLdString } from "./JsonLd";

describe("jsonLdString", () => {
  it("escapes characters that could close the <script> tag and stays valid JSON", () => {
    const out = jsonLdString({ name: "</script><b>&</b>", note: "line\u2028break\u2029end" });
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    expect(out).not.toContain("&");
    expect(out).not.toContain("\u2028");
    expect(out).not.toContain("\u2029");
    expect(out).toContain("\\u003c/script\\u003e");
    expect(JSON.parse(out)).toEqual({ name: "</script><b>&</b>", note: "line\u2028break\u2029end" });
  });
});
