/**
 * Repair vocabulary slugs whose romaji lost its long vowels.
 *
 *   node scripts/fix-slugs.mjs [--dry]
 *
 * A slug is the word's URL: /japanese/n5/vocabulary/649-souji. The romaji half came from the
 * tanos.co.uk list, which writes long vowels with macrons (sōji, yō, budō). The importer's
 * `[^a-z0-9]` filter deleted those characters outright rather than expanding them, so 掃除 shipped
 * as `649-s-jisuru`, 用 as `574-y` and 高等学校 as `568-k-t-gakk`. The page still renders — the slug
 * is only a key — but the address bar shows a word that is not a word, and the sitemap publishes it.
 *
 * This rebuilds the romaji from the entry's own `reading`, which is kana and therefore unambiguous,
 * and leaves alone any slug that already contains the reading: several entries deliberately carry a
 * variant (`652-kiro-kiroguramu`, `464-iiyoi`), and those are fine as they stand.
 *
 * Slugs live in both the base file and the enriched overlay, and the installer refuses a batch whose
 * slug differs from the base, so both are rewritten together.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry");
const LEVELS = ["n5", "n4", "n3", "n2", "n1"];

const M = {きゃ:"kya",きゅ:"kyu",きょ:"kyo",しゃ:"sha",しゅ:"shu",しょ:"sho",ちゃ:"cha",ちゅ:"chu",ちょ:"cho",にゃ:"nya",にゅ:"nyu",にょ:"nyo",ひゃ:"hya",ひゅ:"hyu",ひょ:"hyo",みゃ:"mya",みゅ:"myu",みょ:"myo",りゃ:"rya",りゅ:"ryu",りょ:"ryo",ぎゃ:"gya",ぎゅ:"gyu",ぎょ:"gyo",じゃ:"ja",じゅ:"ju",じょ:"jo",びゃ:"bya",びゅ:"byu",びょ:"byo",ぴゃ:"pya",ぴゅ:"pyu",ぴょ:"pyo",てぃ:"ti",でぃ:"di",ふぁ:"fa",ふぃ:"fi",ふぇ:"fe",ふぉ:"fo",うぃ:"wi",うぇ:"we",うぉ:"wo",しぇ:"she",ちぇ:"che",じぇ:"je",
あ:"a",い:"i",う:"u",え:"e",お:"o",か:"ka",き:"ki",く:"ku",け:"ke",こ:"ko",さ:"sa",し:"shi",す:"su",せ:"se",そ:"so",た:"ta",ち:"chi",つ:"tsu",て:"te",と:"to",な:"na",に:"ni",ぬ:"nu",ね:"ne",の:"no",は:"ha",ひ:"hi",ふ:"fu",へ:"he",ほ:"ho",ま:"ma",み:"mi",む:"mu",め:"me",も:"mo",や:"ya",ゆ:"yu",よ:"yo",ら:"ra",り:"ri",る:"ru",れ:"re",ろ:"ro",わ:"wa",を:"wo",ん:"n",が:"ga",ぎ:"gi",ぐ:"gu",げ:"ge",ご:"go",ざ:"za",じ:"ji",ず:"zu",ぜ:"ze",ぞ:"zo",だ:"da",ぢ:"ji",づ:"zu",で:"de",ど:"do",ば:"ba",び:"bi",ぶ:"bu",べ:"be",ぼ:"bo",ぱ:"pa",ぴ:"pi",ぷ:"pu",ぺ:"pe",ぽ:"po",ぁ:"a",ぃ:"i",ぅ:"u",ぇ:"e",ぉ:"o",ゃ:"ya",ゅ:"yu",ょ:"yo","ー":"@","っ":"*"};
const kata = (s) => s.replace(/[\u30a1-\u30f6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
function romaji(reading) {
  const r = kata(String(reading || ""));
  let out = "";
  for (let i = 0; i < r.length; i++) {
    const two = r.slice(i, i + 2);
    if (M[two] !== undefined) { out += M[two]; i++; continue; }
    if (M[r[i]] !== undefined) out += M[r[i]];
  }
  // っ doubles the next consonant, ー doubles the preceding vowel.
  return out.replace(/\*(.)/g, (_, c) => c + c).replace(/(.)@/g, (_, c) => c + c);
}
const norm = (s) => String(s).toLowerCase().replace(/[^a-z]/g, "");

let fixed = 0, kept = 0;
for (const lv of LEVELS) {
  const baseFile = path.join(web, "content", lv, "vocabulary.json");
  const base = JSON.parse(fs.readFileSync(baseFile, "utf8"));
  const taken = new Set(base.map((v) => v.slug));
  const rename = new Map();
  for (const v of base) {
    const want = romaji(v.reading);
    if (!want) continue;
    const have = norm(String(v.slug).replace(/^\d+-/, ""));
    if (have.includes(norm(want))) { if (have !== norm(want)) kept++; continue; }
    // Keep whatever number the slug already carries. It is usually the id's tail but not always —
    // some levels number by `order` instead — and renumbering would move a page for no reason when
    // the only thing wrong with it is the romaji.
    const n = (String(v.slug).match(/^(\d+)-/) ?? [])[1] ?? String(v.order);
    let slug = `${n}-${want}`;
    let k = 2;
    while (taken.has(slug) && slug !== v.slug) slug = `${n}-${want}-${k++}`;
    if (slug === v.slug) continue;
    taken.delete(v.slug); taken.add(slug);
    rename.set(v.id, slug);
    v.slug = slug;
    fixed++;
  }
  if (!rename.size) { console.log(`  ${lv}: nothing to fix`); continue; }
  console.log(`  ${lv}: ${rename.size} slug(s) rebuilt`);
  if (DRY) continue;
  fs.writeFileSync(baseFile, JSON.stringify(base, null, 2) + "\n", "utf8");
  const dir = path.join(web, "content", lv, "vocabulary");
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const arr = JSON.parse(fs.readFileSync(p, "utf8"));
    let touched = 0;
    for (const v of arr) if (rename.has(v.id)) { v.slug = rename.get(v.id); touched++; }
    if (touched) fs.writeFileSync(p, JSON.stringify(arr, null, 2) + "\n", "utf8");
  }
}
console.log(`\n${fixed} slug(s) rebuilt from the reading; ${kept} left alone (slug already contains the reading, e.g. a variant spelling).`);
