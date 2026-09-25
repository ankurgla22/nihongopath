"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Button, Callout, Card } from "@/components/ui";
import { changeEmail, changePassword, reauthNeeds, sendVerification } from "./accountActions";
import { friendlyAuthError } from "./authErrors";
import { useAuth } from "./AuthProvider";

const inputCls =
  "h-11 rounded-xl border border-line bg-surface px-3.5 text-[15px] text-ink transition focus:outline-none focus:border-accent focus:shadow-ring disabled:opacity-50";

/** Firebase's own minimum. Anything shorter is rejected by the server, so say so before the round trip. */
const MIN_PASSWORD = 6;

/**
 * Sign-in details: the email address, its verification, and the password.
 *
 * Verification matters because a typo'd address locks the learner out of password reset, the
 * only recovery route the site has. Password change matters because the signed-out "forgot
 * password" flow was previously the only way to set a new one.
 *
 * Google accounts see neither control: their address and credential belong to Google, so
 * changing them here would only desync the two.
 */
export function SecuritySection() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailPw, setEmailPw] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [verifyMsg, setVerifyMsg] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  // Read once on mount: Firebase only refreshes emailVerified when the user object reloads.
  const [verified, setVerified] = useState<boolean | null>(null);
  const curId = useId();
  const newId = useId();
  const confirmId = useId();
  const emailId = useId();
  const emailPwId = useId();
  const msgRef = useRef<HTMLDivElement>(null);
  const verifyMsgRef = useRef<HTMLDivElement>(null);
  // Set only where a successful submit collapses its panel. That unmounts the button that had
  // focus, so focus would fall back to the document and the next Tab would start at the top of
  // the page, while the answer to "did that work?" sits where the panel used to be.
  const [focusTarget, setFocusTarget] = useState<"msg" | "verify" | null>(null);

  useEffect(() => {
    if (!focusTarget) return;
    (focusTarget === "msg" ? msgRef : verifyMsgRef).current?.focus();
    setFocusTarget(null);
  }, [focusTarget]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    // The flag on the cached user can be stale if they verified in another tab.
    user
      .reload()
      .then(() => !cancelled && setVerified(user.emailVerified))
      .catch(() => !cancelled && setVerified(user.emailVerified));
    return () => {
      cancelled = true;
    };
  }, [user]);

  const isPasswordAccount = user ? reauthNeeds(user) === "password" : false;

  async function resend() {
    if (!user) return;
    setSending(true);
    setVerifyMsg(null);
    try {
      await sendVerification(user);
      setVerifyMsg({ tone: "ok", text: `Verification email sent to ${user.email}. Check your inbox, then reload this page.` });
    } catch (err) {
      setVerifyMsg({ tone: "warn", text: friendlyAuthError(err) });
    } finally {
      setSending(false);
    }
  }

  async function submitEmail() {
    if (!user) return setVerifyMsg({ tone: "warn", text: "Your session has expired. Please sign in again." });
    const target = newEmail.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(target)) return setVerifyMsg({ tone: "warn", text: "Enter a valid email address." });
    if (target.toLowerCase() === (user.email ?? "").toLowerCase()) return setVerifyMsg({ tone: "warn", text: "That is already your address." });
    if (isPasswordAccount && !emailPw) return setVerifyMsg({ tone: "warn", text: "Enter your password to confirm." });

    setEmailBusy(true);
    setVerifyMsg(null);
    try {
      await changeEmail(user, emailPw || undefined, target);
      setVerifyMsg({ tone: "ok", text: `Check ${target} for a confirmation link. Your address changes only after you open it, and you sign in with the new address from then on.` });
      setEmailOpen(false);
      setFocusTarget("verify");
      setNewEmail("");
      setEmailPw("");
    } catch (err) {
      setVerifyMsg({ tone: "warn", text: friendlyAuthError(err) });
    } finally {
      setEmailBusy(false);
    }
  }

  async function submit() {
    if (!user) return setMsg({ tone: "warn", text: "Your session has expired. Please sign in again." });
    if (!current) return setMsg({ tone: "warn", text: "Enter your current password." });
    if (next.length < MIN_PASSWORD) return setMsg({ tone: "warn", text: `Your new password must be at least ${MIN_PASSWORD} characters.` });
    if (next !== confirm) return setMsg({ tone: "warn", text: "The two new passwords do not match." });
    if (next === current) return setMsg({ tone: "warn", text: "The new password is the same as the current one." });

    setBusy(true);
    setMsg(null);
    try {
      await changePassword(user, current, next);
      setMsg({ tone: "ok", text: "Password changed. It applies the next time you sign in." });
      setCurrent("");
      setNext("");
      setConfirm("");
      setOpen(false);
      setFocusTarget("msg");
    } catch (err) {
      setMsg({ tone: "warn", text: friendlyAuthError(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="text-h2">Sign-in</h2>
      <p className="mt-1 text-sm text-muted">How you get into your account.</p>

      <div className="mt-5 divide-y divide-line">
        {/* ---- Email address and verification ---- */}
        <div className="py-4 first:pt-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-medium">Email address</h3>
              <p className="text-sm text-muted break-all">{user?.email ?? "Not signed in"}</p>
              {verified === false && <p className="mt-1 text-sm text-accent">Not verified. Verify it so you can reset your password if you forget it.</p>}
              {verified === true && <p className="mt-1 text-sm text-muted">Verified.</p>}
              {!isPasswordAccount && <p className="mt-1 text-sm text-muted">Managed by your Google account.</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {verified === false && (
                <Button variant="outline" onClick={resend} disabled={sending}>
                  {sending ? "Sending..." : "Send verification email"}
                </Button>
              )}
              {isPasswordAccount && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setEmailOpen(!emailOpen);
                    setVerifyMsg(null);
                  }}
                  disabled={emailBusy}
                >
                  {emailOpen ? "Cancel" : "Change email"}
                </Button>
              )}
            </div>
          </div>

          {isPasswordAccount && emailOpen && (
            <div className="mt-4 space-y-3 max-w-xs">
              <div>
                <label htmlFor={emailId} className="block text-sm font-medium mb-1.5">
                  New email address
                </label>
                <input id={emailId} type="email" autoComplete="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={`w-full ${inputCls}`} />
              </div>
              <div>
                <label htmlFor={emailPwId} className="block text-sm font-medium mb-1.5">
                  Confirm your password
                </label>
                <input id={emailPwId} type="password" autoComplete="current-password" value={emailPw} onChange={(e) => setEmailPw(e.target.value)} className={`w-full ${inputCls}`} />
              </div>
              <p className="text-sm text-muted">We send a link to the new address. The change happens only when you open it.</p>
              <div className="pt-1">
                <Button onClick={submitEmail} disabled={emailBusy}>
                  {emailBusy ? "Sending..." : "Send confirmation link"}
                </Button>
              </div>
            </div>
          )}
          {/* Errors are announced assertively: a polite live region can be held back until the
              user stops interacting, and "that address is already yours" needs to land now. */}
          {verifyMsg && (
            <div ref={verifyMsgRef} tabIndex={-1} role={verifyMsg.tone === "warn" ? "alert" : "status"} className="mt-3 outline-none">
              <Callout tone={verifyMsg.tone}>{verifyMsg.text}</Callout>
            </div>
          )}
        </div>

        {/* ---- Password ---- */}
        <div className="py-4 last:pb-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-medium">Password</h3>
              <p className="text-sm text-muted">
                {isPasswordAccount ? "Change the password you sign in with." : "You sign in with Google, so this account has no password to change."}
              </p>
            </div>
            {isPasswordAccount && (
              <Button
                variant="outline"
                onClick={() => {
                  setOpen(!open);
                  setMsg(null);
                }}
                disabled={busy}
              >
                {open ? "Cancel" : "Change password"}
              </Button>
            )}
          </div>

          {isPasswordAccount && open && (
            <div className="mt-4 space-y-3 max-w-xs">
              <div>
                <label htmlFor={curId} className="block text-sm font-medium mb-1.5">
                  Current password
                </label>
                <input id={curId} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={`w-full ${inputCls}`} />
              </div>
              <div>
                <label htmlFor={newId} className="block text-sm font-medium mb-1.5">
                  New password
                </label>
                <input id={newId} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={`w-full ${inputCls}`} />
                <p className="mt-1 text-sm text-muted">At least {MIN_PASSWORD} characters.</p>
              </div>
              <div>
                <label htmlFor={confirmId} className="block text-sm font-medium mb-1.5">
                  Confirm new password
                </label>
                <input id={confirmId} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={`w-full ${inputCls}`} />
              </div>
              <div className="pt-1">
                <Button onClick={submit} disabled={busy}>
                  {busy ? "Changing..." : "Change password"}
                </Button>
              </div>
            </div>
          )}

          {msg && (
            <div ref={msgRef} tabIndex={-1} role={msg.tone === "warn" ? "alert" : "status"} className="mt-3 outline-none">
              <Callout tone={msg.tone}>{msg.text}</Callout>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
