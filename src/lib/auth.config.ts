import type { NextAuthConfig } from "next-auth";
import { normalizeSiteUrl } from "@/lib/site-url";
import type { Role } from "@/generated/prisma/enums";

/**
 * The env vars Auth.js turns into a URL before it does anything else.
 *
 * Auth.js reads `AUTH_URL ?? NEXTAUTH_URL` and calls `new URL()` on the RAW
 * value in two places on the request path — `reqWithEnvURL()`
 * (next-auth/lib/env.js, the middleware wrapper) and `createActionURL()`
 * (@auth/core/lib/utils/env.js) — neither of which catches. A hosting
 * dashboard lists a project's domain as a bare host, `rivyalivingart.com`,
 * and that is what gets pasted in; `new URL()` needs a scheme, so every one
 * of those calls throws `TypeError: Invalid URL`.
 *
 * Verified in production, not theorised: this file is imported by
 * `src/proxy.ts`, so the throw landed inside the middleware, and because the
 * middleware is what guards `/studio/:path*`, EVERY studio route answered 500
 * for two days while the public site stayed up (the intl branch never
 * constructs an auth URL). What Vercel reported was `Error running the
 * exported Web Handler: TypeError: Invalid URL … input: 'rivyalivingart.com'`
 * on route `/middleware` — a message that names a Web Handler, not the one
 * variable an operator can act on.
 *
 * The env-var half of Auth.js's own fallback is what makes repairing right
 * rather than merely convenient: an ABSENT `AUTH_URL` is a supported
 * configuration (the origin is then read from `x-forwarded-host`, which is
 * correct on Vercel), so no value an operator can type should be fatal.
 *
 * `AUTH_REDIRECT_PROXY_URL` is deliberately NOT repaired here: it only
 * matters to OAuth providers, and this app authenticates with credentials
 * only (HARD RULE — staff login, no third-party identity).
 */
const AUTH_URL_VARS = ["AUTH_URL", "NEXTAUTH_URL"] as const;

export type AuthUrlRepair = {
  key: (typeof AUTH_URL_VARS)[number];
  from: string;
  /** The usable origin, or `undefined` when the value is beyond repair. */
  to: string | undefined;
};

/** Whether Auth.js can hand this value to `new URL()` and get an origin. */
function isUsableAuthUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * What each auth URL variable SHOULD be — listing ONLY the ones Auth.js
 * cannot use as they stand. Pure: it reports, it does not write.
 *
 * A value that already parses is returned to the caller untouched and
 * unmentioned, trailing slash and all. The test for "needs repair" is
 * therefore the same test Auth.js applies (`new URL()`), not a stricter
 * house style — a warning about a variable that works is noise an operator
 * learns to scroll past, and this one has to be read the day it appears.
 *
 * The repair itself is `normalizeSiteUrl`'s, deliberately: one notion of
 * "the origin an operator meant" shared with `NEXT_PUBLIC_SITE_URL`, so a
 * value that is fine for one cannot be fatal to the other. A value beyond
 * repair reports `to: undefined` — unset, which is CORRECT rather than
 * merely safe, per the fallback described above.
 */
export function repairedAuthUrls(
  source: Record<string, string | undefined>,
): AuthUrlRepair[] {
  const repairs: AuthUrlRepair[] = [];
  for (const key of AUTH_URL_VARS) {
    const from = source[key];
    if (!from) continue; // absent or blank — header detection already applies
    if (isUsableAuthUrl(from)) continue;
    repairs.push({ key, from, to: normalizeSiteUrl(from) });
  }
  return repairs;
}

/**
 * Applies {@link repairedAuthUrls} to an environment object, in place.
 *
 * Unrepairable values are DELETED rather than blanked: Auth.js reads them
 * with `??`, which admits `""` and would throw on the empty string exactly as
 * it threw on the bare host.
 */
export function applyAuthUrlRepairs(
  source: Record<string, string | undefined>,
): AuthUrlRepair[] {
  const repairs = repairedAuthUrls(source);
  for (const { key, to } of repairs) {
    if (to === undefined) {
      try {
        delete source[key];
      } catch {
        // A frozen env object is not worth crashing over; the warning below
        // still names the variable and the fix.
      }
    } else {
      source[key] = to;
    }
  }
  return repairs;
}

// Runs at module load — before `NextAuth(authConfig)` is constructed in either
// `src/proxy.ts` (edge) or `src/lib/auth.ts` (node), and long before the first
// request reaches `createActionURL()`. Auth.js is handed `process.env` as an
// OBJECT and reads the key off it at request time, so repairing the object is
// enough in both runtimes.
for (const { key, from, to } of applyAuthUrlRepairs(process.env)) {
  console.warn(
    to
      ? `${key} is not a full origin (${from}) — reading it as ${to}. ` +
          `Set it to an absolute URL, e.g. https://www.rivyalivingart.com.`
      : `${key} is not a usable origin (${from}) — ignoring it and deriving ` +
          `the origin from the request host instead. Set it to an absolute ` +
          `URL, e.g. https://www.rivyalivingart.com, or remove it.`,
  );
}

/**
 * Edge-safe half of the Auth.js config — NO database imports, so the
 * middleware bundle stays free of Node-only modules (pg). auth.ts spreads
 * this and adds the Credentials provider (which needs Prisma).
 */
export const authConfig = {
  // Cap the JWT lifetime so a stale token can't outlive a revocation by long
  // (SEC-106); requireStaff() re-validates tokenVersion against the DB for
  // immediate effect, this is the belt-and-braces upper bound.
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 },
  pages: {
    signIn: "/studio/login",
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.tokenVersion = user.tokenVersion ?? 0;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.tokenVersion = (token.tokenVersion as number) ?? 0;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
