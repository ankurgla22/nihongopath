"use client";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button, Callout, Card } from "@/components/ui";
import { LEVELS, LEVEL_LABEL } from "@/lib/content/schemas";
import { deleteAccount, exportData, freshIdToken, reauthNeeds, resetProgress } from "./accountActions";
import { clearSession } from "./sessionClient";
import { friendlyAuthError } from "./authErrors";
import { useAuth } from "./AuthProvider";
import { useUserDoc } from "./useUserDoc";

type Task = "export" | "reset" | "delete";

const inputCls =
  "h-11 rounded-xl border border-line bg-surface px-3.5 text-[15px] text-ink transition focus:outline-none focus:border-accent focus:shadow-ring disabled:opacity-50";

const LEVEL_OPTIONS = [{ value: "foundation", label: "Foundation (kana)" }, ...LEVELS.map((l) => ({ value: l, label: `JLPT ${LEVEL_LABEL[l]}` }))];

/**
 * Identity check shown inside an open panel. Declared at module level, not inside
 * AccountDataSection: a component defined during render gets a new identity on every render,
 * so React would unmount and remount this subtree and the password field would lose focus
 * after each keystroke.
 */
function ReauthField({ id, needsPassword, value, onChange }: { id: string; needsPassword: boolean; value: string; onChange: (v: string) => void }) {
  if (!needsPassword) return <p className="text-sm text-muted">You will be asked to confirm with Google.</p>;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-1.5">
        Confirm your password
      </label>
      <input id={id} type="password" autoComplete="current-password" value={value} onChange={(e) => onChange(e.target.value)} className={`w-full max-w-xs ${inputCls}`} />
    </div>
  );
}

/**
 * Export, reset and delete, the three things a learner could not do before.
 *
 * Each one re-authenticates first: the server rejects a token whose sign-in is older than ten
 * minutes, so a borrowed laptop with a live session cannot wipe an account. Google accounts
 * get a popup; password accounts are asked for their password here.
 */
