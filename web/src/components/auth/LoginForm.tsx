"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Callout } from "@/components/ui";
import { getClientAuth } from "@/lib/firebase/client";
import { useAuth } from "./AuthProvider";
import { AuthField, GoogleButton, OrDivider } from "./AuthField";
import { NotConfigured } from "./NotConfigured";
import { friendlyAuthError } from "./authErrors";
import { establishSession, safeNext } from "./sessionClient";

export function LoginForm() {
  const { user, loading, configured } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in (e.g. returning with a live Firebase session): go where they were headed.
  useEffect(() => {
    if (!loading && user && !busy) {
      establishSession(user)
        .then(() => router.replace(next))
        .catch((e) => setError(friendlyAuthError(e)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  if (!configured) return <NotConfigured />;

  async function finish(u: import("firebase/auth").User) {
    await establishSession(u, { force: true });
    router.replace(next);
    router.refresh();
  }

  async function withGoogle() {
    setBusy(true);
    setError(null);
    try {
      const { GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
      const cred = await signInWithPopup(getClientAuth(), new GoogleAuthProvider());
      await finish(cred.user);
    } catch (e) {
      setError(friendlyAuthError(e));
      setBusy(false);
    }
  }

  async function withEmail(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { signInWithEmailAndPassword } = await import("firebase/auth");
      const cred = await signInWithEmailAndPassword(getClientAuth(), email.trim(), password);
      await finish(cred.user);
    } catch (err) {
      setError(friendlyAuthError(err));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <GoogleButton onClick={withGoogle} disabled={busy} />
      <OrDivider />
      <form onSubmit={withEmail} className="space-y-4" noValidate>
        <AuthField id="email" label="Email" type="email" autoComplete="email" placeholder="you@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <div>
          <AuthField
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="mt-1.5 text-right">
            <Link href="/forgot-password" className="text-xs text-muted hover:text-ink underline underline-offset-2">
              Forgot password?
            </Link>
          </div>
        </div>
        {error && (
          <div role="alert">
            <Callout tone="warn" title="Could not log in">
              {error}
            </Callout>
          </div>
        )}
        <Button type="submit" disabled={busy} className="w-full" size="lg">
          {busy ? "Logging in..." : "Log in"}
        </Button>
      </form>
      <p className="text-sm text-muted text-center">
        New here?{" "}
        <Link href={`/signup?next=${encodeURIComponent(next)}`} className="text-accent font-medium underline underline-offset-2">
          Create an account
        </Link>
      </p>
    </div>
  );
}
