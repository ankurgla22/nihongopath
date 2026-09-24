/**
 * Re-bucket vocabulary and kanji to published JLPT levels.
 *
 *   node scripts/rebucket.mjs --dry     report what would move, write nothing
 *   node scripts/rebucket.mjs           rewrite base files and enriched overlays
 *
 * Levels come from two published references, downloaded into .enrich/ref:
 *   kanji  — KANJIDIC2 via davidluzgouveia/kanji-data, field `jlpt_new`
 *   vocab  — tanos.co.uk lists via wkei/jlpt-vocab-api
 *
 * An item the references do not list is not wrong, only outside those lists, so it keeps the
 * level it already has. Nothing is dropped: every enriched entry follows its own word or
 * character to wherever that item now lives.
 *
 * Within a level, kanji are ordered by corpus frequency so the commonest come first, and days
 * are cut from that order. Vocabulary keeps its theme grouping, since studying by theme is the
 * point of the theme field.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry");
const LEVELS = ["n5", "n4", "n3", "n2", "n1"];
const NUM = { 5: "n5", 4: "n4", 3: "n3", 2: "n2", 1: "n1" };
const KANJI_PER_DAY = 12;

const rd = (p) => JSON.parse(fs.readFileSync(path.join(web, p), "utf8"));
const wr = (p, v) => { fs.mkdirSync(path.dirname(path.join(web, p)), { recursive: true }); fs.writeFileSync(path.join(web, p), JSON.stringify(v, null, 2) + "\n", "utf8"); };

// ---- references ----
const kref = rd(".enrich/ref/kanji.json");
const vref = new Map();
for (const l of LEVELS) for (const w of rd(`.enrich/ref/vocab-${l}.json`)) if (!vref.has(w.word)) vref.set(w.word, l);

// ---- load everything currently on the site, with its enrichment ----
function load(kind) {
  const key = kind === "vocabulary" ? "word" : "character";
  const items = [];
  for (const lv of LEVELS) {
    const base = rd(`content/${lv}/${kind}.json`);
    const enr = new Map();
    const dir = path.join(web, "content", lv, kind);
    if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) for (const e of rd(`content/${lv}/${kind}/${f}`)) enr.set(e[key], e);
    for (const b of base) items.push({ ...b, ...(enr.get(b[key]) ?? {}), _from: lv });
  }
  return items;
}

function target(kind, item) {
  if (kind === "kanji") {
    const j = kref[item.character]?.jlpt_new;
    return j == null ? item._from : NUM[j];
  }
  return vref.get(item.word) ?? item._from;
}

const report = { kanji: {}, vocabulary: {} };

for (const kind of ["kanji", "vocabulary"]) {
  const key = kind === "vocabulary" ? "word" : "character";
  const items = load(kind);
  const buckets = Object.fromEntries(LEVELS.map((l) => [l, []]));
  let moved = 0, kept = 0;
  for (const it of items) {
    const to = target(kind, it);
    if (to !== it._from) moved++; else kept++;
    buckets[to].push(it);
  }
  report[kind] = { total: items.length, moved, kept, per: {} };

  for (const lv of LEVELS) {
    const list = buckets[lv];
    if (kind === "kanji") {
      // commonest first; unranked characters last, in their existing order
      list.sort((a, b) => (kref[a.character]?.freq ?? 9e9) - (kref[b.character]?.freq ?? 9e9));
    } else {
      // keep themes together, in the order the themes first appeared
      const seen = new Map();
      for (const it of list) if (!seen.has(it.theme ?? "")) seen.set(it.theme ?? "", seen.size);
      list.sort((a, b) => (seen.get(a.theme ?? "") - seen.get(b.theme ?? "")) || (a.order - b.order));
    }

    const base = [], enriched = [];
    list.forEach((it, i) => {
      const order = i + 1;
      const romaji = kind === "vocabulary" ? String(it.slug ?? "").replace(/^\d+-/, "") : it.character;
      const next = {
        ...it,
        level: lv,
        order,
        id: kind === "vocabulary" ? `${lv}-vocab-${order}` : `${lv}-kanji-${it.character}`,
        slug: `${order}-${romaji}`,
        ...(kind === "kanji" ? { day: Math.floor(i / KANJI_PER_DAY) + 1 } : {}),
      };
      delete next._from;
      // The base file keeps identity and core facts; the examples, collocations, tips and other
      // teaching material stay in the overlay, which is where the enrichment pipeline looks.
      const core = kind === "vocabulary"
        ? ["id","slug","level","order","word","reading","pos","meaning","theme","difficulty","kanjiIds"]
        : ["id","slug","level","order","day","character","meanings","onyomi","kunyomi"];
      const thin = {};
      for (const f of core) if (next[f] !== undefined) thin[f] = next[f];
      // The schema requires these arrays on every entry, so the base keeps a seed of each:
      // one example to anchor the word, and for kanji the first couple of compounds.
      if (kind === "vocabulary") {
        const ex = (next.examples ?? [])[0];
        thin.examples = ex ? [{ ja: ex.ja, en: ex.en }] : [];
        thin.collocations = []; thin.related = []; thin.synonyms = []; thin.antonyms = [];
      } else {
        thin.words = (next.words ?? []).slice(0, 2);
        thin.examples = []; thin.similarKanji = []; thin.commonMistakes = [];
      }
      thin.enriched = false;
      base.push(thin);
      if (next.enriched === true) enriched.push(next);
    });
    report[kind].per[lv] = { count: base.length, enriched: enriched.length };

    if (!DRY) {
      wr(`content/${lv}/${kind}.json`, base);
      const dir = path.join(web, "content", lv, kind);
      if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f));
      // one overlay file per 200 entries keeps the files reviewable
      for (let i = 0, n = 1; i < enriched.length; i += 200, n++)
        wr(`content/${lv}/${kind}/enriched-${String(n).padStart(2, "0")}.json`, enriched.slice(i, i + 200));
    }
  }
}

for (const kind of ["kanji", "vocabulary"]) {
  const r = report[kind];
  console.log(`${kind}: ${r.total} items, ${r.moved} moved level, ${r.kept} stayed`);
  for (const lv of LEVELS) console.log(`   ${lv}: ${String(r.per[lv].count).padStart(4)} items, ${r.per[lv].enriched} enriched`);
}
console.log(DRY ? "\n(dry run — nothing written)" : "\nwritten");
