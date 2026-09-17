import { Suspense } from "react";
import { pageMetadata } from "@/lib/seo/metadata";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { SignupForm } from "@/components/auth/SignupForm";

export const metadata = pageMetadata({
  title: "Create an account",
  description: "Create a free account to follow the 180-day JLPT N2 plan and save your progress.",
  path: "/signup",
  noIndex: true,
});

export default function SignupPage() {
  return (
    <AuthPageShell title="Create your account" subtitle="Free. Your progress, streak and review queue are saved across devices.">
      <Suspense fallback={<div className="space-y-3" aria-busy="true" aria-label="Loading"><div className="skeleton h-11" /><div className="skeleton h-11" /><div className="skeleton h-11" /></div>}>
        <SignupForm />
      </Suspense>
    </AuthPageShell>
  );
}
