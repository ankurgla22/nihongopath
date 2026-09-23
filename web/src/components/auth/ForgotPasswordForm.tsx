"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button, Callout } from "@/components/ui";
import { getClientAuth } from "@/lib/firebase/client";
import { useAuth } from "./AuthProvider";
import { AuthField } from "./AuthField";
import { NotConfigured } from "./NotConfigured";
import { friendlyAuthError } from "./authErrors";

export function ForgotPasswordForm() {
  const { configured } = useAuth();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!configured) return <NotConfigured />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { sendPasswordResetEmail } = await import("firebase/auth");
      await sendPasswordResetEmail((await getClientAuth()), email.trim());
      setSent(true);
    } catch (err) {
      // Do not reveal whether the address exists.
      const code = (err as { code?: string })?.code;
      if (code === "auth/user-not-found") setSent(true);
      else setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <Callout
          tone="ok"
          title="Check your inbox"
          icon={
            <svg className="h-5 w-5 text-ok" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
          }
        >
          If an account exists for <strong className="text-ink">{email}</strong>, we have sent a link to reset your password. It may take a minute to arrive; check spam too.
        </Callout>
        <Button href="/login" variant="secondary" className="w-full" size="lg">
          Back to log in
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <AuthField id="email" label="Email" type="email" autoComplete="email" placeholder="you@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
      {error && (
        <div role="alert">
          <Callout tone="warn" title="Could not send the link">
            {error}
          </Callout>
        </div>
      )}
      <Button type="submit" disabled={busy || !email} className="w-full" size="lg">
        {busy ? "Sending..." : "Send reset link"}
      </Button>
      <p className="text-sm text-muted text-center">
        Remembered it?{" "}
        <Link href="/login" className="text-accent font-medium underline underline-offset-2">
          Log in
        </Link>
      </p>
    </form>
  );
}
