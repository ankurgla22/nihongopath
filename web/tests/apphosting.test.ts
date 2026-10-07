/**
 * apphosting.yaml is read by Firebase App Hosting's preparer before any code runs, and a
 * mistake there fails the rollout with no build at all. One mistake has already cost a deploy:
 * an environment variable with `value: ""` is rejected ("either 'value' or 'secret' field is
 * required") — an empty string counts as absent. The honest way to leave a variable unset is to
 * omit it; the code treats a missing NEXT_PUBLIC_* the same as empty.
 *
 * No YAML parser in the dependencies, so this reads the file the way a reviewer would.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const file = path.join(__dirname, "..", "apphosting.yaml");
const text = fs.readFileSync(file, "utf8");
const lines = text.split(/\r?\n/);

describe("apphosting.yaml", () => {
  it("has no environment variable with an empty value (App Hosting rejects it)", () => {
    const empty = lines.map((l, i) => ({ l, n: i + 1 })).filter(({ l }) => /^\s*value:\s*(""|''|)\s*$/.test(l));
    expect(empty.map(({ n, l }) => `line ${n}: ${l.trim()}`)).toEqual([]);
  });

  it("gives every variable a value or a secret, and a BUILD/RUNTIME availability", () => {
    const vars = lines.map((l, i) => ({ l, n: i + 1 })).filter(({ l }) => /^\s*-\s*variable:/.test(l));
    const problems: string[] = [];
    for (const { n } of vars) {
      const block = lines.slice(n, n + 3).join("\n");
      if (!/^\s*(value|secret):/m.test(block)) problems.push(`line ${n}: no value or secret`);
      if (!/^\s*availability:/m.test(block)) problems.push(`line ${n}: no availability`);
    }
    expect(problems).toEqual([]);
  });

  it("carries the public config the app needs at build time", () => {
    for (const v of ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_GA_ID", "NEXT_PUBLIC_AMZ_TAG_US", "NEXT_PUBLIC_FIREBASE_PROJECT_ID"]) expect(text).toContain(`variable: ${v}`);
  });
});
