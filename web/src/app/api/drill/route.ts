import { NextResponse } from "next/server";
import { getKanji, getVocabulary } from "@/lib/content";
import type { Question } from "@/lib/content/schemas";
import { DRILL_KINDS, generateKanjiDrill, generateVocabDrill, groupDrillIds, type DrillKind } from "@/lib/drill/generate";

export const runtime = "nodejs";

const MAX_IDS = 80;
const MAX_SEED_LENGTH = 128;
/** Upper bound on questions per item; the generator yields at most one per kind anyway. */
const MAX_PER_ITEM = DRILL_KINDS.length;

/**
 * GET /api/drill?ids=n5-vocab-1,n5-kanji-一&kinds=meaning,reading&seed=abc&per=2
 * → { questions: Question[] } generated on the fly for the given vocabulary/kanji content ids
 *   (distractors come from every item of the same level). Ids that are not vocabulary/kanji are ignored.
 *   Deterministic for a seed, so the response is cacheable public content.
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const ids = Array.from(new Set((params.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean))).slice(0, MAX_IDS);
  const kinds = (params.get("kinds") ?? "").split(",").map((s) => s.trim()).filter((k): k is DrillKind => (DRILL_KINDS as string[]).includes(k));
  const seed = (params.get("seed") ?? "drill").slice(0, MAX_SEED_LENGTH) || "drill";
  const perRaw = Number(params.get("per"));
  const perItem = Number.isFinite(perRaw) && perRaw > 0 ? Math.min(MAX_PER_ITEM, Math.floor(perRaw)) : undefined;
  const opts = { seed, kinds: kinds.length ? kinds : undefined, perItem };

  const { vocab, kanji } = groupDrillIds(ids);
  const byContentId = new Map<string, Question[]>();
  const add = (q: Question) => {
    const cid = q.tags.vocabIds[0] ?? q.tags.kanjiIds[0];
    if (!cid) return;
    byContentId.set(cid, [...(byContentId.get(cid) ?? []), q]);
  };
  for (const [level, want] of vocab) {
    const pool = getVocabulary(level);
    const set = new Set(want);
    for (const q of generateVocabDrill(pool.filter((v) => set.has(v.id)), pool, opts)) add(q);
  }
  for (const [level, want] of kanji) {
    const pool = getKanji(level);
    const set = new Set(want);
    for (const q of generateKanjiDrill(pool.filter((k) => set.has(k.id)), pool, opts)) add(q);
  }
  // Keep the caller's id order.
  const questions = ids.flatMap((id) => byContentId.get(id) ?? []);
  return NextResponse.json({ questions }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
