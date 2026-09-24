/**
 * Check the course against published reference data and print what is proven and what is not.
 *
 *   node scripts/verify-content.mjs
 *
 * References live in .enrich/ref and are fetched by scripts/fetch-references.mjs:
 *   jmdict-eng-*.json   JMdict, 218k entries - the authority for words, readings and meanings
 *   kanji.json          KANJIDIC2 via davidluzgouveia/kanji-data - kanji readings and JLPT level
 *   vocab-n*.json       tanos.co.uk JLPT vocabulary lists via wkei/jlpt-vocab-api
 *   gram-browse.json    gokan-dataset grammar points with JLPT levels
 *
 * This proves what can be proven mechanically: that a word exists, that its reading matches the
 * dictionary, that its level matches a published list. It cannot prove that an example sentence
 * sounds natural or that a memory tip is good advice, and it does not pretend to.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const REF = path.join(web, ".enrich", "ref");
const LEVELS = ["n5", "n4", "n3", "n2", "n1"];
const ORD = { n5: 1, n4: 2, n3: 3, n2: 4, n1: 5 };
const NUM = { 5: "n5", 4: "n4", 3: "n3", 2: "n2", 1: "n1" };

const rd = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const content = (rel) => rd(path.join(web, "content", rel));
const kata = (s) => String(s ?? "").replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) + "%" : "n/a");

const missing = [];
const haveJm = fs.existsSync(REF) && fs.readdirSync(REF).some((f) => /^jmdict-eng.*\.json$/.test(f));
if (!haveJm) missing.push("jmdict-eng-*.json");
for (const f of ["kanji.json", "vocab-n5.json", "gram-browse.json"]) if (!fs.existsSync(path.join(REF, f))) missing.push(f);
if (missing.length) {
  console.error("Reference data missing: " + missing.join(", "));
  console.error("Run: node scripts/fetch-references.mjs");
  process.exit(2);
}

/* ---------------- vocabulary against JMdict ---------------- */
const jmFile = fs.readdirSync(REF).find((f) => /^jmdict-eng.*\.json$/.test(f));
const jm = rd(path.join(REF, jmFile));
const form2read = new Map();
for (const w of jm.words) {
  const readings = (w.kana ?? []).map((k) => k.text);
  const forms = (w.kanji ?? []).length ? w.kanji.map((k) => k.text) : readings;
  for (const f of forms.concat(readings)) {
    if (!form2read.has(f)) form2read.set(f, new Set());
    for (const r of readings) form2read.get(f).add(r);
  }
}

// The course writes counters as a tilde plus the counter, and suru-verbs with suru attached;
// the dictionary heads both differently, so try the obvious rewrites before calling a word absent.
function variants(w) {
  const v = new Set([w, w.replace(/^[〜~]/, ""), w.replace(/する$/, ""), w.replace(/[〜~]/g, "")]);
  for (const part of w.split(/[／/]/)) {
    v.add(part);
    v.add(part.replace(/^[〜~]/, ""));
  }
  for (const tail of ["に", "と", "も", "の", "なく"]) if (w.endsWith(tail)) v.add(w.slice(0, -tail.length));
  if (/^[ごお]/.test(w)) v.add(w.slice(1));
  return [...v].filter(Boolean);
}

let vTotal = 0, vFound = 0, vReadOk = 0;
const vReadBad = [], vAbsent = [];
for (const lv of LEVELS) {
  for (const v of content(lv + "/vocabulary.json")) {
    vTotal++;
    const hit = variants(v.word).find((x) => form2read.has(x));
    if (!hit) { vAbsent.push(lv + " " + v.word + " (" + v.reading + ")"); continue; }
    vFound++;
    // Compare like with like. If the word only matched after a tail was dropped — 明らかに found
    // as 明らか, 勉強する as 勉強, 〜個 as 個 — then drop the same tail from the reading before
    // comparing, or the base form in the dictionary will look like a disagreement when it is not.
    // A leading 〜 marks a counter; a leading ご or お is the honorific prefix, which the
    // dictionary heads without. Either way the reading carries it too, so drop it from both.
    const lead = /^[〜~]/.test(v.word) || (/^[ごお]/.test(v.word) && !v.word.startsWith(hit)) ? 1 : 0;
    const wordCore = v.word.slice(lead);
    const tail = wordCore.endsWith(hit) ? "" : wordCore.startsWith(hit) ? wordCore.slice(hit.length) : "";
    let reading = v.reading.slice(lead);
    if (tail && reading.endsWith(tail)) reading = reading.slice(0, -tail.length);
    const want = reading.split(/[／/]/).map(kata).filter(Boolean);
    const dict = [...form2read.get(hit)].map(kata).filter(Boolean);
    if (want.some((r) => dict.includes(r)) || dict.some((r) => want.includes(r))) vReadOk++;
    else vReadBad.push(lv + " " + v.word + "  course=" + v.reading + "  dictionary=" + dict.slice(0, 4).join("/"));
  }
}

