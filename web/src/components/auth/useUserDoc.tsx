"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { UserDoc } from "@/lib/firestore/types";
import { ensureUser } from "@/lib/firestore/repo";
import { useAuth } from "./AuthProvider";

export type UserDocState = { userDoc: UserDoc | null; loading: boolean; error: string | null; refresh: () => Promise<void> };

const UserDocContext = createContext<UserDocState | null>(null);

/**
 * The users/{uid} document, shared by every component that needs it.
 *
 * This was a plain hook, so each of its nine call sites held its own copy: nine `ensureUser`
 * round trips on a private page, and a `refresh()` in one component left the others stale.
 * That is how "Reset my progress" could report success while the profile above it still showed
 * the old day and streak. One provider means one fetch and one refresh that everybody sees.
 */
export function UserDocProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Guards against two overlapping refreshes applying out of order, and against a write
  // landing after sign-out.
  const runRef = useRef(0);

  const refresh = useCallback(async () => {
    const run = ++runRef.current;
    if (!user) {
      setUserDoc(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const d = await ensureUser({ uid: user.uid, email: user.email, displayName: user.displayName, photoURL: user.photoURL });
      if (run !== runRef.current) return;
      setUserDoc(d);
      setError(null);
    } catch (err) {
      if (run !== runRef.current) return;
      setError(err instanceof Error ? err.message : "Could not load your profile.");
    } finally {
      if (run === runRef.current) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void refresh();
  }, [authLoading, refresh]);

  const value = useMemo<UserDocState>(() => ({ userDoc, loading: authLoading || loading, error, refresh }), [userDoc, authLoading, loading, error, refresh]);
  return <UserDocContext.Provider value={value}>{children}</UserDocContext.Provider>;
}

/** Loads (creating if needed) the users/{uid} document for the signed-in user. */
export function useUserDoc(): UserDocState {
  const ctx = useContext(UserDocContext);
  if (!ctx) throw new Error("useUserDoc must be used inside <UserDocProvider> (mounted in the root layout).");
  return ctx;
}
