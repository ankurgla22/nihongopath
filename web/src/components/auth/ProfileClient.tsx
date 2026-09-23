"use client";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";
import { Button, Callout, Card } from "@/components/ui";
import { getClientAuth } from "@/lib/firebase/client";
import { updateUser } from "@/lib/firestore/repo";
import type { SessionUser } from "@/lib/firebase/session";
import { CURRICULUM_DAYS } from "@/lib/engine/progress";
import { phaseOf } from "@/lib/study/service";
import { useAuth } from "./AuthProvider";
import { useUserDoc } from "./useUserDoc";
import { friendlyAuthError } from "./authErrors";
import { clearSession } from "./sessionClient";

/** "Sep 18" or "Sep 18, 2026" from an ISO timestamp or YYYY-MM-DD string. */
function friendlyDate(iso: string, opts: { year?: boolean } = {}): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(opts.year ? { year: "numeric" } : {}) });
}

const inputCls = "h-11 rounded-xl border border-line bg-surface px-3.5 text-[15px] text-ink transition focus:outline-none focus:border-accent focus:shadow-ring disabled:opacity-50";

/** Accessible toggle switch (role="switch"); neutral styling so the Save button stays the page's only primary. */
function Switch({ id, checked, onChange, disabled, labelledBy }: { id: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; labelledBy: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition focus-visible:shadow-ring disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? "bg-ink border-ink" : "bg-line-strong border-line-strong"
      }`}
    >
      <span aria-hidden className={`absolute top-0.5 h-[1.125rem] w-[1.125rem] rounded-full bg-white shadow-sm transition-[left] ${checked ? "left-[1.375rem]" : "left-0.5"}`} />
    </button>
  );
}

export function ProfileClient({ sessionUser }: { sessionUser: SessionUser }) {
  const { user, configured } = useAuth();
  const { userDoc, loading, error, refresh } = useUserDoc();
  const router = useRouter();
  const [name, setName] = useState(sessionUser.name ?? "");
  const [minutes, setMinutes] = useState(125);
  const [furigana, setFurigana] = useState(true);
  const [currentDay, setCurrentDay] = useState(1);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const furiganaId = useId();
  const furiganaLabelId = useId();

  useEffect(() => {
    if (userDoc) {
      setName(userDoc.displayName ?? user?.displayName ?? sessionUser.name ?? "");
      setMinutes(userDoc.settings.dailyMinutesTarget);
      setFurigana(userDoc.settings.showFurigana);
      setCurrentDay(userDoc.currentDay);
    }
  }, [userDoc, user, sessionUser.name]);

  const email = user?.email ?? sessionUser.email;
  const photo = user?.photoURL ?? sessionUser.picture;
  const displayName = name || email || "Learner";
  const started = userDoc ? friendlyDate(userDoc.createdAt) : null;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!user) return setMsg({ tone: "warn", text: "Your browser session has expired. Please log in again." });
    setSaving(true);
    setMsg(null);
    try {
      const trimmed = name.trim();
      const target = Math.max(15, Math.min(480, Math.round(minutes) || 125));
      if (trimmed !== (user.displayName ?? "")) {
        const { updateProfile } = await import("firebase/auth");
        await updateProfile(user, { displayName: trimmed });
      }
      // Current day (the former "Jump to a day" control): clamped to 1..180 and written with its phase.
      const dayRaw = Math.floor(Number(currentDay));
      const day = Number.isFinite(dayRaw) ? Math.max(1, Math.min(CURRICULUM_DAYS, dayRaw)) : (userDoc?.currentDay ?? 1);
      const dayChanged = userDoc ? day !== userDoc.currentDay : false;
      await updateUser(user.uid, {
        displayName: trimmed || null,
        settings: { dailyMinutesTarget: target, showFurigana: furigana },
        ...(dayChanged ? { currentDay: day, currentPhase: phaseOf(day) } : {}),
      });
      await refresh();
      setMsg({ tone: "ok", text: "Saved." });
      router.refresh();
    } catch (err) {
      setMsg({ tone: "warn", text: friendlyAuthError(err) });
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    if (configured) {
      const { signOut } = await import("firebase/auth");
      await signOut((await getClientAuth()));
    }
    await clearSession();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="max-w-2xl space-y-6 pb-16 animate-rise-2">
      {/* Identity */}
      <div className="flex flex-wrap items-center gap-4">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" width={64} height={64} referrerPolicy="no-referrer" className="h-16 w-16 rounded-2xl bg-surface object-cover" />
        ) : (
          <span className="h-16 w-16 rounded-2xl bg-accent-soft text-accent-ink text-2xl font-semibold grid place-items-center">{displayName.charAt(0).toUpperCase()}</span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xl font-semibold truncate">{displayName}</p>
          {email && <p className="text-sm text-muted truncate">{email}</p>}
          {userDoc && (
            <p className="text-sm text-muted tabular-nums">
              Day {userDoc.currentDay} of {CURRICULUM_DAYS}
              {started && ` · started ${started}`}
            </p>
          )}
        </div>
      </div>

      {/* Settings */}
      <Card>
        <form onSubmit={save} className="space-y-6">
          <h2 className="text-h2">Settings</h2>
          {!configured && <Callout tone="warn">Firebase is not configured in this browser build, so settings cannot be saved.</Callout>}
          {error && <Callout tone="warn">{error}</Callout>}

          <div>
            <label htmlFor="displayName" className="block text-sm font-medium mb-1.5">
              Display name
            </label>
            <input id="displayName" type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={`w-full ${inputCls}`} />
          </div>

          <div>
            <label htmlFor="minutes" className="block text-sm font-medium mb-1.5">
              Daily study target
            </label>
            <div className="flex items-center gap-3">
              <input id="minutes" type="number" inputMode="numeric" min={15} max={480} step={5} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className={`w-28 tabular-nums ${inputCls}`} />
              <span className="text-sm text-muted">minutes a day</span>
            </div>
          </div>

          <div>
            <label htmlFor="jump-day" className="block text-sm font-medium mb-1.5">
              Current day
            </label>
            <div className="flex items-center gap-3">
              <input
                id="jump-day"
                type="number"
                inputMode="numeric"
                min={1}
                max={CURRICULUM_DAYS}
                value={currentDay}
                onChange={(e) => setCurrentDay(Number(e.target.value))}
                disabled={loading || !userDoc}
                className={`w-28 tabular-nums ${inputCls}`}
              />
              <span className="text-sm text-muted tabular-nums">of {CURRICULUM_DAYS}</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span id={furiganaLabelId} className="text-sm font-medium">
              Show furigana
            </span>
            <Switch id={furiganaId} labelledBy={furiganaLabelId} checked={furigana} onChange={setFurigana} />
          </div>

          {msg && (
            <div role="status">
              <Callout tone={msg.tone}>{msg.text}</Callout>
            </div>
          )}
          <div className="pt-1">
            <Button type="submit" disabled={saving || loading || !configured}>
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </form>
      </Card>

      <div>
        <Button variant="outline" onClick={logout}>
          Log out
        </Button>
      </div>
    </div>
  );
}
