"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Callout } from "@/components/ui";
import { useAuth } from "./AuthProvider";

/** Renders children only for a signed-in user; otherwise a login prompt (or a custom fallback). */
export function SignedIn({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const { user, loading, configured } = useAuth();
  const pathname = usePathname();
  if (loading)
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Loading">
        <div className="skeleton h-4 w-2/3" />
        <div className="skeleton h-4 w-1/2" />
      </div>
    );
  if (user) return <>{children}</>;
  if (fallback !== undefined) return <>{fallback}</>;
  const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
  return (
    <Callout
      tone="accent"
      title={configured ? "Log in to continue" : "Sign-in is not set up"}
      icon={
        <svg className="h-5 w-5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
      }
    >
      {configured ? (
        <p>
          <Link href={`/login${next}`} className="text-accent font-medium underline underline-offset-2">
            Log in
          </Link>{" "}
          or{" "}
          <Link href={`/signup${next}`} className="text-accent font-medium underline underline-offset-2">
            create a free account
          </Link>{" "}
          to save your progress.
        </p>
      ) : (
        <p>Firebase is not configured for this site yet, so accounts are unavailable.</p>
      )}
    </Callout>
  );
}
