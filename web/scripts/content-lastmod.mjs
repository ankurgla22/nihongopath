/**
 * Record when each content item last changed, from git history, into content/lastmod.json.
 *
 *   npm run content:lastmod
 *
 * The sitemap, the lesson schema (dateModified) and the visible "Updated" date read this file,
 * so a deploy that changes three lessons reports three changed URLs instead of ten thousand.
 * Search engines stop trusting lastmod when every URL changes on every build.
 *
 * Commit the regenerated file together with content changes. Items missing from the file
 * (new, uncommitted content) fall back to the build time.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentDir = path.join(web, "content");
const out = path.join(contentDir, "lastmod.json");

// One git call: commits newest first, each followed by the files it touched.
// The first commit a file appears in (walking from newest) is its last modification.
const log = execFileSync("git", ["log", "--name-only", "--format=%cI", "--", "content"], { cwd: web, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: web, encoding: "utf8" }).trim();
const prefix = path.relative(repoRoot, contentDir).replace(/\\/g, "/") + "/";

const fileDate = new Map();
let current = null;
for (const line of log.split("\n")) {
  if (!line.trim()) continue;
  if (/^\d{4}-\d{2}-\d{2}T/.test(line)) {
    current = line.trim();
    continue;
  }
  if (line.startsWith(prefix) && !fileDate.has(line)) fileDate.set(line, current);
}

// Map file dates onto content ids by reading each JSON file's id.
const manifest = {};
let files = 0, skipped = 0;
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".json") && e.name !== "lastmod.json") {
      files++;
      const rel = prefix + path.relative(contentDir, p).replace(/\\/g, "/");
      const date = fileDate.get(rel);
      if (!date) { skipped++; continue; }
      let j;
      try { j = JSON.parse(fs.readFileSync(p, "utf8")); } catch { skipped++; continue; }
      const items = Array.isArray(j) ? j : [j];
      for (const it of items) if (it && typeof it.id === "string") manifest[it.id] = date;
    }
  }
})(contentDir);

const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(out, JSON.stringify(sorted, null, 0) + "\n");
const dates = [...new Set(Object.values(sorted))].sort();
console.log(`content/lastmod.json: ${Object.keys(sorted).length} ids from ${files} files (${skipped} not in git yet); ${dates.length} distinct dates, ${dates[0]} .. ${dates[dates.length - 1]}`);
