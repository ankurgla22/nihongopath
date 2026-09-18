"use client";
/**
 * One-line note under an in-lesson "Quick check" that adapts to the auth state:
 * a visitor is invited to sign in; a signed-in learner is pointed at Drills instead.
 */
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";

export function QuickCheckNote() {
  const { user, loading } = useAuth();
  if (loading) return <p className="text-muted mt-1.5 text-sm" aria-hidden />;
  return (
    <p className="text-muted mt-1.5 text-sm">
      {user ? (
        <>
          Answers here don&apos;t count toward your schedule — use Drills on your{" "}
          <Link href="/daily-study" className="font-medium text-accent hover:underline">Daily study</Link> page for that.
        </>
      ) : (
        <>
          <Link href="/login" className="font-medium text-accent hover:underline">Sign in</Link> to make answers count toward your review schedule.
        </>
      )}
    </p>
  );
}
