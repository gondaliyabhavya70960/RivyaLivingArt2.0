import Link from "next/link";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import {
  loginClientIpForRequest,
  loginLockoutSeconds,
  signIn,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { AuthShell, AuthBanner } from "@/components/studio/auth-shell";
import {
  LockoutCountdown,
  LoginFields,
} from "@/components/studio/login-fields";

export const metadata = { title: "Studio Login" };

async function login(formData: FormData) {
  "use server";
  const callbackUrl = (formData.get("callbackUrl") as string) || "/studio";
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: callbackUrl,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // The attempt has already failed AND been recorded by `authorize()`, so
      // asking the counters here tells the staffer at the keyboard how long
      // they are locked out for without telling an attacker anything a failed
      // login did not. `authorize()` itself stays a bare `null` either way —
      // see `loginLockoutSeconds`.
      const seconds = email
        ? await loginLockoutSeconds(email, await loginClientIpForRequest())
        : null;
      redirect(
        seconds === null
          ? "/studio/login?error=1"
          : `/studio/login?retryAfter=${seconds}`,
      );
    }
    throw error; // NEXT_REDIRECT and friends must propagate
  }
}

/**
 * Studio sign-in — REDESIGN.md §12.1.
 *
 * - **Rate-limited countdown.** Wired. `authorize()` still returns a bare
 *   `null` for a throttled attempt exactly as it does for a wrong password —
 *   that is what stops a lockout becoming an account-existence oracle. The
 *   Server Action asks the counters separately, AFTER its attempt has failed
 *   and been recorded, and redirects to `?retryAfter=<seconds>`, which is
 *   what `LockoutCountdown` renders on.
 * - **Account disabled.** Still has no data behind it, deliberately. There is
 *   no disabled/suspended column on `User` (prisma/schema.prisma) — access is
 *   revoked by deleting the row or bumping `tokenVersion`. Even given one, a
 *   distinct "account disabled" banner would answer the account-enumeration
 *   question the generic message below exists to withhold, so the column is
 *   not the only thing missing here. The banner renders on `?error=disabled`;
 *   nothing sets it.
 *
 * The invalid-credential message is deliberately ONE generic line above the
 * form. Field-level "no account with that email" would hand an attacker the
 * account-enumeration answer that `authorize()`'s dummy-hash compare
 * (SEC-110) exists to withhold.
 */
export default async function StudioLoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    callbackUrl?: string;
    reset?: string;
    welcome?: string;
    retryAfter?: string;
  }>;
}) {
  const params = await searchParams;
  // The first-run link is only meaningful before any account exists.
  const noAccountsYet = (await db.user.count()) === 0;

  const retryAfter = Number(params.retryAfter);
  const lockedFor =
    Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.min(Math.floor(retryAfter), 60 * 60)
      : null;

  return (
    <AuthShell
      title="Sign in to Studio"
      subtitle="Manage the catalogue, portfolio, commissions and journal."
      footer={
        noAccountsYet ? (
          <span>
            First time here?{" "}
            <Link
              href="/studio/signup"
              className="font-medium text-sapphire-ink underline-offset-4 hover:underline"
            >
              Set up your studio account
            </Link>
          </span>
        ) : (
          <span>
            Staff accounts are created by an administrator in Studio → Users.
          </span>
        )
      }
    >
      <div className="space-y-5">
        {lockedFor !== null ? (
          <LockoutCountdown seconds={lockedFor} />
        ) : (
          params.error && (
            <AuthBanner tone="error">
              {params.error === "disabled"
                ? "That account can no longer sign in. Ask an administrator to restore your access."
                : "Wrong email or password. Please try again."}
            </AuthBanner>
          )
        )}
        {params.reset && (
          <AuthBanner tone="success">
            Password updated. Sign in with your new password.
          </AuthBanner>
        )}
        {params.welcome && (
          <AuthBanner tone="success">
            Your account is ready. Please sign in.
          </AuthBanner>
        )}

        <form action={login}>
          <input
            type="hidden"
            name="callbackUrl"
            value={params.callbackUrl ?? "/studio"}
          />
          <LoginFields />
        </form>
      </div>
    </AuthShell>
  );
}
