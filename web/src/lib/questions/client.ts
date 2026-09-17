/**
 * Client-side loader for full Question records. Pages ship only a slim QuestionIndexEntry[]
 * (id/level/skill/difficulty/tags) so quiz sets are picked on the client and the full records are
 * fetched on demand from GET /api/content/questions?ids=… (public, cacheable content).
 */
import type { Question } from "@/lib/content/schemas";

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

/** Test/HMR hook: forget cached records. */
export function clearQuestionCache() {
  cache.clear();
}
