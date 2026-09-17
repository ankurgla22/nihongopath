"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Callout } from "@/components/ui";
import { getClientAuth } from "@/lib/firebase/client";
import { useAuth } from "./AuthProvider";
import { AuthField, GoogleButton, OrDivider } from "./AuthField";
import { NotConfigured } from "./NotConfigured";
import { friendlyAuthError } from "./authErrors";
import { establishSession, safeNext } from "./sessionClient";

export function SignupForm() {
  const { configured } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
    if (!name.trim()) return setError("Please enter your name.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    setBusy(true);
    try {
      const { createUserWithEmailAndPassword, updateProfile } = await import("firebase/auth");
      const cred = await createUserWithEmailAndPassword(getClientAuth(), email.trim(), password);
      await updateProfile(cred.user, { displayName: name.trim() });
      await cred.user.reload();
      await finish(getClientAuth().currentUser ?? cred.user);
    } catch (err) {
      setError(friendlyAuthError(err));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <GoogleButton onClick={withGoogle} disabled={busy} label="Sign up with Google" />
      <OrDivider />
      <form onSubmit={withEmail} className="space-y-4" noValidate>
        <AuthField id="name" label="Name" type="text" autoComplete="name" placeholder="How should we greet you?" required value={name} onChange={(e) => setName(e.target.value)} />
        <AuthField id="email" label="Email" type="email" autoComplete="email" placeholder="you@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <AuthField
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          required
          minLength={6}
          hint="At least 6 characters."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <div role="alert">
            <Callout tone="warn" title="Could not create the account">
              {error}
            </Callout>
          </div>
        )}
        <Button type="submit" disabled={busy} className="w-full" size="lg">
          {busy ? "Creating account..." : "Create account"}
        </Button>
      </form>
      <p className="text-sm text-muted text-center">
        Already have an account?{" "}
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-accent font-medium underline underline-offset-2">
          Log in
        </Link>
      </p>
    </div>
  );
}
