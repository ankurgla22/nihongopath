/**
 * Report vocabulary entries that teach a rare or archaic reading of their headword.
 *
 *   node --max-old-space-size=4096 scripts/check-readings.mjs
 *
 * Every reading in the course matches JMdict — but "matches JMdict" only means the reading exists,
 * not that it is the one a learner needs. The imported list gave 仲人 as ちゅうにん, 掌 as たなごころ,
 * 三味線 as さみせん and 伝言 as つてごと: all real, all readings the JLPT would mark wrong. A learner
 * has no way to tell, because the entry looks exactly like a correct one.
 *
 * So this compares against what JMdict marks *common* for the same spelling, and flags an entry
 * whose reading is tagged rare, or is uncommon while a common alternative exists.
 *
 * Three entries are expected to be listed and are correct as they stand; they are named below.
 * Anything else is a defect. Needs .enrich/ref (scripts/fetch-references.mjs).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const REF = path.join(web, ".enrich", "ref");
const LEVELS = ["n5", "n4", "n3", "n2", "n1"];

// Readings that are right despite looking wrong to the rule above.
const EXPECTED = {
  "n3-vocab-144": "描く/かく is the ordinary reading for drawing; えがく is the literary one",
  "n2-vocab-22087": "片仮名/かたかな — JMdict writes the same reading in katakana",
  "n1-vocab-14253": "経緯/いきさつ — the entry means the sequence of events, which is the いきさつ word",
};

const jmFile = fs.readdirSync(REF).find((f) => /^jmdict-eng.*\.json$/.test(f));
if (!jmFile) { console.error("no JMdict in .enrich/ref — run scripts/fetch-references.mjs"); process.exit(2); }
const jm = JSON.parse(fs.readFileSync(path.join(REF, jmFile), "utf8"));

const byWord = new Map();
for (const w of jm.words) {
  const kana = w.kana ?? [];
  if (!kana.length) continue;
  for (const k of (w.kanji ?? []).filter((k) => !(k.tags ?? []).some((t) => ["rK", "oK", "iK", "sK", "ateji"].includes(t)))) {
    if (byWord.has(k.text)) continue;
    byWord.set(k.text, kana.map((r) => ({ t: r.text, rare: (r.tags ?? []).some((x) => ["rk", "ok", "ik", "sk"].includes(x)), common: !!r.common })));
  }
}

const found = [];
for (const lv of LEVELS)
  for (const v of JSON.parse(fs.readFileSync(path.join(web, "content", lv, "vocabulary.json"), "utf8"))) {
    const set = byWord.get(v.word);
    if (!set || set.length < 2) continue;
    const hit = set.find((r) => r.t === v.reading);
    if (!hit) continue;                                   // an unknown reading is scripts/verify-content.mjs's job
    if (!hit.rare && !(set.some((r) => r.common) && !hit.common)) continue;
    const common = set.filter((r) => r.common).map((r) => r.t).join("/") || "-";
    found.push({ lv, v, hit, common });
  }

const bad = found.filter((f) => !EXPECTED[f.v.id]);
for (const f of found)
  console.log(`  ${EXPECTED[f.v.id] ? "ok  " : "BAD "} ${f.lv} ${f.v.id} ${f.v.word} taught=${f.v.reading}${f.hit.rare ? " (tagged rare)" : ""} common=${f.common}${EXPECTED[f.v.id] ? ` — ${EXPECTED[f.v.id]}` : ""}`);
console.log(`\n${bad.length} entr${bad.length === 1 ? "y teaches" : "ies teach"} a reading the exam would mark wrong.`);
process.exit(bad.length ? 1 : 0);
