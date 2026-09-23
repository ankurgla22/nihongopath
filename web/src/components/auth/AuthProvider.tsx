"use client";
/**
 * Provides the Firebase Auth user to client components and keeps the server session
 * cookie in sync: on sign-in it ensures the Firestore user doc exists and POSTs the ID
 * token to /api/auth/session; on sign-out it DELETEs the cookie.
 */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import { firebaseConfigured, getClientAuth } from "@/lib/firebase/client";
import { clearSession, establishSession } from "./sessionClient";

export type AuthState = { user: User | null; loading: boolean; configured: boolean };
export const AuthContext = createContext<AuthState>({ user: null, loading: true, configured: false });
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(firebaseConfigured);
  const hadUser = useRef(false);

  useEffect(() => {
    if (!firebaseConfigured) return;
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    // Wait for the browser to be idle before pulling in the auth SDK: on a public lesson page
    // nothing above the fold depends on the user, so this must not compete with first paint.
    const idle = (cb: () => void) => (typeof requestIdleCallback === "function" ? requestIdleCallback(cb, { timeout: 2000 }) : setTimeout(cb, 200));
    idle(() => {
    (async () => {
      const { onIdTokenChanged } = await import("firebase/auth");
      if (cancelled) return;
      unsubscribe = onIdTokenChanged((await getClientAuth()), async (u) => {
        setUser(u);
        setLoading(false);
        if (u) {
          try {
            // Token-change listener: establishSession dedupes by token, so this only posts when it changed.
            await establishSession(u);
          } catch (err) {
            console.warn("Session sync failed", err);
          }
        } else if (hadUser.current) {
          await clearSession();
          router.refresh();
        }
        hadUser.current = Boolean(u);
      });
    })().catch((err) => {
      console.warn("Firebase Auth failed to initialise", err);
      setLoading(false);
    });
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [router]);

  return <AuthContext.Provider value={{ user, loading, configured: firebaseConfigured }}>{children}</AuthContext.Provider>;
}
