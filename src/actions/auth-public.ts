"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { hash } from "bcryptjs";
import { z } from "zod";

import { db } from "@/lib/db";
import { signIn } from "@/lib/auth";
import { Role } from "@/generated/prisma/enums";
import { logActivity } from "@/lib/activity";
import { sendPasswordResetEmail } from "@/lib/email";
import { clientIp, rateLimitDurable } from "@/lib/rate-limit";
import {
  generateResetToken,
  hashToken,
  RESET_TOKEN_TTL_MS,
} from "@/lib/tokens";
import { SITE } from "@/lib/constants";

/**
 * Pre-authentication server actions for the studio. Unlike src/actions/users.ts
 * (which is ADMIN-guarded staff management), these run for signed-out visitors,
 * so each one is deliberately narrow:
 *
 *  • signUpFirstAdmin — creates the FIRST admin, and ONLY while the studio has
 *    zero users. This is a one-time owner bootstrap, NOT public/customer signup
 *    (Rivya Living Art has no customer accounts by design). Once any account exists it
 *    is permanently closed and further staff are invited from Studio → Users.
 *  • requestPasswordReset / resetPassword — self-service reset with a hashed,
 *    single-use, one-hour token. Responses never reveal whether an email exists.
 */

const BCRYPT_ROUNDS = 12;

// ————————————————————— First-run admin bootstrap —————————————————————

const signupSchema = z
  .object({
    name: z.string().trim().min(1, "Enter your name").max(120),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Enter a valid email")
      .max(320),
    password: z.string().min(8, "Use at least 8 characters").max(200),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "Passwords do not match",
  });

/**
 * §2.10 · the first-run bootstrap's SECOND gate, and the window it closes.
 *
 * The existing gate — "closed the moment the studio has any account" — is the
 * strong one and stays first. But it leaves a real window open: between a
 * fresh deployment and the owner's own first sign-up, the user table is empty,
 * and anyone who finds `/studio/signup` becomes the ADMIN. That window is
 * usually minutes and has been hours; it is not theoretical, because the route
 * is guessable from the product name alone.
 *
 * `STUDIO_SIGNUP_EMAILS` (comma-separated) closes it: when set, only those
 * addresses may bootstrap. When UNSET the behaviour is byte-for-byte what it
 * was, which is deliberate — this ships to a production environment that has
 * already bootstrapped, and a gate that defaults to closed would be a change
 * nobody asked for on every other environment (previews, a contributor's
 * local database) where the first sign-up is the normal path.
 *
 * The refusal is the SAME `?closed=1` the already-bootstrapped case uses, on
 * purpose: telling an unlisted address "you are not on the allowlist" confirms
 * that an allowlist exists and that their guess was otherwise well-formed.
 */
