/**
 * Flag vocabulary entries whose own examples are not about the headword.
 *
 *   node scripts/check-example-readings.mjs
 *
 * This is the check that would have caught 上る. Its entry carried the reading あがる, the meaning
 * "to rise" and three 上がる sentences — the whole record was 上がる's, filed under the wrong
 * headword — and it survived enrichment because the installer's containment test strips the verb
 * ending, leaving 上, which 上がります contains.
 *
 * Kanji can hide that; kana cannot. If a word is really the subject of its examples, the examples'
 * kana readings contain the word's own reading. So this compares the entry's reading against the
 * reading of every example and reports entries where it appears in none of them.
 *
 * Deliberately skipped, because they produce noise rather than findings: readings under three kana
 * (あう inflects to あいます, past the stem), entries with two readings listed, and the する of a
 * suru-verb (勉強する appears as 勉強します).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const LEVELS = ["n5", "n4", "n3", "n2", "n1"];
const kata = (s) => s.replace(/[\u30a1-\u30f6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

/**
 * Readings that legitimately change shape inside a compound, so the stem cannot be found verbatim.
 * 遣い is read つかい alone and づかい in 言葉遣い: rendaku voices the first kana of the second
 * element. Listed rather than pattern-matched, so a new one has to be looked at and agreed.
 */
const EXPECTED = new Set(["n1-vocab-13818"]);

let checked = 0;
const flagged = [];
for (const lv of LEVELS) {
  const dir = path.join(web, "content", lv, "vocabulary");
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir))
    for (const v of JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))) {
      let r = kata(v.reading ?? "").replace(/[〜~]/g, "");
      if (/[／/]/.test(r)) continue;
      r = r.replace(/する$/, "");
      if (r.length < 3) continue;
      const examples = (v.examples ?? []).filter((e) => e.reading);
      if (!examples.length) continue;
      checked++;
      const stem = r.slice(0, -1);
      if (examples.some((e) => kata(e.reading).includes(stem))) continue;
      if (EXPECTED.has(v.id)) continue;
      flagged.push({ lv, v, example: examples[0] });
    }
}

for (const { lv, v, example } of flagged) {
  console.log(`  ${lv} ${v.id} ${v.word} (${v.reading})`);
  console.log(`      ${example.ja}`);
  console.log(`      ${example.reading}`);
}
console.log(`\n${checked} entries checked, ${flagged.length} where the examples never read the headword.`);
process.exit(flagged.length ? 1 : 0);
