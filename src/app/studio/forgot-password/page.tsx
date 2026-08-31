import Link from "next/link";

import { requestPasswordReset } from "@/actions/auth-public";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell, AuthBanner } from "@/components/studio/auth-shell";
import { SubmitButton } from "@/components/studio/submit-button";

export const metadata = { title: "Reset password" };

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const params = await searchParams;
  const sent = params.sent === "1";

  return (
    <AuthShell
      title="Reset your password"
      subtitle={
        sent
          ? undefined
          : "Enter your studio email and we'll send you a link to choose a new password."
      }
      footer={
        <span>
          Remembered it?{" "}
          <Link
            href="/studio/login"
            className="font-medium text-sapphire-ink hover:opacity-80"
          >
            Back to sign in
          </Link>
        </span>
      }
    >
      {sent ? (
        <AuthBanner tone="success">
          If that email belongs to a studio account, a reset link is on its way.
          The link expires in one hour — check your inbox (and spam).
        </AuthBanner>
      ) : (
        <form action={requestPasswordReset} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-foreground">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
          </div>
          <SubmitButton>Send reset link</SubmitButton>
        </form>
      )}
    </AuthShell>
  );
}
