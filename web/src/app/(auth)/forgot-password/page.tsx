import { pageMetadata } from "@/lib/seo/metadata";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata = pageMetadata({
  title: "Reset your password",
  description: "Request a password reset link for your account.",
  path: "/forgot-password",
  noIndex: true,
});

export default function ForgotPasswordPage() {
  return (
    <AuthPageShell title="Reset your password" subtitle="Enter your email and we will send you a reset link.">
      <ForgotPasswordForm />
    </AuthPageShell>
  );
}
