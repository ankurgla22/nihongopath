"use client";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";

const linkCls = "text-ink-2 hover:text-accent transition";

/** Footer session link: Profile when signed in, Log in otherwise. */
export function FooterAccount() {
  const { user, loading } = useAuth();

  if (loading) return <span className="skeleton inline-block h-4 w-12 rounded align-middle" aria-hidden />;

  if (!user) {
    return (
      <Link href="/login" className={linkCls}>
        Log in
      </Link>
    );
  }

  return (
    <Link href="/profile" className={linkCls}>
      Profile
    </Link>
  );
}
