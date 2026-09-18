import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { headers } from "next/headers";
import { compare } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { authConfig } from "@/lib/auth.config";
import { clientIp, rateLimitDurable } from "@/lib/rate-limit";
import {
  LOGIN_MAX_PER_EMAIL,
  LOGIN_MAX_PER_IP,
  LOGIN_WINDOW_MS,
} from "@/lib/auth-limits";
import type { Role } from "@/generated/prisma/enums";

// Brute-force throttle for the single-admin login. The three numbers moved to
// `auth-limits.ts` so a page can read the window without pulling NextAuth,
// bcrypt and a database client in with it; they are re-exported here so every
// existing `from "@/lib/auth"` import is untouched. See that file for why the
// 429 page reads the window instead of restating it.
export {
  LOGIN_WINDOW_MS,
  LOGIN_MAX_PER_EMAIL,
  LOGIN_MAX_PER_IP,
} from "@/lib/auth-limits";

/** The two keys a login attempt is counted against, and their limits. */
export function loginLimitKeys(email: string, ip: string) {
  return [
    {
      key: `login:email:${email}`,
      opts: { limit: LOGIN_MAX_PER_EMAIL, windowMs: LOGIN_WINDOW_MS },
    },
    {
      key: `login:ip:${ip}`,
      opts: { limit: LOGIN_MAX_PER_IP, windowMs: LOGIN_WINDOW_MS },
    },
  ];
}

/**
 * How long this email/IP pair is locked out for, in seconds — or null when it
 * is not.
 *
 * PEEKS, never records: asking the question must not spend the caller's own
 * budget. `authorize()` deliberately cannot answer it — it returns a bare
 * `null` for a throttled attempt exactly as it does for a wrong password, so
 * that a lockout does not become an account-existence oracle (SEC-110). The
 * login Server Action calls this AFTER its own attempt has already failed and
 * been recorded, which tells the staffer at the keyboard what the counters
 * already know, and tells an attacker nothing a failed login did not.
 *
 * Returns the LONGER of the two waits: clearing the IP window early would
 * still leave the email locked.
 */
export async function loginLockoutSeconds(
  email: string,
  ip: string,
): Promise<number | null> {
  const results = await Promise.all(
    loginLimitKeys(email, ip).map(({ key, opts }) =>
      rateLimitDurable(key, { ...opts, record: false }),
    ),
  );
  const waits = results.flatMap((r) => (r.ok ? [] : [r.retryAfterSeconds]));
  return waits.length > 0 ? Math.max(...waits) : null;
}

/** Best-effort client IP for login keying; "anon" outside a request scope. */
export async function loginClientIpForRequest(): Promise<string> {
  return loginClientIp();
}

// A valid bcrypt hash of a throwaway string. When no user row exists we still
// run a compare against this so authorize() takes the same ~bcrypt(12) time
// whether or not the email is real, closing the account-enumeration timing
// side-channel (SEC-110). The value never matches any real password.
const DUMMY_HASH =
  "$2b$12$TAX7M5VKCB3Ig6baEhkKzul.JeiHKLCPBGfb1VnTlXCg/u33UH5jC";

async function loginClientIp(): Promise<string> {
  try {
    return clientIp(await headers());
  } catch {
    return "anon"; // outside a request scope — email keying still applies
  }
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      tokenVersion: number;
    } & DefaultSession["user"];
  }
  interface User {
    role?: Role;
    tokenVersion?: number;
  }
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Staff-only authentication (ADMIN / EDITOR) for /studio. JWT sessions.
 * The middleware uses the edge-safe authConfig directly — this full
 * instance (with Prisma) runs only in the Node runtime.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const email = parsed.data.email.toLowerCase();

        // Peek at the failure counters WITHOUT recording — a locked email or
        // IP is refused before we even hit the database.
        const ip = await loginClientIp();
        const [
          { key: emailKey, opts: emailOpts },
          { key: ipKey, opts: ipOpts },
        ] = loginLimitKeys(email, ip);
        if (
          !(await rateLimitDurable(emailKey, { ...emailOpts, record: false })).ok ||
          !(await rateLimitDurable(ipKey, { ...ipOpts, record: false })).ok
        ) {
          return null;
        }

        const user = await db.user.findUnique({ where: { email } });
        // Always run a bcrypt compare — against the real hash if the user
        // exists, else a dummy — so timing does not reveal account existence
        // (SEC-110). The dummy compare can never succeed.
        const valid = await compare(
          parsed.data.password,
          user?.hashedPassword ?? DUMMY_HASH,
        );

        if (!user || !valid) {
          // Record the failed attempt against both keys.
          await rateLimitDurable(emailKey, emailOpts);
          await rateLimitDurable(ipKey, ipOpts);
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          tokenVersion: user.tokenVersion,
        };
      },
    }),
  ],
});
