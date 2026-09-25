/**
 * Build the redirect map for pages whose URL has changed.
 *
 *   node scripts/build-redirects.mjs
 *
 * Two things renumbered or respelled slugs after the site was already being crawled: the
 * re-bucketing that moved entries to their reference level (which changed a word's order, and the
 * order is the number in its slug), and the later rebuild of romaji that had lost its long vowels.
 * Neither left a redirect behind, so URLs Google already holds — /japanese/n5/vocabulary/245-doyoubi
 * is one — now 404.
 *
 * Every slug an entry has ever had is recoverable from git, because the content files are the
 * history. This walks each commit that touched them and writes every historical (level, slug) that
 * differs from where that entry lives now.
 *
 * It keys on the headword — the word, the character, the grammar title — and NOT on the id. Ids
 * were reassigned during the re-bucketing: keying on them mapped /n5/vocabulary/245-doyoubi, which
 * was 土曜日, onto 245-itsuka, which is 五日, because slot 245 had been handed to a different entry.
 * A redirect to the wrong word is worse than the 404 it replaces. The headword is what the URL
 * actually promises, so that is what it resolves to.
 *
 * Output: content/redirects.json, consumed by middleware.ts. Regenerate it whenever slugs move.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const web = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const LEVELS = ["n5", "n4", "n3", "n2", "n1"];
const KINDS = [
  { file: "vocabulary.json", seg: "vocabulary", key: (e) => e.word },
  { file: "kanji.json", seg: "kanji", key: (e) => e.character },
  { file: "grammar-base.json", seg: "grammar", key: (e) => e.title },
];

const git = (cmd) => execSync(cmd, { cwd: web, maxBuffer: 1024 * 1024 * 512, encoding: "utf8" });
// The repo keeps the app under web/, so paths inside git are prefixed.
const prefix = git("git rev-parse --show-prefix").trim();

/** Current home of every headword: "<seg>|<headword>" -> "<level>/<seg>/<slug>" */
const current = new Map();
for (const lv of LEVELS)
  for (const k of KINDS) {
    const p = path.join(web, "content", lv, k.file);
    if (!fs.existsSync(p)) continue;
    for (const e of JSON.parse(fs.readFileSync(p, "utf8"))) {
      const key = k.key(e);
      if (key) current.set(`${k.seg}|${key}`, `${lv}/${k.seg}/${e.slug}`);
    }
  }

const commits = git("git log --format=%H -- content/").trim().split("\n").filter(Boolean);
const redirects = {};
let scanned = 0;

for (const sha of commits) {
  for (const lv of LEVELS)
    for (const k of KINDS) {
      let raw;
      try {
        raw = git(`git show ${sha}:${prefix}content/${lv}/${k.file}`);
      } catch {
        continue; // the file did not exist at that commit
      }
      let arr;
      try {
        arr = JSON.parse(raw);
      } catch {
        continue;
      }
      if (!Array.isArray(arr)) continue;
      scanned++;
      for (const e of arr) {
        const from = `${lv}/${k.seg}/${e.slug}`;
        const headword = k.key(e);
        if (!headword) continue;
        const to = current.get(`${k.seg}|${headword}`);
        // Only a slug that no longer resolves needs a redirect, and only when we know where the
        // entry went. An id that no longer exists (a merged grammar duplicate) is handled by the
        // merge that removed it, which repointed its references to the survivor.
        if (!to || from === to) continue;
        if (!redirects[from]) redirects[from] = to;
      }
    }
}

// A slug that is currently in use must never be redirected away, even if some older entry once
// held it: the live page wins. This is built from every entry rather than from `current`, because
// `current` holds one URL per headword and a few words are taught at two levels — 見る is at both
// N5 and N3, so keying by headword alone pointed the live N5 URL at the N3 page.
const live = new Set();
for (const lv of LEVELS)
  for (const k of KINDS) {
    const p = path.join(web, "content", lv, k.file);
    if (!fs.existsSync(p)) continue;
    for (const e of JSON.parse(fs.readFileSync(p, "utf8"))) live.add(`${lv}/${k.seg}/${e.slug}`);
  }
for (const from of Object.keys(redirects)) if (live.has(from)) delete redirects[from];

const out = path.join(web, "content", "redirects.json");
fs.writeFileSync(out, JSON.stringify(redirects, null, 0) + "\n", "utf8");
const n = Object.keys(redirects).length;
console.log(`scanned ${commits.length} commits (${scanned} file versions)`);
console.log(`${n} historical URL${n === 1 ? "" : "s"} now redirect to their current page -> content/redirects.json`);
