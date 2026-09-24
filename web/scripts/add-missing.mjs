/**
 * Add the reference-list items the course does not have yet, as un-enriched base entries.
 *
 *   node --max-old-space-size=4096 scripts/add-missing.mjs --level n3 --kind kanji [--dry]
 *   node --max-old-space-size=4096 scripts/add-missing.mjs --all --dry
 *
 * scripts/verify-content.mjs reports the course as short of the published lists: kanji from
 * KANJIDIC2 and vocabulary from the tanos.co.uk JLPT lists. This writes the missing ones into
 * content/<level>/<kind>.json with `enriched: false`, so the enrichment pipeline picks them up
 * exactly like any other un-enriched entry.
 *
 * What each new entry carries:
 *   kanji  meanings and both reading sets from KANJIDIC2, plus two real compounds mined from
 *          JMdict — the commonest words that contain the character — so the entry is never empty
 *          before enrichment. Ordered by corpus frequency and folded into the level's day-sets.
 *   vocab  word, reading and meaning from the list, appended to the level under a theme that
 *          says plainly where it came from.
 *
 * Nothing here is invented: every field traces to one of the two references or to JMdict. What
 * it cannot produce is example sentences, collocations or memory tips, which is what enrichment
 * is for. An entry added by this script is real but bare, and bare entries are the thing the
 * course is trying not to ship, so adding a level and enriching it belong in the same sitting.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const REF = path.join(web, ".enrich", "ref");
const LEVELS = ["n5", "n4", "n3", "n2", "n1"];
const NUM = { 5: "n5", 4: "n4", 3: "n3", 2: "n2", 1: "n1" };
const KANJI_PER_DAY = 12;

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf("--" + name); return i >= 0 ? args[i + 1] : null; };
const DRY = args.includes("--dry");
const ALL = args.includes("--all");
const onlyLevel = flag("level");
const onlyKind = flag("kind");

const rd = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const wr = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2) + "\n", "utf8");
const cpath = (lv, kind) => path.join(web, "content", lv, `${kind}.json`);

const kref = rd(path.join(REF, "kanji.json"));

// ---- compounds for a kanji, taken from the dictionary rather than made up ----
const jmFile = fs.readdirSync(REF).find((f) => /^jmdict-eng.*\.json$/.test(f));
const byChar = new Map();
if (jmFile) {
  const jm = rd(path.join(REF, jmFile));
  for (const w of jm.words) {
    const kanji = (w.kanji ?? [])[0];
    const kana = (w.kana ?? [])[0];
    if (!kanji || !kana) continue;
    const text = kanji.text;
    if (text.length < 2 || text.length > 4) continue;          // compounds, not single chars
    // JMdict tags the spellings nobody uses. Without this the miner offered 以色列 for Israel and
    // 三鞭酒 for champagne as example compounds, because both do contain the character: ateji are
    // phonetic borrowings where the kanji carry no meaning, and rK/oK/iK mark rare, outdated and
    // irregular spellings. None of them teaches a learner anything about the character.
    const tags = kanji.tags ?? [];
    if (tags.some((t) => ["ateji", "rK", "oK", "iK", "sK"].includes(t))) continue;
    // A sense marked obscure, archaic or obsolete is no better as a first example.
    const s0 = (w.sense ?? [])[0];
    if ((s0?.misc ?? []).some((m) => ["obsc", "arch", "obs", "rare"].includes(m))) continue;
    // Expressions are indexed like words but read as fragments: JMdict lists に似て, which taught
    // a learner nothing about 似. A compound worth showing starts with the kanji, not a particle.
    if ((s0?.partOfSpeech ?? []).some((t) => t === "exp")) continue;
    if (!/^[一-鿿]/.test(text)) continue;
    const gloss = s0?.gloss?.find((g) => g.lang === "eng")?.text;
    if (!gloss) continue;
    // Prefer words people actually use, but a rare kanji may have no common compound at all —
    // 223 of the N1 additions had none — so keep uncommon ones as a second tier rather than
    // leaving the entry with nothing to show.
    const tier = kanji.common || kana.common ? 0 : 1;
    for (const ch of new Set(text)) {
      if (!/[一-鿿]/.test(ch)) continue;
      const list = byChar.get(ch) ?? [];
      if (list.length < 8) { list.push({ word: text, reading: kana.text, meaning: gloss, tier }); byChar.set(ch, list); }
    }
  }
}

const tanos = { };
for (const l of LEVELS) tanos[l] = rd(path.join(REF, `vocab-${l}.json`));

const report = [];

function addKanji(lv) {
  const base = rd(cpath(lv, "kanji"));
  const have = new Set(base.map((k) => k.character));
  // KANJIDIC tags 1,232 kanji as N1, but 247 of those are grade 9 — jinmeiyou, the characters
  // permitted in personal names and essentially nowhere else. 祐, 槻, 彪, 凜 and the rest are real
  // kanji a learner may meet on a business card, but they are not on the exam and teaching them
  // as N1 material would pad the course with 20% noise. Grades 1-8 are the joyo set the JLPT
  // actually draws from.
  const want = Object.entries(kref)
    .filter(([ch, d]) => d.jlpt_new != null && NUM[d.jlpt_new] === lv && !have.has(ch))
    .filter(([, d]) => d.grade != null && d.grade <= 8)
    .sort((a, b) => (a[1].freq ?? 9e9) - (b[1].freq ?? 9e9));
  if (!want.length) return report.push(`${lv} kanji: already complete`);

  const merged = [...base];
  for (const [ch, d] of want) {
    merged.push({
      id: `${lv}-kanji-${ch}`,
      slug: `0-${ch}`,                 // renumbered below
      level: lv,
      order: 0,
      day: 1,
      character: ch,
      meanings: (d.meanings ?? []).slice(0, 3).map((m) => m.toLowerCase()),
      onyomi: d.readings_on ?? [],
      kunyomi: d.readings_kun ?? [],
      words: [...(byChar.get(ch) ?? [])].sort((a, b) => a.tier - b.tier).slice(0, 2).map(({ word, reading, meaning }) => ({ word, reading, meaning })),
      examples: [],
      similarKanji: [],
      commonMistakes: [],
      enriched: false,
    });
  }
  // Re-sort the whole level by frequency so the new characters land in sensible day-sets.
  merged.sort((a, b) => (kref[a.character]?.freq ?? 9e9) - (kref[b.character]?.freq ?? 9e9));
  merged.forEach((k, i) => {
    k.order = i + 1;
    k.slug = `${i + 1}-${k.character}`;
    k.day = Math.floor(i / KANJI_PER_DAY) + 1;
  });
  const noWords = want.filter(([ch]) => !(byChar.get(ch) ?? []).length).length;
  report.push(`${lv} kanji: +${want.length} (now ${merged.length})${noWords ? `, ${noWords} without a mined compound` : ""}`);
  if (!DRY) wr(cpath(lv, "kanji"), merged);
}

// A word the course already teaches anywhere must not be added again under another level: the
// list places 明日 at N5 while the course teaches it at N4, and adding it would leave a learner
// meeting the same spelling twice under two labels.
const taughtAnywhere = new Set();
for (const l of LEVELS) for (const v of rd(cpath(l, "vocabulary"))) taughtAnywhere.add(v.word);

// The list writes suru-verbs as 掃除 with the furigana そうじする, and separates some entries with
// a middle dot. Copying either verbatim gives the entry a reading it does not have.
const cleanReading = (r, word) => {
  let out = String(r ?? "").replace(/・/g, "");
  if (!word.endsWith("する") && out.endsWith("する")) out = out.slice(0, -2);
  return out;
};

function addVocab(lv) {
  const base = rd(cpath(lv, "vocabulary"));
  const want = tanos[lv].filter((w) => !taughtAnywhere.has(w.word));
  if (!want.length) return report.push(`${lv} vocabulary: already complete`);

  const merged = [...base];
  let n = base.length;
  for (const w of want) {
    n++;
    merged.push({
      id: `${lv}-vocab-${n}`,
      slug: `${n}-${(w.romaji ?? "").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || `w${n}`}`,
      level: lv,
      order: n,
      word: w.word,
      // The list leaves furigana empty for kana-only words, and ?? does not fall back on
      // an empty string, which left those entries with no reading at all.
      reading: cleanReading(w.furigana, w.word) || w.word,
      pos: "n",                                  // corrected during enrichment
      meaning: w.meaning,
      theme: "JLPT list",
      examples: [],
      collocations: [],
      related: [],
      synonyms: [],
      antonyms: [],
      difficulty: { n5: 1, n4: 2, n3: 3, n2: 4, n1: 5 }[lv],
      kanjiIds: [],
      enriched: false,
    });
  }
  report.push(`${lv} vocabulary: +${want.length} (now ${merged.length})`);
  if (!DRY) wr(cpath(lv, "vocabulary"), merged);
}

for (const lv of LEVELS) {
  if (!ALL && onlyLevel && lv !== onlyLevel) continue;
  if (!ALL && !onlyLevel) continue;
  if (!onlyKind || onlyKind === "kanji") addKanji(lv);
  if (!onlyKind || onlyKind === "vocabulary") addVocab(lv);
}

report.forEach((r) => console.log("  " + r));
console.log(DRY ? "\n(dry run - nothing written)" : "\nwritten. Run scripts/validate-content.ts, then enrich the new entries.");
