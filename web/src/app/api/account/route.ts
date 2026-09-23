import { NextResponse } from "next/server";
import { LEVELS, type Level } from "@/lib/content/schemas";
import { forbidden, isSameOrigin, jsonError } from "@/lib/api/guards";
import { requireFreshUser } from "@/lib/api/requireFreshUser";
import { deleteAccount, exportUserData, resetStudyData, type ResetScope } from "@/lib/firestore/account";
import { SESSION_COOKIE } from "@/lib/firebase/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Account data operations, all on the signed-in learner's own account.
 *
 *   POST { action: "export", idToken }                      -> the account's data as JSON
 *   POST { action: "reset",  idToken, scope: "all" }        -> clear study data, keep the account
 *   POST { action: "reset",  idToken, scope: "level", level }-> clear one level's progress and reviews
 *   POST { action: "delete", idToken, confirm: "DELETE" }   -> delete all data and the sign-in
 *
 * Every action needs a *fresh* ID token (see requireFreshUser): the 14-day session cookie alone
 * must not be enough to wipe an account. POST is used even for export so the token travels in
 * the body rather than a URL that could end up in logs or history.
 */

const VALID_LEVELS = new Set<string>([...LEVELS, "foundation"]);

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return forbidden();
  if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return jsonError(415, "bad-request", "Expected application/json.");
  }

  let body: { action?: unknown; idToken?: unknown; scope?: unknown; level?: unknown; confirm?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "bad-request", "Expected a JSON body.");
  }

  const auth = await requireFreshUser(body.idToken);
  if (!auth.ok) return jsonError(auth.status, auth.error, auth.message);
  const { uid } = auth.user;

  try {
    if (body.action === "export") {
      const data = await exportUserData(uid);
      return NextResponse.json(data, {
        headers: {
          // Named for the learner's own download; no-store so a shared machine's cache keeps nothing.
          "content-disposition": `attachment; filename="nihongo-path-data-${new Date().toISOString().slice(0, 10)}.json"`,
          "cache-control": "no-store",
        },
      });
    }

    if (body.action === "reset") {
      let scope: ResetScope;
      if (body.scope === "level") {
        if (typeof body.level !== "string" || !VALID_LEVELS.has(body.level)) {
          return jsonError(400, "bad-request", "level must be one of: foundation, n5, n4, n3, n2, n1.");
        }
        scope = { kind: "level", level: body.level as Level | "foundation" };
      } else if (body.scope === "all" || body.scope === undefined) {
        scope = { kind: "all" };
      } else {
        return jsonError(400, "bad-request", 'scope must be "all" or "level".');
      }
      const summary = await resetStudyData(uid, scope);
      return NextResponse.json({ ok: true, ...summary }, { headers: { "cache-control": "no-store" } });
    }

    if (body.action === "delete") {
      // A typed confirmation, so a mis-click or a replayed request cannot delete an account.
      if (body.confirm !== "DELETE") {
        return jsonError(400, "bad-request", 'Deletion requires confirm: "DELETE".');
      }
      const summary = await deleteAccount(uid);
      const res = NextResponse.json({ ok: true, ...summary }, { headers: { "cache-control": "no-store" } });
      // The account is gone; drop the session cookie so the browser is not left half signed in.
      res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
      return res;
    }

    return jsonError(400, "bad-request", 'action must be "export", "reset" or "delete".');
  } catch (err) {
    console.error("account action failed", body.action, err);
    return jsonError(500, "server-error", "Something went wrong. Nothing partial is left behind for export; for reset or delete, try again.");
  }
}
