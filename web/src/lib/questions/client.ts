/**
 * Client-side loader for full Question records. Pages ship only a slim QuestionIndexEntry[]
 * (id/level/skill/difficulty/tags) so quiz sets are picked on the client and the full records are
 * fetched on demand from GET /api/content/questions?ids=… (public, cacheable content).
 */
import type { Question } from "@/lib/content/schemas";
import type { DrillKind } from "@/lib/drill/generate";
import { hashSeed } from "@/lib/engine/scoring";

const CHUNK = 100;
const cache = new Map<string, Question>();

async function fetchChunk(ids: string[]): Promise<Question[]> {
  const res = await fetch(`/api/content/questions?ids=${encodeURIComponent(ids.join(","))}`);
  if (!res.ok) throw new Error(`Could not load questions (${res.status}).`);
  return (await res.json()) as Question[];
}

/**
 * Resolve question ids to full records, in the order given (ids not in the bank are dropped).
 * Requests go out in chunks of 100 in parallel; results are cached in memory for the session.
 */
export async function fetchQuestionsByIds(ids: string[]): Promise<Question[]> {
  const unique = Array.from(new Set(ids));
  const missing = unique.filter((id) => !cache.has(id));
  if (missing.length > 0) {
    const chunks: string[][] = [];
    for (let i = 0; i < missing.length; i += CHUNK) chunks.push(missing.slice(i, i + CHUNK));
    const results = await Promise.all(chunks.map(fetchChunk));
    for (const list of results) for (const q of list) cache.set(q.id, q);
  }
  const out: Question[] = [];
  for (const id of unique) {
    const q = cache.get(id);
    if (q) out.push(q);
  }
  return out;
}

const DRILL_CHUNK = 80;

export type DrillFetchOptions = {
  kinds?: DrillKind[];
  /** Deterministic seed: the same seed and ids always give the same questions/options. */
  seed: string;
  /** Maximum questions per item (default: one per kind). */
  perItem?: number;
};

/**
 * Generate drill questions for vocabulary/kanji content ids via GET /api/drill (chunks of 80, in
 * parallel). Results come back in the order of `ids`; ids that cannot be drilled are dropped.
 * Not cached: the seed decides the options and callers usually pass a fresh seed per session.
 */
export async function fetchDrill(ids: string[], opts: DrillFetchOptions): Promise<Question[]> {
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += DRILL_CHUNK) chunks.push(unique.slice(i, i + DRILL_CHUNK));
  const results = await Promise.all(
    chunks.map(async (chunk) => {
      // Callers build seeds from the uid; send only a hash so the (publicly cacheable) URL carries no user id.
      const params = new URLSearchParams({ ids: chunk.join(","), seed: hashSeed(opts.seed).toString(36) });
      if (opts.kinds?.length) params.set("kinds", opts.kinds.join(","));
      if (opts.perItem) params.set("per", String(opts.perItem));
      const res = await fetch(`/api/drill?${params.toString()}`);
      if (!res.ok) throw new Error(`Could not build the drill (${res.status}).`);
      const body = (await res.json()) as { questions: Question[] };
      return body.questions;
    })
  );
  return results.flat();
}

export type ResolvedContentLink = { href: string; title: string; type: string };
const linkCache = new Map<string, ResolvedContentLink | null>();
const LINK_CHUNK = 200;

/**
 * Resolve content ids to lesson links via GET /api/content/resolve (public, cacheable). Unknown ids
 * are omitted; results are cached for the session. Pages ship only the links they need up front
 * (today's tasks, the review queue) and QuizRunner fills in the rest on the result screen.
 */
export async function fetchContentLinks(ids: string[]): Promise<Record<string, ResolvedContentLink>> {
  const unique = Array.from(new Set(ids));
  const missing = unique.filter((id) => !linkCache.has(id));
  if (missing.length > 0) {
    const chunks: string[][] = [];
    for (let i = 0; i < missing.length; i += LINK_CHUNK) chunks.push(missing.slice(i, i + LINK_CHUNK));
    const results = await Promise.all(
      chunks.map(async (chunk) => {
        const res = await fetch(`/api/content/resolve?ids=${encodeURIComponent(chunk.join(","))}`);
        if (!res.ok) throw new Error(`Could not resolve lesson links (${res.status}).`);
        return (await res.json()) as Record<string, ResolvedContentLink>;
      })
    );
    for (const id of missing) linkCache.set(id, null);
    for (const r of results) for (const [id, link] of Object.entries(r)) linkCache.set(id, link);
  }
  const out: Record<string, ResolvedContentLink> = {};
  for (const id of unique) {
    const l = linkCache.get(id);
    if (l) out[id] = l;
  }
  return out;
}

/** Test/HMR hook: forget cached records. */
export function clearQuestionCache() {
  cache.clear();
  linkCache.clear();
}
