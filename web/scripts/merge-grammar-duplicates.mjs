/**
 * Merge grammar points that the syllabus teaches twice at different levels.
 *
 *   node scripts/merge-grammar-duplicates.mjs [--dry]
 *
 * 60 patterns were full lessons at two levels, and a few at three: 〜うちに was taught at N3 and
 * again at N2 with the same meaning, the same formation and reworded examples; 〜っぱなし three
 * times. That is ~9% of the grammar syllabus spent teaching something the learner has already had.
 *
 * The decisions live in .enrich/grammar/decisions.json, written by a reviewer that read every pair:
 * either "merge" (one lesson survives, at the level where the learner first meets the pattern) or
 * "distinct" (the surface forms coincide but the senses differ, so both stay and both get a
 * disambiguating title).
 *
 * The delicate part is not the lessons but the 8,789 references to their ids, spread over 729 files
 * — curriculum days, question tags, the enriched overlays and lastmod. A removed id is repointed at
 * the surviving one rather than dropped, so a study day or an exam question that taught 〜うちに
 * still teaches it; it now points at the single remaining lesson. Arrays are de-duplicated after
 * repointing, because a day that listed both copies would otherwise list the survivor twice.
 *
 * Because an id encodes its level (n3-grammar-1), the surviving lesson never moves file: the
 * reviewer picks a keepId that already sits at the level it should be taught.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry");
const LEVELS = ["n5", "n4", "n3", "n2", "n1"];
const rd = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const wr = (p, v) => { if (!DRY) fs.writeFileSync(p, JSON.stringify(v, null, 2) + "\n", "utf8"); };

const GRAMMAR_ID = /^n[12345]-grammar-\d+$/;

const decisions = rd(path.join(web, ".enrich", "grammar", "decisions.json"));

// ---- validate the decisions before touching a byte ----
const base = {};
const byId = new Map();
for (const lv of LEVELS) {
  base[lv] = rd(path.join(web, "content", lv, "grammar-base.json"));
  for (const g of base[lv]) byId.set(g.id, { lv, g });
}
const problems = [];
const remove = new Map();               // removedId -> keepId
const seen = new Set();
for (const d of decisions) {
  if (d.action === "merge") {
    if (!byId.has(d.keepId)) problems.push(`${d.pattern}: keepId ${d.keepId} does not exist`);
    if (byId.get(d.keepId)?.lv !== d.keepLevel) problems.push(`${d.pattern}: keepId ${d.keepId} is not in ${d.keepLevel}`);
    for (const r of d.removeIds ?? []) {
      if (!byId.has(r)) problems.push(`${d.pattern}: removeId ${r} does not exist`);
      if (r === d.keepId) problems.push(`${d.pattern}: ${r} is both kept and removed`);
      if (seen.has(r)) problems.push(`${d.pattern}: ${r} removed twice`);
      seen.add(r);
      remove.set(r, d.keepId);
    }
  } else if (d.action === "distinct") {
    for (const t of d.retitle ?? []) if (!byId.has(t.id)) problems.push(`${d.pattern}: retitle id ${t.id} does not exist`);
  } else problems.push(`${d.pattern}: unknown action ${d.action}`);
}
for (const k of remove.values()) if (remove.has(k)) problems.push(`${k} is kept by one group and removed by another`);
if (problems.length) { console.error("decisions.json is not applicable:\n  " + problems.join("\n  ")); process.exit(1); }

// ---- merge the teaching content into the surviving lesson, and absorb its question ids ----
// The overlay file is not named after the slug — the slug carries a leading order number
// ("61-amari-zenzen-negative") and the file does not ("amari-zenzen-negative.json"). Guessing the
// name silently found nothing, which would have left every surviving lesson showing its stale
// overlay, so the index is built by reading what is actually there.
const overlayIndex = new Map();
for (const lv of LEVELS) {
  const dir = path.join(web, "content", lv, "grammar");
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    const p = path.join(dir, f);
    overlayIndex.set(rd(p).id, p);
  }
}
const overlayPath = (lv, slug, id) => overlayIndex.get(id) ?? path.join(web, "content", lv, "grammar", `${slug}.json`);
let mergedCount = 0, retitled = 0;
for (const d of decisions) {
  if (d.action === "distinct") {
    for (const t of d.retitle ?? []) {
      const { lv, g } = byId.get(t.id);
      g.title = t.title;
      const op = overlayPath(lv, g.slug, g.id);
      if (fs.existsSync(op)) { const o = rd(op); o.title = t.title; wr(op, o); }
      retitled++;
    }
    continue;
  }
  const keep = byId.get(d.keepId);
  const gone = (d.removeIds ?? []).map((r) => byId.get(r));
  // The survivor takes the reviewer's merged teaching fields and the union of both lessons'
  // question ids, so no practice question is orphaned by the removal.
  const apply = (target) => {
    if (d.merged) for (const f of ["title", "meaning", "simpleExplanation", "whenUsed", "formation", "examples"])
      if (d.merged[f] !== undefined) target[f] = d.merged[f];
    for (const f of ["practiceQuestionIds", "jlptQuestionIds"]) {
      const all = [target[f] ?? [], ...gone.map((x) => x.g[f] ?? [])].flat();
      target[f] = [...new Set(all)];
    }
  };
  apply(keep.g);
  const op = overlayPath(keep.lv, keep.g.slug, keep.g.id);
  if (fs.existsSync(op)) { const o = rd(op); apply(o); wr(op, o); }
  mergedCount++;
}

// ---- drop the removed lessons ----
let droppedOverlays = 0;
for (const lv of LEVELS) {
  const kept = base[lv].filter((g) => !remove.has(g.id));
  const dropped = base[lv].filter((g) => remove.has(g.id));
  for (const g of dropped) {
    const op = overlayPath(lv, g.slug, g.id);
    if (fs.existsSync(op)) { droppedOverlays++; if (!DRY) fs.rmSync(op); }
  }
  base[lv] = kept;
  wr(path.join(web, "content", lv, "grammar-base.json"), kept);
}

// ---- repoint every reference in content/ ----
let filesTouched = 0, refsRepointed = 0;
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (!e.name.endsWith(".json")) continue;
    const raw = fs.readFileSync(p, "utf8");
    let hit = false;
    for (const id of remove.keys()) if (raw.includes(`"${id}"`)) { hit = true; break; }
    if (!hit) continue;
    const data = JSON.parse(raw);
    let n = 0;
    const fix = (v) => {
      if (Array.isArray(v)) {
        for (let i = 0; i < v.length; i++) {
          if (typeof v[i] === "string" && remove.has(v[i])) { v[i] = remove.get(v[i]); n++; }
          else fix(v[i]);
        }
        // A day or a question that referenced both copies now names the survivor twice, so id
        // lists are de-duplicated — but ONLY id lists. De-duplicating every array of strings
        // also collapsed a comparison diagram's row of cells, where two columns legitimately
        // both read "not possible", leaving the row one cell short of its header.
        if (v.length && v.every((x) => typeof x === "string" && GRAMMAR_ID.test(x))) {
          const uniq = [...new Set(v)];
          if (uniq.length !== v.length) v.splice(0, v.length, ...uniq);
        }
      } else if (v && typeof v === "object") {
        for (const k of Object.keys(v)) {
          if (typeof v[k] === "string" && remove.has(v[k])) { v[k] = remove.get(v[k]); n++; }
          else fix(v[k]);
        }
      }
    };
    fix(data);
    // lastmod is keyed by id, so a removed key has to go rather than be repointed.
    if (path.basename(p) === "lastmod.json" && !Array.isArray(data)) {
      for (const id of remove.keys()) if (id in data) { delete data[id]; n++; }
    }
    if (n) { wr(p, data); filesTouched++; refsRepointed += n; }
  }
};
walk(path.join(web, "content"));

console.log(`${mergedCount} merged, ${retitled} retitled`);
console.log(`${remove.size} lessons removed (${droppedOverlays} overlay files deleted)`);
console.log(`${refsRepointed} references repointed across ${filesTouched} files`);
const total = LEVELS.reduce((n, lv) => n + base[lv].length, 0);
console.log(`grammar lessons now: ${LEVELS.map((lv) => `${lv} ${base[lv].length}`).join(", ")} = ${total}`);
if (DRY) console.log("\n(dry run - nothing written)");
