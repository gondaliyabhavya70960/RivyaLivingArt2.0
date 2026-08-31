import Link from "next/link";

import { db } from "@/lib/db";
import { signUpFirstAdmin } from "@/actions/auth-public";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell, AuthBanner } from "@/components/studio/auth-shell";
import { PasswordField } from "@/components/studio/password-field";
import { SubmitButton } from "@/components/studio/submit-button";

export const metadata = { title: "Set up Studio" };

export default async function StudioSignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; closed?: string }>;
}) {
  const params = await searchParams;
  // Signup is a ONE-TIME owner bootstrap. Once any account exists it is closed
  // for good — Rivya Living Art has no public/customer accounts, and further staff are
  // invited from Studio → Users.
  const closed = params.closed === "1" || (await db.user.count()) > 0;

  if (closed) {
    return (
      <AuthShell
        title="Studio setup is complete"
        subtitle="This studio already has an account. New staff are invited by an administrator from Studio → Users."
        footer={
          <span>
            Have an account?{" "}
            <Link
              href="/studio/login"
              className="font-medium text-sapphire-ink hover:opacity-80"
            >
              Sign in
            </Link>
          </span>
        }
      >
        <AuthBanner tone="info">
          Public sign-up isn&rsquo;t available — Rivya Living Art orders happen over
          WhatsApp, and the studio is staff-only.
        </AuthBanner>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Set up your studio"
      subtitle="Create the first administrator account. You can invite more staff later from inside the studio."
      footer={
        <span>
          Already set up?{" "}
          <Link
            href="/studio/login"
            className="font-medium text-sapphire-ink hover:opacity-80"
          >
            Sign in
          </Link>
        </span>
      }
    >
      <div className="space-y-4">
        {params.error && <AuthBanner tone="error">{params.error}</AuthBanner>}

        <form action={signUpFirstAdmin} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-foreground">
              Your name
            </Label>
            <Input
              id="name"
              name="name"
              type="text"
              required
              autoComplete="name"
              placeholder="Bhavya Gondaliya"
            />
          </div>
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

          <PasswordField
            id="password"
            name="password"
            label="Password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />
          <PasswordField
            id="confirm"
            name="confirm"
            label="Confirm password"
            autoComplete="new-password"
          />

          <SubmitButton>Create studio account</SubmitButton>
        </form>
      </div>
    </AuthShell>
  );
}
