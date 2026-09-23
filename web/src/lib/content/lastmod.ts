import fs from "node:fs";
import path from "node:path";
import { LAST_MODIFIED } from "@/lib/seo/site";

/**
 * Per-item last-modified dates, generated from git history by scripts/content-lastmod.mjs
 * into content/lastmod.json (committed). Read once at build time.
 *
 * Used by the sitemap, the lesson schema's dateModified and the visible "Updated" date, so
 * those three always agree and only change for the items that changed. Anything not in the
 * manifest (new content not yet committed) falls back to the build time.
 */
let manifest: Record<string, string> | undefined;

function load(): Record<string, string> {
  if (manifest) return manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), "content", "lastmod.json"), "utf8")) as Record<string, string>;
  } catch {
    manifest = {};
  }
  return manifest;
}

/** ISO date the content item with this id last changed, or the build time if unknown. */
export function contentLastMod(id: string): string {
  return load()[id] ?? LAST_MODIFIED;
}
