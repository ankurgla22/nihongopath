"use client";
import { useCallback, useEffect, useState } from "react";
import type { UserDoc } from "@/lib/firestore/types";
import { ensureUser } from "@/lib/firestore/repo";
import { useAuth } from "./AuthProvider";

/** Loads (creating if needed) the users/{uid} document for the signed-in user. */
export function useUserDoc(): { userDoc: UserDoc | null; loading: boolean; error: string | null; refresh: () => Promise<void> } {
  const { user, loading: authLoading } = useAuth();
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setUserDoc(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const d = await ensureUser({ uid: user.uid, email: user.email, displayName: user.displayName, photoURL: user.photoURL });
      setUserDoc(d);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your profile.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void refresh();
  }, [authLoading, refresh]);

  return { userDoc, loading: authLoading || loading, error, refresh };
}