function signupAllowlist(): string[] {
  return (process.env.STUDIO_SIGNUP_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function signUpFirstAdmin(formData: FormData) {
  // Closed the moment the studio has any account.
  if ((await db.user.count()) > 0) {
    redirect("/studio/signup?closed=1");
  }

  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Check your details and try again.";
    redirect(`/studio/signup?error=${encodeURIComponent(message)}`);
  }

  const { name, email, password } = parsed.data;

  // Checked AFTER the schema so the address is already trimmed and
  // lower-cased — comparing raw form input against a configured list is how an
  // allowlist ends up rejecting the owner for typing a capital letter.
  const allowlist = signupAllowlist();
  if (allowlist.length > 0 && !allowlist.includes(email)) {
    redirect("/studio/signup?closed=1");
  }

  const hashedPassword = await hash(password, BCRYPT_ROUNDS);

  try {
    // Re-check the zero-users invariant inside a SERIALIZABLE transaction so
    // two concurrent bootstrap submissions with different emails can't both
    // see an empty table and both plant an ADMIN (ENG-808). Under the default
    // READ COMMITTED they would not conflict (different emails ≠ unique clash);
    // Serializable makes the loser fail with a serialization error (P2034),
    // which we treat as "someone else just bootstrapped" → studio closed.
    await db.$transaction(
      async (tx) => {
        if ((await tx.user.count()) > 0) throw new Error("STUDIO_CLOSED");
        await tx.user.create({
          data: { name, email, hashedPassword, role: Role.ADMIN },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? (error as { code?: unknown }).code
        : undefined;
    if (
      (error instanceof Error && error.message === "STUDIO_CLOSED") ||
      code === "P2034" // serialization failure: another signup won the race
    ) {
      redirect("/studio/signup?closed=1");
    }
    redirect(
      `/studio/signup?error=${encodeURIComponent(
        "Could not create the account. Please try again.",
      )}`,
    );
  }
  await logActivity({
    action: "signup-first-admin",
    entity: "User",
    meta: { email },
  });

  // Sign the new owner straight in. On success signIn throws a redirect that
  // must propagate; only genuine auth failures are swallowed.
  try {
    await signIn("credentials", { email, password, redirectTo: "/studio" });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/studio/login?welcome=1");
    }
    throw error;
  }
}

// ————————————————————— Forgot password —————————————————————

const emailSchema = z.string().trim().toLowerCase().email();

export async function requestPasswordReset(formData: FormData) {
  const parsed = emailSchema.safeParse(formData.get("email"));

  // Per-IP throttle so the endpoint can't be used for reset-email bombing /
  // Resend-quota abuse (SEC-007). Always redirects to the same confirmation —
  // whether the email exists, is rate-limited, or has a live token — so it
  // never enumerates staff accounts or reveals throttle state.
  const ip = clientIp(await headers());
  const limited = await rateLimitDurable(`pwreset:${ip}`, {
    limit: 5,
    windowMs: 900_000,
  });

  if (limited.ok && parsed.success) {
    const user = await db.user.findUnique({ where: { email: parsed.data } });
    // Cooldown: don't churn the token/email if an unexpired one already exists.
    const hasLiveToken =
      user?.resetTokenHash &&
      user.resetTokenExpiry &&
      user.resetTokenExpiry > new Date();
    if (user && !hasLiveToken) {
      const { token, hash: tokenHash } = generateResetToken();
      await db.user.update({
        where: { id: user.id },
        data: {
          resetTokenHash: tokenHash,
          resetTokenExpiry: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      });
      const resetUrl = `${SITE.url}/studio/reset-password?token=${token}`;
      // Send the email + log AFTER the response so the visible latency doesn't
      // depend on whether the account exists: the awaited Resend round-trip was
      // an account-enumeration timing oracle, contradicting this endpoint's
      // "never enumerates" guarantee (mirrors the login timing equalisation,
      // SEC-110). The token row is already persisted above, and
      // sendPasswordResetEmail never throws.
      after(async () => {
        await sendPasswordResetEmail({
          to: user.email,
          name: user.name,
          resetUrl,
        });
        await logActivity({
          userId: user.id,
          action: "request-password-reset",
          entity: "User",
          entityId: user.id,
          meta: { email: user.email },
        });
      });
    }
  }

  redirect("/studio/forgot-password?sent=1");
}

// ————————————————————— Reset password —————————————————————

const resetSchema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(8, "Use at least 8 characters").max(200),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "Passwords do not match",
  });

export async function resetPassword(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const back = (message: string) =>
    `/studio/reset-password?token=${encodeURIComponent(
      token,
    )}&error=${encodeURIComponent(message)}`;

  // Same durable per-IP throttle the request step carries: without it this
  // pre-auth action accepted unlimited token-guess submissions (Part 0
  // audit A5-006).
  const ip = clientIp(await headers());
  const limited = await rateLimitDurable(`pwreset-submit:${ip}`, {
    limit: 10,
    windowMs: 600_000,
  });
  if (!limited.ok) {
    redirect(back("Too many attempts — please wait a few minutes."));
  }

  const parsed = resetSchema.safeParse({
    token,
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    redirect(
      back(
        parsed.error.issues[0]?.message ?? "Check your details and try again.",
      ),
    );
  }

  const user = await db.user.findFirst({
    where: {
      resetTokenHash: hashToken(parsed.data.token),
      resetTokenExpiry: { gt: new Date() },
    },
  });
  if (!user) {
    redirect(
      back("This reset link is invalid or has expired. Request a new one."),
    );
  }

  const hashedPassword = await hash(parsed.data.password, BCRYPT_ROUNDS);
  await db.user.update({
    where: { id: user.id },
    // Bump tokenVersion so any session that predates the reset is invalidated
    // — a self-service reset should log old (possibly stolen) sessions out (SEC-106).
    data: {
      hashedPassword,
      resetTokenHash: null,
      resetTokenExpiry: null,
      tokenVersion: { increment: 1 },
    },
  });
  await logActivity({
    userId: user.id,
    action: "reset-password-self",
    entity: "User",
    entityId: user.id,
    meta: { email: user.email },
  });

  redirect("/studio/login?reset=1");
}
