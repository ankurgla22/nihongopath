import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CurriculumSchema, type Curriculum } from "@/lib/content/schemas";
import { phaseOf } from "@/lib/study/service";
import { USER_SUBCOLLECTIONS } from "@/lib/firestore/collections";

const ROOT = path.join(__dirname, "..");
const curriculum: Curriculum = CurriculumSchema.parse(JSON.parse(fs.readFileSync(path.join(ROOT, "content", "curriculum", "curriculum.json"), "utf8")));

describe("phaseOf matches the generated curriculum", () => {
  // phaseOf hard-codes the phase boundaries so it can run without loading the curriculum.
  // If the generator's phases change and this copy does not, a learner's stored currentPhase
  // silently stops matching their day. This test is the link between the two.
  it("agrees with curriculum.json for every day", () => {
    const mismatches = curriculum.days.filter((d) => phaseOf(d.day) !== d.phase).map((d) => `day ${d.day}: phaseOf=${phaseOf(d.day)} curriculum=${d.phase}`);
    expect(mismatches).toEqual([]);
  });

  it("clamps days beyond the plan to the last phase", () => {
    const last = curriculum.phases[curriculum.phases.length - 1];
    expect(phaseOf(last.endDay + 50)).toBe(last.id);
  });
});

describe("account reset and delete cover every subcollection", () => {
  // reset and delete iterate USER_SUBCOLLECTIONS. A subcollection added to the repository but
  // not to that list would silently survive a "delete my account", which the privacy policy
  // says removes everything.
  it("lists exactly the subcollections the repository writes to", () => {
    const repo = fs.readFileSync(path.join(ROOT, "src", "lib", "firestore", "repo.ts"), "utf8");
    const used = new Set([...repo.matchAll(/sub\(\s*uid\s*,\s*"([a-zA-Z]+)"\s*\)/g)].map((m) => m[1]));
    expect(used.size).toBeGreaterThan(0);
    expect([...used].sort()).toEqual([...USER_SUBCOLLECTIONS].sort());
  });
});
