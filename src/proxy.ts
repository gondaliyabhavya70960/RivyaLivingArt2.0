import createMiddleware from "next-intl/middleware";
import NextAuth from "next-auth";
import {
  NextRequest,
  NextResponse,
  type NextFetchEvent,
  type NextProxy,
} from "next/server";
import { authConfig } from "@/lib/auth.config";
import { routing } from "@/i18n/routing";

/**
 * Protects every /studio route except the public auth pages. Uses the
 * edge-safe auth config (JWT verification only — no database, no pg).
 */
const { auth } = NextAuth(authConfig);

// Reachable while signed out (login, first-run signup, password recovery).
const PUBLIC_AUTH_PATHS = new Set([
  "/studio/login",
  "/studio/signup",
  "/studio/forgot-password",
  "/studio/reset-password",
]);
// Of those, bounce already-signed-in users away from these two.
const BOUNCE_WHEN_SIGNED_IN = new Set(["/studio/login", "/studio/signup"]);

/**
 * Studio auth guard — the original auth-only middleware, unchanged in behavior.
 * `auth()` returns a union type; narrow it to a plain `NextMiddleware` so it can
 * be invoked directly from the composed default export below.
 */
const studioAuth = auth((req) => {
  const { pathname } = req.nextUrl;

  // Fail CLOSED: gate on a real user, not on `req.auth` being truthy. When
  // Auth.js errors inside middleware (verified live: UntrustedHost without
  // AUTH_TRUST_HOST), `req.auth` can be a truthy non-session — treating that
  // as "signed in" both waved anonymous requests past this layer AND bounced
  // the login page to /studio, locking the admin out in a redirect loop
  // (M-A6). A session without a user gets the anonymous path everywhere.
  const signedIn = Boolean(req.auth?.user);

  if (PUBLIC_AUTH_PATHS.has(pathname)) {
    if (signedIn && BOUNCE_WHEN_SIGNED_IN.has(pathname)) {
      return NextResponse.redirect(new URL("/studio", req.nextUrl));
    }
    return NextResponse.next();
  }

  if (!signedIn) {
    const login = new URL("/studio/login", req.nextUrl);
    login.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}) as unknown as NextProxy;

/** next-intl locale detection/routing for every public (non-studio) path. */
const intlMiddleware = createMiddleware(routing);

/**
 * Serve English first; remember only a choice the visitor actually made.
 *
 * The audit (§2.6) was handed the entire site in Chinese on a first visit,
 * because `Accept-Language` alone decided the language and did it with a hard
 * 307 — no consent step, no way back except the footer switcher, which is
 * itself written in the language the visitor could not read. Reproduced
 * locally before this change: `GET /` with `Accept-Language: zh-CN` answered
 * `307 → /zh`.
 *
 * The flag that looks like the fix is not one. `routing.localeDetection`
 * gates BOTH the cookie and the header in next-intl's `resolveLocale` (Prio 2
 * and Prio 3 of four), so turning it off would take the remembered choice
 * down with the unwanted negotiation — and the audit asks for English first
 * *and* cookie memory. Verified in
 * `node_modules/next-intl/dist/esm/middleware/resolveLocale.js`, not assumed.
 *
 * So the header is withheld from the negotiation instead, and everything else
 * about next-intl's routing is left exactly as it was:
 *
 *   Prio 1  path prefix    `/hi/shop` still resolves Hindi      — unchanged
 *   Prio 2  NEXT_LOCALE    the switcher's choice still wins     — unchanged
 *   Prio 3  Accept-Language  no header ⇒ falls through          — THIS CHANGE
 *   Prio 4  defaultLocale  English                              — unchanged
 *
 * With no header, `Negotiator` yields no languages and the matcher returns
 * `defaultLocale`, which under `localePrefix: "as-needed"` needs no redirect —
 * the same 200 that `GET /` with no `Accept-Language` already produced.
 *
 * A visitor who wants another language still gets one in a single click, and
 * that click is what the cookie records.
 */
function withoutLanguageNegotiation(req: NextRequest): NextRequest {
  if (!req.headers.has("accept-language")) return req;
  const headers = new Headers(req.headers);
  headers.delete("accept-language");
  return new NextRequest(req, { headers });
}

/**
 * Composed middleware: /studio/** keeps the exact NextAuth guard; everything
 * else runs next-intl's locale routing. The matcher already excludes api/
 * static assets, so this only ever sees studio + localizable public paths.
 */
export default function proxy(req: NextRequest, event: NextFetchEvent) {
  if (req.nextUrl.pathname.startsWith("/studio")) {
    return studioAuth(req, event);
  }
  return intlMiddleware(withoutLanguageNegotiation(req));
}

export const config = {
  // First pattern: locale-route public paths, EXCLUDING api, Next internals,
  // studio, root metadata routes (opengraph/twitter images, icons, sitemap,
  // robots, manifest — these must reach their own handlers untouched, esp. the
  // OG cards the WhatsApp share funnel depends on), and any path with a file
  // extension. Second pattern: studio auth.
  matcher: [
    "/((?!api|_next|_vercel|studio|design-lab|opengraph-image|twitter-image|icon|apple-icon|sitemap|robots|manifest|.*\\..*).*)",
    "/studio/:path*",
  ],
};
