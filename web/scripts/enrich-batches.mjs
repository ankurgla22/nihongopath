/**
 * Split the un-enriched vocabulary or kanji of a level into batch files for enrichment, and
 * validate + install the enriched results.
 *
 *   node scripts/enrich-batches.mjs prep <level> <vocabulary|kanji> <outDir> [batchSize]
 *       -> writes <outDir>/<level>-<kind>-NN.json, each an array of base entries still to enrich
 *   node scripts/enrich-batches.mjs install <level> <vocabulary|kanji> <file.json>
 *       -> validates the enriched array against the content schema and the enrichment rules,
 *          then writes content/<level>/<kind>/enriched-NN.json (next free number)
 *
 * Enrichment rules (what "enriched" means on this site), checked on install:
 *   vocabulary: >= 3 examples, each with ja, reading (kana) and en, and each containing the word
 *               (or its dictionary stem); >= 2 collocations; memoryTip present.
 *   kanji:      >= 3 words; >= 2 examples with reading; memoryAid present; similarKanji may be empty.
 * Fields that identify the entry (id, slug, level, order, word/character, day) must be unchanged.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const [cmd, level, kind, target, sizeArg] = process.argv.slice(2);
if (!cmd || !level || !kind || !target) {
  console.error("usage: prep <level> <vocabulary|kanji> <outDir> [batchSize] | install <level> <vocabulary|kanji> <file.json>");
  process.exit(2);
}
const key = kind === "vocabulary" ? "word" : "character";
const baseFile = path.join(web, "content", level, `${kind}.json`);
const enrichedDir = path.join(web, "content", level, kind);

function loadEnrichedKeys() {
  const keys = new Set();
  if (fs.existsSync(enrichedDir))
    for (const f of fs.readdirSync(enrichedDir))
      if (f.endsWith(".json")) for (const x of JSON.parse(fs.readFileSync(path.join(enrichedDir, f), "utf8"))) keys.add(x[key]);
  return keys;
}

if (cmd === "prep") {
  const size = Number(sizeArg || 50);
  const base = JSON.parse(fs.readFileSync(baseFile, "utf8")).sort((a, b) => a.order - b.order);
  const done = loadEnrichedKeys();
  const todo = base.filter((x) => !done.has(x[key]));
  fs.mkdirSync(target, { recursive: true });
  let n = 0;
  for (let i = 0; i < todo.length; i += size) {
    n++;
    const f = path.join(target, `${level}-${kind}-${String(n).padStart(2, "0")}.json`);
    fs.writeFileSync(f, JSON.stringify(todo.slice(i, i + size), null, 2) + "\n");
  }
  console.log(`${level} ${kind}: ${base.length} base, ${done.size} already enriched, ${todo.length} to do -> ${n} batch file(s) in ${target}`);
  process.exit(0);
}

// `validate` runs the same checks as `install` but writes nothing, so parallel workers can check
// their own output; installs are then done one at a time (the enriched-NN numbering is sequential).
if (cmd === "install" || cmd === "validate") {
  const base = new Map(JSON.parse(fs.readFileSync(baseFile, "utf8")).map((x) => [x[key], x]));
  const arr = JSON.parse(fs.readFileSync(target, "utf8"));
  if (!Array.isArray(arr) || !arr.length) throw new Error("expected a non-empty array");
  const errors = [];
  const stem = (w) => w.replace(/(する|です|ます)$/, "").replace(/[うくぐすつぬぶむる]$/, "");
  for (const [i, e] of arr.entries()) {
    const b = base.get(e[key]);
    const where = `[${i}] ${e[key] ?? "?"}`;
    if (!b) { errors.push(`${where}: not a base entry of ${level}`); continue; }
    for (const f of ["id", "slug", "level", "order", key, ...(kind === "kanji" ? ["day"] : [])]) if (e[f] !== b[f]) errors.push(`${where}: ${f} changed (${JSON.stringify(e[f])} != ${JSON.stringify(b[f])})`);
    if (kind === "vocabulary") {
      if (!e.reading || !e.pos || !e.meaning) errors.push(`${where}: reading/pos/meaning missing`);
      if (!Array.isArray(e.examples) || e.examples.length < 3) errors.push(`${where}: needs >= 3 examples`);
      else for (const [j, ex] of e.examples.entries()) {
        if (!ex.ja || !ex.en || !ex.reading) errors.push(`${where}: example ${j} needs ja, reading, en`);
        else if (/[一-龯]/.test(ex.reading)) errors.push(`${where}: example ${j} reading must be kana only`);
        const w = e.word.replace(/[〜~]/g, "");
        if (ex.ja && !ex.ja.includes(w) && !ex.ja.includes(stem(w))) errors.push(`${where}: example ${j} does not contain ${e.word}`);
      }
      if (!Array.isArray(e.collocations) || e.collocations.length < 2) errors.push(`${where}: needs >= 2 collocations`);
      if (!e.memoryTip) errors.push(`${where}: memoryTip missing`);
      for (const f of ["related", "synonyms", "antonyms", "kanjiIds"]) if (e[f] !== undefined && !Array.isArray(e[f])) errors.push(`${where}: ${f} must be an array`);
      if (e.difficulty !== undefined && !(Number.isInteger(e.difficulty) && e.difficulty >= 1 && e.difficulty <= 5)) errors.push(`${where}: difficulty 1..5`);
    } else {
      if (!Array.isArray(e.meanings) || !e.meanings.length) errors.push(`${where}: meanings missing`);
      if (!Array.isArray(e.words) || e.words.length < 3) errors.push(`${where}: needs >= 3 words`);
      else for (const [j, w] of e.words.entries()) if (!w.word || !w.reading || !w.meaning || !w.word.includes(e.character)) errors.push(`${where}: word ${j} needs word (containing ${e.character}), reading, meaning`);
      if (!Array.isArray(e.examples) || e.examples.length < 2) errors.push(`${where}: needs >= 2 examples`);
      else for (const [j, ex] of e.examples.entries()) {
        if (!ex.ja || !ex.en || !ex.reading) errors.push(`${where}: example ${j} needs ja, reading, en`);
        else if (/[一-龯]/.test(ex.reading)) errors.push(`${where}: example ${j} reading must be kana only`);
        if (ex.ja && !ex.ja.includes(e.character)) errors.push(`${where}: example ${j} does not contain ${e.character}`);
      }
      if (!e.memoryAid) errors.push(`${where}: memoryAid missing`);
      for (const f of ["onyomi", "kunyomi", "similarKanji", "commonMistakes"]) if (e[f] !== undefined && !Array.isArray(e[f])) errors.push(`${where}: ${f} must be an array`);
    }
  }
  if (errors.length) {
    console.error(`${target}: ${errors.length} problem(s)\n` + errors.slice(0, 40).join("\n"));
    process.exit(1);
  }
  if (cmd === "validate") {
    console.log(`${target}: ${arr.length} ${kind} entries valid`);
    process.exit(0);
  }
  fs.mkdirSync(enrichedDir, { recursive: true });
  const existing = fs.existsSync(enrichedDir) ? fs.readdirSync(enrichedDir).filter((f) => /^enriched-\d+\.json$/.test(f)) : [];
  const next = existing.length ? Math.max(...existing.map((f) => Number(f.match(/\d+/)[0]))) + 1 : 1;
  const out = path.join(enrichedDir, `enriched-${String(next).padStart(2, "0")}.json`);
  const cleaned = arr.map((e) => ({ ...e, enriched: true }));
  fs.writeFileSync(out, JSON.stringify(cleaned, null, 2) + "\n");
  console.log(`installed ${arr.length} ${kind} entries -> ${path.relative(web, out)}`);
  process.exit(0);
}
console.error("unknown command");
process.exit(2);
