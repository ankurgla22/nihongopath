import { Suspense } from "react";
import { pageMetadata } from "@/lib/seo/metadata";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = pageMetadata({
  title: "Log in",
  description: "Log in to continue your Japanese study plan and keep your progress.",
  path: "/login",
  noIndex: true,
});

export default function LoginPage() {
  return (
    <AuthPageShell title="Welcome back" subtitle="Log in to continue your daily study.">
      <Suspense fallback={<div className="space-y-3" aria-busy="true" aria-label="Loading"><div className="skeleton h-11" /><div className="skeleton h-11" /><div className="skeleton h-11" /></div>}>
        <LoginForm />
      </Suspense>
    </AuthPageShell>
  );
}
