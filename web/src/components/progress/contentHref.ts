"use client";
/**
 * Client-side helpers for turning content ids into links. Ids follow the
 * pattern `<level>-<type>-<slug>` (e.g. `n2-grammar-wake-dewa-nai`). The exact
 * public URL needs the lesson slug, which only the server knows, so the client
 * asks /api/content/resolve for a batch of ids and falls back to the level/type
 * index page when an id cannot be resolved.
 */
import type { Skill } from "@/lib/firestore/types";

export type ResolvedContent = { href: string; title: string; type: string };

const TYPE_PATH: Record<string, string> = {
  grammar: "grammar",
  vocabulary: "vocabulary",
  kanji: "kanji",
  reading: "reading",
  listening: "listening",
};

/** Parse `<level>-<type>-...` from a content id. */
export function parseContentId(id: string): { level: string; type: Skill } | null {
  if (/^foundation-/.test(id)) return { level: "foundation", type: "kana" };
  const m = /^(n[1-5])-(grammar|vocab|vocabulary|kanji|reading|listening)-/.exec(id);
  if (!m) return null;
  const type = (m[2] === "vocab" ? "vocabulary" : m[2]) as Skill;
  return { level: m[1], type };
}

/** Best-effort link when the id is not in the catalog: the level/type index page. */
export function fallbackHref(id: string): string {
  const p = parseContentId(id);
  if (!p) return "/japanese";
  if (p.type === "kana") return "/japanese/foundation";
  return `/japanese/${p.level}/${TYPE_PATH[p.type]}`;
}

/** Group ids by content type, preserving order and dropping duplicates. */
export function groupIdsByType(ids: string[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const type = parseContentId(id)?.type ?? "other";
    (out[type] ??= []).push(id);
  }
  return out;
}

const cache = new Map<string, ResolvedContent | null>();

/** Resolve a batch of ids via the server (cached per page load). Unknown ids are omitted. */
export async function resolveContentIds(ids: string[]): Promise<Record<string, ResolvedContent>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const missing = unique.filter((id) => !cache.has(id));
  // Keep query strings comfortably short.
  for (let i = 0; i < missing.length; i += 80) {
    const chunk = missing.slice(i, i + 80);
    try {
      const res = await fetch(`/api/content/resolve?ids=${encodeURIComponent(chunk.join(","))}`);
      const json = res.ok ? ((await res.json()) as Record<string, ResolvedContent>) : {};
      for (const id of chunk) cache.set(id, json[id] ?? null);
    } catch {
      for (const id of chunk) if (!cache.has(id)) cache.set(id, null);
    }
  }
  const out: Record<string, ResolvedContent> = {};
  for (const id of unique) {
    const r = cache.get(id);
    if (r) out[id] = r;
  }
  return out;
}

/** Link target for an id: resolved URL when known, otherwise the index page. */
export function hrefFor(id: string, resolved: Record<string, ResolvedContent>): { href: string; title: string; exact: boolean } {
  const r = resolved[id];
  if (r) return { href: r.href, title: r.title, exact: true };
  return { href: fallbackHref(id), title: id, exact: false };
}
