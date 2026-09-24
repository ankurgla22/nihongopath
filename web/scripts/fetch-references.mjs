/**
 * Download the published reference data that scripts/verify-content.mjs checks the course against.
 *
 *   node scripts/fetch-references.mjs
 *
 * Everything lands in .enrich/ref, which is gitignored: it is large, it is not ours, and it can
 * always be fetched again. Re-running is safe; files already present are left alone unless you
 * pass --force.
 *
 * Sources and their licences:
 *   JMdict         Japanese-English dictionary, 218k entries. EDRDG, CC BY-SA 4.0.
 *                  Taken from scriptin/jmdict-simplified, which republishes it as JSON.
 *   KANJIDIC2      Kanji readings, meanings, school grade and JLPT level. EDRDG, CC BY-SA 4.0.
 *                  Taken from davidluzgouveia/kanji-data.
 *   JLPT vocab     The tanos.co.uk level lists, the de-facto community reconstruction of the
 *                  pre-2010 official lists. Via wkei/jlpt-vocab-api.
 *   JLPT grammar   Grammar points with levels, from gokan-dev/gokan-dataset.
 *
 * The JLPT has published no official vocabulary or kanji list since 2010, so the level data here
 * is the best public reconstruction rather than an authority. Readings and meanings, on the other
 * hand, come from JMdict and KANJIDIC2 and can be treated as authoritative.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const web = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const REF = path.join(web, ".enrich", "ref");
const FORCE = process.argv.includes("--force");
fs.mkdirSync(REF, { recursive: true });

const has = (f) => fs.existsSync(path.join(REF, f)) && fs.statSync(path.join(REF, f)).size > 0;
const get = (url, out) => {
  if (!FORCE && has(out)) { console.log("  have   " + out); return; }
  execSync(`curl -sL -o "${path.join(REF, out)}" "${url}"`, { stdio: "inherit" });
  console.log("  got    " + out + "  (" + (fs.statSync(path.join(REF, out)).size / 1e6).toFixed(1) + "MB)");
};

console.log("KANJIDIC2 kanji data");
get("https://raw.githubusercontent.com/davidluzgouveia/kanji-data/master/kanji.json", "kanji.json");

console.log("JLPT vocabulary lists");
for (const l of ["n5", "n4", "n3", "n2", "n1"])
  get(`https://raw.githubusercontent.com/wkei/jlpt-vocab-api/HEAD/data-source/db/${l}.json`, `vocab-${l}.json`);

console.log("JLPT grammar points");
get("https://raw.githubusercontent.com/gokan-dev/gokan-dataset/HEAD/compiled/grammar/index/browse.json", "gram-browse.json");

console.log("JMdict (large; this is the one that takes a moment)");
const already = fs.readdirSync(REF).find((f) => /^jmdict-eng.*\.json$/.test(f));
if (already && !FORCE) {
  console.log("  have   " + already);
} else {
  const meta = execSync('curl -s "https://api.github.com/repos/scriptin/jmdict-simplified/releases/latest"', { encoding: "utf8", maxBuffer: 1e8 });
  const asset = JSON.parse(meta).assets.find((a) => /^jmdict-eng-\d.*\.json\.tgz$/.test(a.name));
  if (!asset) { console.error("  could not find a jmdict-eng json.tgz asset in the latest release"); process.exit(1); }
  get(asset.browser_download_url, "jmdict.tgz");
  execSync(`tar xzf "${path.join(REF, "jmdict.tgz")}" -C "${REF}"`, { stdio: "inherit" });
  fs.rmSync(path.join(REF, "jmdict.tgz"));
  console.log("  extracted " + fs.readdirSync(REF).find((f) => /^jmdict-eng.*\.json$/.test(f)));
}

console.log("\nReady. Run: node --max-old-space-size=4096 scripts/verify-content.mjs");
