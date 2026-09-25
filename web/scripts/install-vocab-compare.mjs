/**
 * Validate the authored vocabulary comparisons and install them.
 *
 *   node scripts/install-vocab-compare.mjs .enrich/compare/out-1.json [...]
 *
 * These pages make claims about usage rather than restating definitions, so the checks here are
 * structural — the judgement about whether a rule is *true* belongs to the author and to review.
 * What is enforced: every input group is present exactly once, slugs are unique and URL-safe, each
 * member names a word that exists in the vocabulary content, and no Japanese field has drifted into
 * English (the same failure that kept appearing during enrichment).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = process.argv.slice(2);
if (!files.length) { console.error("usage: install-vocab-compare.mjs <out.json> [...]"); process.exit(2); }

const rd = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const LEVELS = ["n5", "n4", "n3", "n2", "n1"];

// `level` is derived from the member words (the page lives under the earliest level that teaches
// one of them), so it comes from the prepared input rather than from the author, who was never
// asked for it. Joining by id here keeps that out of the authoring brief entirely.
const inputLevel = new Map();
{
  const inputPath = path.join(web, ".enrich", "compare", "input.json");
  if (fs.existsSync(inputPath)) for (const g of rd(inputPath)) inputLevel.set(g.id, g.level);
}

const words = new Set();
for (const lv of LEVELS) for (const v of rd(path.join(web, "content", lv, "vocabulary.json"))) words.add(v.word);

// Latin letters are allowed only in upper case: CD and JR are ordinary Japanese, lower-case prose
// is drift. Same rule the vocabulary enrichment settled on.
const ALLOWED = /[\u3000-\u303F\u3040-\u30FF\u31F0-\u31FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF\u0020-\u0040\u005B-\u0060\u007B-\u007E\u2010-\u2027\u2030-\u205E]/;
const foreign = (t) => { for (const ch of t || "") { if (/[A-Z]/.test(ch)) continue; if (!ALLOWED.test(ch)) return true; } return false; };

const errors = [];
const seenId = new Set();
const seenSlug = new Set();
const out = [];

for (const f of files) {
  const arr = rd(path.join(web, f));
  if (!Array.isArray(arr)) { errors.push(`${f}: not an array`); continue; }
  for (const [i, c] of arr.entries()) {
    const at = `${path.basename(f)}[${i}] ${c.id ?? "?"}`;
    if (!c.level) c.level = inputLevel.get(c.id);
    for (const field of ["id", "slug", "level", "title", "quickAnswer", "summary"])
      if (!c[field] || typeof c[field] !== "string") errors.push(`${at}: ${field} missing`);
    if (c.slug && !/^[a-z0-9-]+$/.test(c.slug)) errors.push(`${at}: slug "${c.slug}" is not url-safe`);
    if (c.level && !LEVELS.includes(c.level)) errors.push(`${at}: level "${c.level}" is not a level`);
    if (seenId.has(c.id)) errors.push(`${at}: duplicate id`);
    if (seenSlug.has(c.slug)) errors.push(`${at}: duplicate slug "${c.slug}"`);
    seenId.add(c.id); seenSlug.add(c.slug);
    if (c.summary && c.summary.length > 200) errors.push(`${at}: summary is ${c.summary.length} chars, over 200`);

    if (!Array.isArray(c.members) || c.members.length < 2) errors.push(`${at}: needs >= 2 members`);
    else for (const m of c.members) {
      if (!words.has(m.word)) errors.push(`${at}: "${m.word}" is not a word in the vocabulary content`);
      if (!m.when) errors.push(`${at}: ${m.word} has no "when" rule`);
      if (!Array.isArray(m.examples) || m.examples.length < 1) errors.push(`${at}: ${m.word} needs an example`);
      for (const e of m.examples ?? []) checkExample(at, `${m.word} example`, e);
    }
    if (!Array.isArray(c.contrast) || c.contrast.length < 2) errors.push(`${at}: needs >= 2 contrast sentences`);
    for (const e of c.contrast ?? []) checkExample(at, "contrast", e);
    for (const m of c.mistakes ?? []) if (!m.wrong || !m.right || !m.why) errors.push(`${at}: a mistake is missing wrong/right/why`);
    if (!Array.isArray(c.faq) || c.faq.length < 2) errors.push(`${at}: needs >= 2 faq entries`);
    for (const q of c.faq ?? []) if (!q.q || !q.a) errors.push(`${at}: an faq entry is missing q/a`);
    out.push(c);
  }
}

function checkExample(at, label, e) {
  if (!e?.ja || !e?.reading || !e?.en) { errors.push(`${at}: ${label} needs ja, reading and en`); return; }
  if (/[\u4E00-\u9FFF]/.test(e.reading)) errors.push(`${at}: ${label} reading has kanji in it`);
  if (foreign(e.ja)) errors.push(`${at}: ${label} ja has stray non-Japanese text`);
}

if (errors.length) {
  console.error(`${errors.length} problem(s):\n  ` + errors.slice(0, 40).join("\n  "));
  process.exit(1);
}

out.sort((a, b) => a.id.localeCompare(b.id));
fs.writeFileSync(path.join(web, "content", "vocab-compare.json"), JSON.stringify(out, null, 2) + "\n", "utf8");
const byLevel = out.reduce((m, c) => ({ ...m, [c.level]: (m[c.level] ?? 0) + 1 }), {});
console.log(`installed ${out.length} comparison pages -> content/vocab-compare.json`);
console.log(`  by level: ${Object.entries(byLevel).map(([k, v]) => `${k} ${v}`).join(", ")}`);
