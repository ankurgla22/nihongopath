"use client";
/**
 * One-line note under an in-lesson "Quick check", shown only to visitors: an invitation to sign in.
 * A signed-in learner sees nothing (no framing between the heading and the first question).
 */
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";

export function QuickCheckNote() {
  const { user, loading } = useAuth();
  if (loading || user) return null;
  return (
    <p className="text-muted mt-1.5 mb-4 text-sm">
      <Link href="/login" className="font-medium text-accent hover:underline">Sign in</Link> to make answers count toward your review schedule.
    </p>
  );
}