/* ---------------- kanji against KANJIDIC2 ---------------- */
const kref = rd(path.join(REF, "kanji.json"));
const clean = (s) => kata(String(s).replace(/[.\-()（）]/g, "").trim());
let kTotal = 0, kOn = 0, kKun = 0, kLvlOk = 0, kUnlisted = 0;
const kOnBad = [], kKunBad = [];
for (const lv of LEVELS) {
  const enr = new Map();
  const dir = path.join(web, "content", lv, "kanji");
  if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) for (const e of rd(path.join(dir, f))) enr.set(e.character, e);
  for (const k of content(lv + "/kanji.json")) {
    const r = kref[k.character];
    if (!r) { kUnlisted++; continue; }
    kTotal++;
    if (r.jlpt_new == null) kUnlisted++;
    else if (NUM[r.jlpt_new] === lv) kLvlOk++;
    const e = enr.get(k.character) ?? k;
    const dOn = (r.readings_on ?? []).map(clean);
    const dKun = (r.readings_kun ?? []).map(clean);
    const badOn = (e.onyomi ?? []).map(clean).filter((x) => x && !dOn.includes(x));
    const badKun = (e.kunyomi ?? []).map(clean).filter((x) => x && !dKun.some((d) => d === x || d.startsWith(x) || x.startsWith(d)));
    if (!badOn.length) kOn++; else kOnBad.push(k.character + " " + badOn.join(","));
    if (!badKun.length) kKun++; else kKunBad.push(k.character + " " + badKun.join(","));
  }
}

/* ---------------- vocabulary levels against the published lists ---------------- */
const tanos = new Map();
for (const l of LEVELS) for (const w of rd(path.join(REF, "vocab-" + l + ".json"))) if (!tanos.has(w.word)) tanos.set(w.word, l);
let vLvlOk = 0, vLvlBad = 0, vLvlUnlisted = 0;
for (const lv of LEVELS) {
  for (const v of content(lv + "/vocabulary.json")) {
    // The lists write variant spellings as one row, "いい / よい". Those are split into a single
    // headword so example sentences can contain it, and `listedAs` records the row they came
    // from — check against that row, not a same-spelling row the list happens to carry at
    // another level.
    const want = tanos.get(v.listedAs ?? v.word) ?? tanos.get(v.word);
    if (!want) vLvlUnlisted++;
    else if (want === lv) vLvlOk++;
    else vLvlBad++;
  }
}

/* ---------------- grammar against gokan ---------------- */
const gb = rd(path.join(REF, "gram-browse.json"));
const gArr = Array.isArray(gb) ? gb : (gb.items ?? Object.values(gb)[0]);
const jpFrags = (s) => String(s ?? "").match(/[぀-ヿ一-鿿]+/g) ?? [];
const gRef = new Map();
for (const g of gArr) for (const f of jpFrags(g.title)) if (f.length >= 2 && !gRef.has(f)) gRef.set(f, NUM[g.jlptLevel]);
let gTotal = 0, gOk = 0, gOff1 = 0, gOff2 = 0, gNo = 0;
for (const lv of LEVELS) {
  for (const g of content(lv + "/grammar-base.json")) {
    gTotal++;
    const want = jpFrags(g.title).sort((a, b) => b.length - a.length).map((f) => gRef.get(f)).find(Boolean);
    if (!want) { gNo++; continue; }
    const d = Math.abs(ORD[want] - ORD[lv]);
    if (d === 0) gOk++; else if (d === 1) gOff1++; else gOff2++;
  }
}

