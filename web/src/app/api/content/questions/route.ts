import { NextResponse } from "next/server";
import { getQuestionMap } from "@/lib/content";
import type { Question } from "@/lib/content/schemas";

export const runtime = "nodejs";

const MAX_IDS = 200;

/**
 * GET /api/content/questions?ids=q1,q2
 * → Question[] in the order requested (ids not in the bank are skipped).
 * Used by test-result review pages; the bank is public content.
 */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("ids") ?? "";
  const ids = Array.from(new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))).slice(0, MAX_IDS);
  const map = getQuestionMap();
  const out: Question[] = [];
  for (const id of ids) {
    const q = map.get(id);
    if (q) out.push(q);
  }
  return NextResponse.json(out, { headers: { "Cache-Control": "public, max-age=3600" } });
}
