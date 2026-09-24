/**
 * Build the mock exams out of the course's own question bank.
 *
 *   node scripts/generate-exams.mjs
 *
 * The exams used to be authored separately from the study material, so only about a quarter of
 * what they tested was taught anywhere in the course — and at N1 it was one question in six. A
 * mock exam that tests unseen words measures nothing a learner can act on. Every question an
 * exam now contains is drawn from that level's own pool and carries a tag back to the word,
 * kanji or grammar point it tests.
 *
 * Section shapes, timings and question counts are kept exactly as they were, because they follow
 * the real exam. Only the contents change.
 *
 * Draws are deterministic: the same seed gives the same paper every run. Within a level the
 * three papers never share a question, except in listening where the pool is smaller than three
 * full papers; there a question may appear in another paper but never twice in the same one.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT = path.join(web, "content");
const LEVELS = ["n5", "n4", "n3", "n2", "n1"];

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
function shuffled(arr, rnd) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ---- the bank ----
const all = [];
for (const f of fs.readdirSync(path.join(CONTENT, "questions")))
  all.push(...JSON.parse(fs.readFileSync(path.join(CONTENT, "questions", f), "utf8")));
const byId = new Map(all.map((q) => [q.id, q]));

// Where each item is taught, so a paper can refuse to test something the learner has not met.
const ORD = { n5: 1, n4: 2, n3: 3, n2: 4, n1: 5 };
const levelOfItem = new Map();
for (const lv of LEVELS) {
  for (const k of JSON.parse(fs.readFileSync(path.join(CONTENT, lv, "kanji.json"), "utf8"))) levelOfItem.set(k.id, lv);
  for (const v of JSON.parse(fs.readFileSync(path.join(CONTENT, lv, "vocabulary.json"), "utf8"))) levelOfItem.set(v.id, lv);
  const g = path.join(CONTENT, lv, "grammar-base.json");
  if (fs.existsSync(g)) for (const x of JSON.parse(fs.readFileSync(g, "utf8"))) levelOfItem.set(x.id, lv);
}

const refsOf = (q) => { const t = q.tags ?? {}; return [...(t.vocabIds ?? []), ...(t.kanjiIds ?? []), ...(t.grammarIds ?? [])]; };

// Eligible means: tied to something the course teaches, and taught at or below this paper's
// level. Re-bucketing moved items between levels, so a question authored for N2 can end up
// testing a word that is now N1 — that question belongs in an N1 paper, not an N2 one.
const taughtAtOrBelow = (q, lv) => {
  const refs = refsOf(q);
  if (!refs.length) return false;
  return refs.every((r) => { const l = levelOfItem.get(r); return l != null && ORD[l] <= ORD[lv]; });
};

const pools = {};
for (const lv of LEVELS) {
  const mine = all.filter((q) => q.level === lv && taughtAtOrBelow(q, lv));
  pools[lv] = {
    language: mine.filter((q) => ["kanji", "vocabulary"].includes(q.skill)),
    grammar: mine.filter((q) => q.skill === "grammar"),
    reading: all.filter((q) => q.level === lv && q.skill === "reading"),
    listening: all.filter((q) => q.level === lv && q.skill === "listening"),
  };
}

// A section asks for a skill; map that to the pools it may draw from.
const sourcesFor = (sectionId, skill) => {
  if (skill === "reading") return ["reading"];
  if (skill === "listening") return ["listening"];
  if (/bunpo/.test(sectionId) && !/moji/.test(sectionId)) return ["grammar"];
  if (/moji/.test(sectionId) && /bunpo/.test(sectionId)) return ["language", "grammar"];
  return ["language"];
};

let report = [];
for (const lv of LEVELS) {
  const used = { language: new Set(), grammar: new Set(), reading: new Set(), listening: new Set() };
  for (const letter of ["a", "b", "c"]) {
    const file = path.join(CONTENT, "exams", `${lv}-mock-${letter}.json`);
    if (!fs.existsSync(file)) continue;
    const exam = JSON.parse(fs.readFileSync(file, "utf8"));
    const rnd = mulberry32(hash(`${exam.id}-from-material`));
    let drawn = 0, reused = 0;
    // A paper must not be passable by always clicking the same option, so the draw keeps the
    // correct answer spread across the option positions rather than leaving it to chance.
    const keyCount = [0, 0, 0, 0, 0, 0];
    const leastUsedFirst = (list) => [...list].sort((a, b) => (keyCount[a.answerIndex] ?? 0) - (keyCount[b.answerIndex] ?? 0));

    for (const section of exam.sections) {
      const want = section.questionIds.length;
      const srcs = sourcesFor(section.id, section.skill);
      const picked = [];
      const seenHere = new Set();
      // First pass: questions no paper at this level has used yet.
      for (const src of srcs) {
        while (picked.length < want) {
          const cands = shuffled(pools[lv][src], rnd).filter((q) => !used[src].has(q.id) && !seenHere.has(q.id));
          if (!cands.length) break;
          const q = leastUsedFirst(cands)[0];
          picked.push(q.id); seenHere.add(q.id); used[src].add(q.id); keyCount[q.answerIndex]++;
        }
      }
      // Second pass: the pool is smaller than three papers, so allow a question already used in
      // another paper — never one already in this one.
      for (const src of srcs) {
        while (picked.length < want) {
          const cands = shuffled(pools[lv][src], rnd).filter((q) => !seenHere.has(q.id));
          if (!cands.length) break;
          const q = leastUsedFirst(cands)[0];
          picked.push(q.id); seenHere.add(q.id); keyCount[q.answerIndex]++; reused++;
        }
      }
      drawn += picked.length;
      if (picked.length < want) report.push(`  ${exam.id}/${section.id}: wanted ${want}, pool gave ${picked.length}`);
      section.questionIds = picked;
    }
    fs.writeFileSync(file, JSON.stringify(exam, null, 2) + "\n", "utf8");
    console.log(`${exam.id}: ${drawn} questions drawn from the course${reused ? `, ${reused} shared with another paper` : ""}`);
  }
}
if (report.length) { console.log("\nsections the pool could not fill:"); report.forEach((r) => console.log(r)); }