export function AccountDataSection() {
  const { user } = useAuth();
  const { refresh } = useUserDoc();
  const router = useRouter();
  const [task, setTask] = useState<Task | null>(null);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [scope, setScope] = useState<"all" | "level">("all");
  const [level, setLevel] = useState<string>("n5");
  const [msg, setMsg] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const pwId = useId();
  const confirmId = useId();
  const needsPassword = user ? reauthNeeds(user) === "password" : false;

  function open(next: Task) {
    setTask(task === next ? null : next);
    setMsg(null);
    setPassword("");
    setConfirmText("");
  }

  async function run(which: Task) {
    if (!user) return setMsg({ tone: "warn", text: "Your session has expired. Please sign in again." });
    if (needsPassword && !password) return setMsg({ tone: "warn", text: "Enter your password to confirm." });
    if (which === "delete" && confirmText !== "DELETE") return setMsg({ tone: "warn", text: "Type DELETE exactly to confirm." });

    setBusy(true);
    setMsg(null);
    try {
      const token = await freshIdToken(user, password || undefined);
      if (which === "export") {
        await exportData(token);
        setMsg({ tone: "ok", text: "Your data has been downloaded." });
      } else if (which === "reset") {
        const summary = await resetProgress(token, scope === "all" ? { kind: "all" } : { kind: "level", level });
        setMsg({
          tone: "ok",
          text:
            scope === "all"
              ? `Progress reset: ${summary.deleted.progress ?? 0} studied items cleared and your plan is back to day 1.`
              : `${LEVEL_OPTIONS.find((o) => o.value === level)?.label} reset: ${summary.deleted.progress ?? 0} studied items and their review entries cleared. Your history and totals are unchanged.`,
        });
        setTask(null);
        // The profile reads the user document client-side, so a router refresh alone would
        // leave the old day and streak on screen.
        await refresh();
        router.refresh();
      } else {
        await deleteAccount(token);
        await clearSession();
        router.push("/");
        router.refresh();
        return;
      }
      setPassword("");
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      setMsg({ tone: "warn", text: raw === "password-required" ? "Enter your password to confirm." : friendlyAuthError(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="text-h2">Your data</h2>
      <p className="mt-1 text-sm text-muted">Take a copy, start over, or close your account.</p>

      <div className="mt-5 divide-y divide-line">
        {/* ---- Export ---- */}
        <div className="py-4 first:pt-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-medium">Download my data</h3>
              <p className="text-sm text-muted">Everything stored about your account, as a JSON file.</p>
            </div>
            <Button variant="outline" onClick={() => open("export")} disabled={busy}>
              {task === "export" ? "Cancel" : "Download"}
            </Button>
          </div>
          {task === "export" && (
            <div className="mt-4 space-y-3">
              <ReauthField id={`${pwId}-export`} needsPassword={needsPassword} value={password} onChange={setPassword} />
              <div className="pt-1">
                <Button onClick={() => run("export")} disabled={busy}>
                  {busy ? "Preparing..." : "Confirm and download"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ---- Reset ---- */}
        <div className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-medium">Reset my progress</h3>
              <p className="text-sm text-muted">Clear what you have studied and start again. Your account and settings stay.</p>
            </div>
            <Button variant="outline" onClick={() => open("reset")} disabled={busy}>
              {task === "reset" ? "Cancel" : "Reset"}
            </Button>
          </div>
          {task === "reset" && (
            <div className="mt-4 space-y-3">
              <fieldset>
                <legend className="text-sm font-medium mb-2">What to reset</legend>
                <div className="space-y-2 text-sm">
                  <label className="flex items-start gap-2.5">
                    <input type="radio" name="reset-scope" className="mt-1" checked={scope === "all"} onChange={() => setScope("all")} />
                    <span>
                      <span className="text-ink">Everything.</span>{" "}
                      <span className="text-muted">Progress, review queue, quiz and exam history, saved items, streak and totals. Your plan returns to day 1.</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2.5">
                    <input type="radio" name="reset-scope" className="mt-1" checked={scope === "level"} onChange={() => setScope("level")} />
                    <span>
                      <span className="text-ink">One level only.</span>{" "}
                      <span className="text-muted">Its progress and review items. History and lifetime totals are kept.</span>
                    </span>
                  </label>
                </div>
                {scope === "level" && (
                  <select value={level} onChange={(e) => setLevel(e.target.value)} className={`mt-3 w-full max-w-xs ${inputCls}`} aria-label="Level to reset">
                    {LEVEL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                )}
              </fieldset>
              <ReauthField id={`${pwId}-reset`} needsPassword={needsPassword} value={password} onChange={setPassword} />
              <div className="pt-1">
                <Button onClick={() => run("reset")} disabled={busy}>
                  {busy ? "Resetting..." : scope === "all" ? "Reset everything" : "Reset this level"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ---- Delete ---- */}
        <div className="py-4 last:pb-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-medium">Delete my account</h3>
              <p className="text-sm text-muted">Removes your sign-in and every record permanently. This cannot be undone.</p>
            </div>
            <Button variant="outline" onClick={() => open("delete")} disabled={busy}>
              {task === "delete" ? "Cancel" : "Delete"}
            </Button>
          </div>
          {task === "delete" && (
            <div className="mt-4 space-y-3">
              <Callout tone="warn" title="This is permanent">
                Your study history, progress and saved items are deleted and cannot be recovered. Download your data first if you want a copy.
              </Callout>
              <div>
                <label htmlFor={confirmId} className="block text-sm font-medium mb-1.5">
                  Type <span className="font-mono text-ink">DELETE</span> to confirm
                </label>
                <input id={confirmId} type="text" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" className={`w-full max-w-xs ${inputCls}`} />
              </div>
              <ReauthField id={`${pwId}-delete`} needsPassword={needsPassword} value={password} onChange={setPassword} />
              <div className="pt-1">
                <Button onClick={() => run("delete")} disabled={busy || confirmText !== "DELETE"}>
                  {busy ? "Deleting..." : "Delete my account permanently"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* One message for the whole card, so a confirmation survives its panel closing. */}
      {msg && (
        <div role="status" className="mt-4">
          <Callout tone={msg.tone}>{msg.text}</Callout>
        </div>
      )}
    </Card>
  );
}
