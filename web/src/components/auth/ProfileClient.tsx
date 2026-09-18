"use client";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";
import { Badge, Button, Callout, Card, Stat } from "@/components/ui";
import { getClientAuth } from "@/lib/firebase/client";
import { updateUser } from "@/lib/firestore/repo";
import type { SessionUser } from "@/lib/firebase/session";
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

/** Accessible toggle switch (role="switch"). */
function Switch({ id, checked, onChange, disabled }: { id: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition focus-visible:shadow-ring disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? "bg-accent border-accent" : "bg-line-strong border-line-strong"
      }`}
    >
      <span aria-hidden className={`absolute top-0.5 h-[1.375rem] w-[1.375rem] rounded-full bg-white shadow-sm transition-[left] ${checked ? "left-[1.375rem]" : "left-0.5"}`} />
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
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const furiganaId = useId();
  const furiganaDescId = useId();

  useEffect(() => {
    if (userDoc) {
      setName(userDoc.displayName ?? user?.displayName ?? sessionUser.name ?? "");
      setMinutes(userDoc.settings.dailyMinutesTarget);
      setFurigana(userDoc.settings.showFurigana);
    }
  }, [userDoc, user, sessionUser.name]);

  const email = user?.email ?? sessionUser.email;
  const photo = user?.photoURL ?? sessionUser.picture;
  const displayName = name || email || "Learner";
  const joined = userDoc ? friendlyDate(userDoc.createdAt, { year: true }) : null;
  const started = userDoc ? friendlyDate(userDoc.createdAt) : null;
  const lastStudied = userDoc?.lastStudyDate ? friendlyDate(userDoc.lastStudyDate, { year: true }) : null;

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
      await updateUser(user.uid, {
        displayName: trimmed || null,
        settings: { dailyMinutesTarget: target, showFurigana: furigana },
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
      await signOut(getClientAuth());
    }
    await clearSession();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] pb-16 animate-rise-2">
      <div className="space-y-6 min-w-0">
        {/* Identity */}
        <Card className="relative overflow-hidden" padding="p-0">
          <div aria-hidden className="h-24 accent-gradient opacity-90" />
          <div className="px-5 sm:px-6 pb-6">
            <div className="-mt-8 flex flex-wrap items-end gap-4">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="" width={80} height={80} referrerPolicy="no-referrer" className="h-20 w-20 rounded-2xl border-4 border-surface bg-surface object-cover shadow-md" />
              ) : (
                <span className="h-20 w-20 rounded-2xl border-4 border-surface bg-accent-soft text-accent-ink text-3xl font-semibold grid place-items-center shadow-md">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1 pt-10 sm:pt-0 sm:pb-1">
                <p className="text-xl font-semibold truncate">{displayName}</p>
                {email && <p className="text-sm text-muted truncate">{email}</p>}
              </div>
              <div className="flex items-center gap-2 sm:pb-1">
                {userDoc && <Badge tone="accent" size="md">{userDoc.currentLevel.toUpperCase()}</Badge>}
                {joined && <Badge size="md">Joined {joined}</Badge>}
              </div>
            </div>
          </div>
        </Card>

        {/* Study stats */}
        <section aria-label="Study status">
          {loading ? (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4" aria-busy="true">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-24 rounded-2xl" />
              ))}
            </div>
          ) : userDoc ? (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
              <Stat label="Current day" value={<>{userDoc.currentDay}<span className="text-base text-muted font-normal"> / 180</span></>} hint={started ? `Started ${started}` : undefined} tone="accent" />
              <Stat label="Streak" value={userDoc.streak} hint={`day${userDoc.streak === 1 ? "" : "s"} · best ${userDoc.longestStreak}`} tone="ok" />
              <Stat label="Study time" value={<>{Math.round(userDoc.totalStudyMinutes / 60)}<span className="text-base text-muted font-normal"> h</span></>} hint="total" />
              <Stat label="Last studied" value={<span className="text-lg sm:text-xl">{lastStudied ?? "Not yet"}</span>} />
            </div>
          ) : (
            <Callout tone="neutral">Study data is unavailable right now.</Callout>
          )}
        </section>

        {/* Settings */}
        <Card>
          <form onSubmit={save} className="space-y-6">
            <div>
              <h2 className="text-h2">Settings</h2>
              <p className="text-sm text-muted mt-1">How your daily plan and lessons are shown.</p>
            </div>
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
                <input
                  id="minutes"
                  type="number"
                  inputMode="numeric"
                  min={15}
                  max={480}
                  step={5}
                  value={minutes}
                  onChange={(e) => setMinutes(Number(e.target.value))}
                  aria-describedby="minutes-hint"
                  className={`w-28 tabular-nums ${inputCls}`}
                />
                <span className="text-sm text-muted">minutes a day</span>
              </div>
              <p id="minutes-hint" className="text-xs text-muted mt-1.5">The 180-day plan assumes about 125 minutes a day. Your daily plan adapts to this target.</p>
            </div>

            <div className="flex items-start justify-between gap-4 rounded-xl border border-line bg-surface-2 px-4 py-3.5">
              <div className="min-w-0">
                <label htmlFor={furiganaId} className="block text-sm font-medium">
                  Show furigana
                </label>
                <p id={furiganaDescId} className="text-xs text-muted mt-0.5">
                  Readings above kanji in lessons, e.g.{" "}
                  <ruby lang="ja" className="ja">
                    漢字<rt>かんじ</rt>
                  </ruby>
                </p>
              </div>
              <Switch id={furiganaId} checked={furigana} onChange={setFurigana} />
            </div>

            {msg && (
              <div role="status">
                <Callout tone={msg.tone}>{msg.text}</Callout>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button type="submit" disabled={saving || loading || !configured}>
                {saving ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </form>
        </Card>
      </div>

      <aside className="space-y-6 min-w-0">
        <Card>
          <h2 className="text-[11px] uppercase tracking-[0.14em] text-muted mb-3">Session</h2>
          <p className="text-sm text-ink-2 leading-relaxed">You are signed in{email ? ` as ${email}` : ""}. Logging out clears this device only; your progress stays saved.</p>
          <Button variant="secondary" onClick={logout} className="w-full mt-4">
            Log out
          </Button>
        </Card>
        <Card className="bg-surface-2">
          <h2 className="text-[11px] uppercase tracking-[0.14em] text-muted mb-3">Shortcuts</h2>
          <div className="flex flex-col gap-2">
            <Button href="/daily-study" variant="secondary" size="sm" className="justify-start">Today&apos;s study</Button>
            <Button href="/progress" variant="secondary" size="sm" className="justify-start">Progress</Button>
            <Button href="/saved" variant="secondary" size="sm" className="justify-start">Saved items</Button>
          </div>
        </Card>
      </aside>
    </div>
  );
}
