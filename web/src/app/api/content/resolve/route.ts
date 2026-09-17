import { NextResponse } from "next/server";
import { resolveContentId } from "@/lib/content";

export const runtime = "nodejs";

const MAX_IDS = 200;

/**
 * GET /api/content/resolve?ids=a,b,c
 * → { [id]: { href, title, type } } for every id found in the catalog.
 * Content is public, so no auth is required; unknown ids are simply omitted.
 */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("ids") ?? "";
  const ids = Array.from(new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))).slice(0, MAX_IDS);
  const out: Record<string, { href: string; title: string; type: string }> = {};
  for (const id of ids) {
    const r = resolveContentId(id);
    if (r) out[id] = r;
  }
  return NextResponse.json(out, { headers: { "Cache-Control": "public, max-age=3600" } });
}
