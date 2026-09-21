"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";

/** Sends a signed-in learner from the static home page to Today. Renders nothing. */
export function RedirectIfSignedIn({ to = "/dashboard" }: { to?: string }) {
  const { user } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (user) router.replace(to);
  }, [user, router, to]);
  return null;
}
