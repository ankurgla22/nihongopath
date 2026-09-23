/**
 * Download KanjiVG stroke-order SVGs for every kanji in the content into public/kanjivg/.
 *
 *   node scripts/fetch-kanjivg.mjs
 *
 * KanjiVG (https://kanjivg.tagaini.net) is © Ulrich Apel, CC BY-SA 3.0. The kanji page shows
 * the attribution. Files are fetched from the project's GitHub repository by Unicode code point
 * (一 = U+4E00 -> 04e00.svg) and committed, so builds never depend on GitHub being up.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(web, "public", "kanjivg");
fs.mkdirSync(out, { recursive: true });

const chars = new Set();
for (const level of ["n5", "n4", "n3", "n2", "n1"]) {
  const base = path.join(web, "content", level, "kanji.json");
  if (fs.existsSync(base)) for (const k of JSON.parse(fs.readFileSync(base, "utf8"))) chars.add(k.character);
  const dir = path.join(web, "content", level, "kanji");
  if (fs.existsSync(dir))
    for (const f of fs.readdirSync(dir))
      if (f.endsWith(".json")) {
        const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
        for (const k of Array.isArray(j) ? j : [j]) if (k && k.character) chars.add(k.character);
      }
}

const file = (ch) => `${ch.codePointAt(0).toString(16).padStart(5, "0")}.svg`;
const todo = [...chars].filter((ch) => !fs.existsSync(path.join(out, file(ch))));
console.log(`${chars.size} kanji, ${todo.length} to fetch`);

let ok = 0, fail = [];
async function worker(queue) {
  for (let ch = queue.pop(); ch; ch = queue.pop()) {
    const url = `https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/${file(ch)}`;
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(String(r.status));
      let svg = await r.text();
      // Drop the XML prolog and DOCTYPE; keep the <svg> element only, so it can be inlined.
      svg = svg.slice(svg.indexOf("<svg"));
      fs.writeFileSync(path.join(out, file(ch)), svg);
      ok++;
    } catch (e) {
      fail.push(`${ch} ${e.message}`);
    }
  }
}
const queue = [...todo];
await Promise.all(Array.from({ length: 8 }, () => worker(queue)));
console.log(`fetched ${ok}, failed ${fail.length}${fail.length ? ": " + fail.slice(0, 10).join(", ") : ""}`);