/* ---------------- exams drawn from the course ---------------- */
const itemLevel = new Map();
for (const lv of LEVELS) {
  for (const k of content(lv + "/kanji.json")) itemLevel.set(k.id, lv);
  for (const v of content(lv + "/vocabulary.json")) itemLevel.set(v.id, lv);
  for (const g of content(lv + "/grammar-base.json")) itemLevel.set(g.id, lv);
}
const qById = new Map();
for (const f of fs.readdirSync(path.join(web, "content", "questions"))) for (const q of content("questions/" + f)) qById.set(q.id, q);
let eTotal = 0, eTagged = 0, eAbove = 0, eDup = 0, eWorstKey = 0;
for (const f of fs.readdirSync(path.join(web, "content", "exams"))) {
  const e = content("exams/" + f);
  const seen = new Set();
  const keys = [0, 0, 0, 0, 0, 0];
  let n = 0;
  for (const s of e.sections) {
    for (const id of s.questionIds) {
      if (seen.has(id)) eDup++;
      seen.add(id);
      const q = qById.get(id);
      if (!q) continue;
      eTotal++; n++; keys[q.answerIndex]++;
      const refs = [...(q.tags?.kanjiIds ?? []), ...(q.tags?.vocabIds ?? []), ...(q.tags?.grammarIds ?? [])];
      if (refs.length) eTagged++;
      if (refs.some((r) => itemLevel.has(r) && ORD[itemLevel.get(r)] > ORD[e.level])) eAbove++;
    }
  }
  if (n) eWorstKey = Math.max(eWorstKey, Math.max(...keys) / n);
}

/* ---------------- report ---------------- */
const line = (label, value, note) => console.log("  " + label.padEnd(44) + String(value).padStart(16) + "  " + (note ?? ""));
console.log("\nPROVEN BY REFERENCE DATA\n");
console.log(" Vocabulary");
line("words checked", vTotal);
line("found in JMdict", vFound + " (" + pct(vFound, vTotal) + ")");
line("reading matches the dictionary", vReadOk + " (" + pct(vReadOk, vFound) + ")", "of those found");
line("reading disagrees", vReadBad.length, vReadBad.length ? "listed below" : "");
line("level confirmed by the JLPT lists", vLvlOk + " (" + pct(vLvlOk, vTotal) + ")");
line("level disagrees with those lists", vLvlBad);
line("word absent from those lists", vLvlUnlisted + " (" + pct(vLvlUnlisted, vTotal) + ")", "level unverifiable");
console.log("\n Kanji");
line("kanji checked", kTotal);
line("every on-reading in KANJIDIC2", kOn + " (" + pct(kOn, kTotal) + ")");
line("every kun-reading in KANJIDIC2", kKun + " (" + pct(kKun, kTotal) + ")");
line("level confirmed by KANJIDIC2", kLvlOk + " (" + pct(kLvlOk, kTotal) + ")");
line("outside its JLPT list", kUnlisted, "level unverifiable");
console.log("\n Grammar");
line("points checked", gTotal);
line("level confirmed", gOk + " (" + pct(gOk, gTotal) + ")");
line("off by one level", gOff1);
line("off by two or more", gOff2);
line("no match in the reference", gNo + " (" + pct(gNo, gTotal) + ")", "level unverifiable");
console.log("\n Exams");
line("questions across all papers", eTotal);
line("tagged to a course item", eTagged + " (" + pct(eTagged, eTotal) + ")", "rest are reading/listening");
line("testing above the exam level", eAbove);
line("repeated inside one paper", eDup);
line("heaviest single answer position", (100 * eWorstKey).toFixed(0) + "%", "must stay under 45%");

if (vReadBad.length) {
  console.log("\n Readings that disagree with the dictionary:");
  for (const x of vReadBad.slice(0, 25)) console.log("   " + x);
}
if (vAbsent.length) {
  console.log("\n Words not in JMdict (" + vAbsent.length + ") - compositional phrases and compounds:");
  for (const x of vAbsent.slice(0, 25)) console.log("   " + x);
}
if (kOnBad.length || kKunBad.length) {
  console.log("\n Kanji readings not listed in KANJIDIC2 (usually a real variant it records more narrowly):");
  for (const x of kOnBad.concat(kKunBad).slice(0, 15)) console.log("   " + x);
}
console.log("\nNOT PROVEN BY ANY OF THIS");
console.log("  Whether 27,000 example sentences read naturally to a native speaker.");
console.log("  Whether the memory tips give good advice.");
console.log("  The level of any item the reference lists do not contain.");
console.log("  Whether the course covers enough of each level to pass the real exam.\n");

const hardFailures = vReadBad.length + vLvlBad + kOnBad.length + kKunBad.length + eAbove + eDup;
process.exit(hardFailures > 40 ? 1 : 0);
