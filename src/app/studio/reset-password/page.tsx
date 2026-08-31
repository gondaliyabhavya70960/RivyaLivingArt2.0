import Link from "next/link";

import { resetPassword } from "@/actions/auth-public";
import { AuthShell, AuthBanner } from "@/components/studio/auth-shell";
import { PasswordField } from "@/components/studio/password-field";
import { SubmitButton } from "@/components/studio/submit-button";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const params = await searchParams;
  const token = params.token ?? "";

  if (!token) {
    return (
      <AuthShell
        title="Reset link needed"
        subtitle="This page needs a valid reset link."
        footer={
          <Link
            href="/studio/forgot-password"
            className="font-medium text-sapphire-ink hover:opacity-80"
          >
            Request a reset link
          </Link>
        }
      >
        <AuthBanner tone="error">
          Your reset link is missing or incomplete. Request a new one to
          continue.
        </AuthBanner>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Set a new password for your studio account. Use at least 8 characters."
      footer={
        <Link
          href="/studio/login"
          className="font-medium text-sapphire-ink hover:opacity-80"
        >
          Back to sign in
        </Link>
      }
    >
      <div className="space-y-4">
        {params.error && <AuthBanner tone="error">{params.error}</AuthBanner>}

        <form action={resetPassword} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <PasswordField
            id="password"
            name="password"
            label="New password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />
          <PasswordField
            id="confirm"
            name="confirm"
            label="Confirm new password"
            autoComplete="new-password"
          />
          <SubmitButton>Update password</SubmitButton>
        </form>
      </div>
    </AuthShell>
  );
}
