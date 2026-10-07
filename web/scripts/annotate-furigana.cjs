/**
 * Add 漢字（かな） readings to reading passages that have none.
 *
 *   node scripts/annotate-furigana.cjs            # report only
 *   node scripts/annotate-furigana.cjs --apply    # write the passages
 *
 * Every N2 passage and eight N3 passages shipped without a single reading, so the "Show
 * furigana" setting did nothing on those pages while working on N5, N4, N3 and N1. The human-
 * annotated levels do not follow one rule (N5 marks nearly everything, N1 marks hard words by
 * judgement), so this uses a stated one a reader can understand: a word is annotated, on its
 * first occurrence in the passage, when it contains a kanji that is not taught at or below the
 * passage's level — the readings a learner at that level has not been shown yet.
 *
 * Readings come from the course's own vocabulary lists first and the kuromoji analyser second,
 * and only for all-kanji words of two or more characters as a single token. Measured against the
 * readings humans wrote in the other levels, that policy is right 96–99% of the time, and what
 * it gets "wrong" is mostly a second valid reading (玩具: おもちゃ / がんぐ). Single-kanji
 * runs are skipped on purpose: that is where the analyser fails (偏る read as へん).
 */
const fs = require("fs");
const path = require("path");
const kuromoji = require("kuromoji");

const WEB = path.join(__dirname, "..");
const APPLY = process.argv.includes("--apply");
const K = "\\u3400-\\u4dbf\\u4e00-\\u9fff\\u3005";
const KANJI = new RegExp(`[${K}]`);
const RUN = new RegExp(`[${K}]+`, "g");
const ANN = new RegExp(`[${K}]+[（(][\\u3040-\\u309f\\u30a0-\\u30ffー]+[)）]`);
const kata2hira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

const LEVELS = ["n5", "n4", "n3", "n2", "n1"];
const vocab = new Map();
const taught = {};
{
  const cum = new Set();
  for (const lv of LEVELS) {
    for (const v of JSON.parse(fs.readFileSync(path.join(WEB, "content", lv, "vocabulary.json"), "utf8"))) if (!vocab.has(v.word)) vocab.set(v.word, v.reading);
    for (const k of JSON.parse(fs.readFileSync(path.join(WEB, "content", lv, "kanji.json"), "utf8"))) cum.add(k.character);
    taught[lv] = new Set(cum);
  }
}

function passagesNeeding(level) {
  const dir = path.join(WEB, "content", level, "reading");
  const out = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const file = path.join(dir, f);
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    const items = Array.isArray(raw) ? raw : [raw];
    for (const e of items) {
      const text = [...(e.paragraphs ?? []), ...(e.paragraphsB ?? [])].join("\n");
      if (!ANN.test(text) && KANJI.test(text)) out.push({ file, raw, e });
    }
  }
  return out;
}

kuromoji.builder({ dicPath: path.join(WEB, "node_modules/kuromoji/dict") }).build((err, tokenizer) => {
  if (err) throw err;
  let totalWords = 0, totalPassages = 0;
  const samples = [];
  const touched = new Map();

  for (const level of ["n2", "n3"]) {
    const known = taught[level];
    for (const { file, raw, e } of passagesNeeding(level)) {
      const seen = new Set();
      let count = 0;
      const annotate = (para) => {
        const tokens = tokenizer.tokenize(para);
        // Token boundaries by offset, so a kanji run is only taken as a word when it is one token.
        const spans = []; let pos = 0;
        for (const t of tokens) { spans.push({ s: pos, e: pos + t.surface_form.length, t }); pos += t.surface_form.length; }
        let out = ""; let last = 0;
        for (const m of para.matchAll(RUN)) {
          const word = m[0]; const start = m.index;
          out += para.slice(last, start); last = start + word.length;
          const needs = word.length >= 2 && !seen.has(word) && [...word].some((c) => !known.has(c));
          let reading = null;
          if (needs) {
            if (vocab.has(word)) reading = vocab.get(word);
            else {
              const span = spans.find((x) => x.s === start && x.e === start + word.length);
              if (span && span.t.reading) reading = kata2hira(span.t.reading);
            }
          }
          if (reading) { seen.add(word); count++; out += `${word}（${reading}）`; if (samples.length < 12) samples.push(`${level} ${word}（${reading}）`); }
          else out += word;
        }
        return out + para.slice(last);
      };
      e.paragraphs = (e.paragraphs ?? []).map(annotate);
      if (e.paragraphsB) e.paragraphsB = e.paragraphsB.map(annotate);
      totalWords += count; totalPassages++;
      touched.set(file, raw);
      console.log(`${level} ${e.id}: ${count} readings added`);
    }
  }
  console.log(`\n${totalPassages} passages, ${totalWords} readings. e.g. ${samples.join(" ")}`);
  if (!APPLY) { console.log("\nDRY RUN - nothing written. Re-run with --apply."); return; }
  for (const [file, raw] of touched) fs.writeFileSync(file, JSON.stringify(raw, null, 2) + "\n");
  console.log(`wrote ${touched.size} files`);
});
