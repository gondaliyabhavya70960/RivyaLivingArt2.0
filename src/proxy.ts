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

/* ————————————————————————————————————————————————————————————————
   §2.10 · REAL HTTP STATUS CODES FOR THE SYSTEM PAGES

   "Real HTTP status codes, never a soft 200 — verify with `curl -I`."

   A page cannot set its own status: the App Router exposes `notFound()` (404),
   `forbidden()` (403) and `unauthorized()` (401), and nothing else. Middleware
   can — `NextResponse.rewrite(url, { status })` — so the three statuses that
   have no interrupt of their own are applied here, at the only layer that can
   apply them.

   `rewrite`, not `redirect`: the URL the visitor asked for stays in the bar
   and the status describes THAT url. A redirect would answer 307 about a page
   that is fine and then 410 about a different one.

   Each rewrite goes through `internalPath` below rather than at `req.nextUrl`
   directly — see that function for the failure it fixes, which was measured
   and not obvious.
   ———————————————————————————————————————————————————————————————— */

/** Locale-agnostic path match: `/gone`, `/hi/gone`, `/ar/gone` … */
function routeIs(pathname: string, route: string): boolean {
  if (pathname === route) return true;
  return routing.locales.some((l) => pathname === `/${l}${route}`);
}

/** The locale a path carries in its prefix, or null for an unprefixed one. */
function localeOf(pathname: string): string | null {
  return (
    routing.locales.find(
      (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`),
    ) ?? null
  );
}

/**
 * The INTERNAL path for a public one, which is not always the same string.
 *
 * `localePrefix: "as-needed"` means the default locale carries no prefix in
 * the URL — `/gone`, not `/en/gone` — while the App Router segment is
 * `[locale]`, so the route that actually exists is `/en/gone`. Normally
 * next-intl's own middleware bridges that gap, but the status rewrites below
 * short-circuit BEFORE it runs, so they have to bridge it themselves.
 *
 * Found by measurement, not by reading: `/hi/gone` answered a correct 410
 * while `/gone` answered 500 and `/too-many-requests` answered 404 WITH the
 * `Retry-After` header attached — the middleware had clearly run and rewritten
 * to a path that does not exist. A rewrite to a missing route does not fail
 * loudly; it just resolves to the 404, carrying whatever headers were set on
 * the way, which is exactly the shape of bug that ships looking fine.
 */
function internalPath(pathname: string): string {
  return localeOf(pathname)
    ? pathname
    : `/${routing.defaultLocale}${pathname === "/" ? "" : pathname}`;
}

/**
 * Maintenance — owner decision 7: an env flag read at the edge, NOT a database
 * column. The thing most likely to be under maintenance is the database, and a
 * switch stored in the thing that is down cannot be turned off again.
 *
 * Read per request rather than hoisted to module scope: on Vercel a changed
 * environment variable takes effect on the next invocation, and a module-scope
 * read would hold the old value for the life of a warm instance — so turning
 * maintenance OFF would appear not to work, intermittently, which is the worst
 * possible behaviour for this particular switch.
 */
function maintenanceOn(): boolean {
  const v = process.env.MAINTENANCE_MODE;
  return v === "1" || v === "true";
}

/**
 * How long to tell a client to wait. `Retry-After` is not decoration: it is
 * what stops a crawler treating a 503 as permanent and dropping the page from
 * the index, and what tells a monitor to back off instead of retrying in a
 * tight loop. Ten minutes is a guess, and an honest one — nothing here knows
 * how long the owner will be.
 */
const MAINTENANCE_RETRY_SECONDS = 600;

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
  const { pathname } = req.nextUrl;

  // The Studio is exempt from maintenance and is checked first, because the
  // owner has to be able to sign in and fix whatever they took the site down
  // for. (`/api` never reaches this function at all — the matcher below
  // excludes it — so it is exempt by construction rather than by a branch.)
  if (pathname.startsWith("/studio")) {
    return studioAuth(req, event);
  }

  // ————— maintenance: a real 503 with Retry-After —————
  //
  // EVERY public path, the maintenance page included. An earlier cut exempted
  // `/maintenance` itself to avoid a loop, and measured it answering 200 while
  // every other URL answered 503 — a page that says "we are closed" served
  // with a status that says "everything is fine". There is no loop to avoid:
  // `NextResponse.rewrite` is terminal for the request, so a rewrite of
  // `/hi/maintenance` to itself does not re-enter this function.
  if (maintenanceOn()) {
    const url = req.nextUrl.clone();
    // Keep the visitor's own locale rather than resetting them to English:
    // a maintenance notice is exactly the moment not to also change someone's
    // language. `as-needed` prefixing means the default locale has no prefix,
    // so an unprefixed path maps to an unprefixed destination.
    const locale = localeOf(pathname) ?? routing.defaultLocale;
    url.pathname = `/${locale}/maintenance`;
    url.search = "";
    return NextResponse.rewrite(url, {
      status: 503,
      headers: { "Retry-After": String(MAINTENANCE_RETRY_SECONDS) },
    });
  }

  // ————— the two statuses whose pages exist but whose codes cannot —————
  // Rewriting a route to ITSELF is the whole trick: the page renders exactly
  // as it would have, and the only thing that changes is the status line.
  if (routeIs(pathname, "/gone")) {
    const url = req.nextUrl.clone();
    url.pathname = internalPath(pathname);
    return NextResponse.rewrite(url, { status: 410 });
  }
  if (routeIs(pathname, "/too-many-requests")) {
    // `Retry-After` mirrors what the page itself counts down from, so a
    // machine reading the header and a person reading the page are told the
    // same thing. The page clamps `?retry=` for the same reason this does.
    const raw = Number.parseInt(
      req.nextUrl.searchParams.get("retry") ?? "",
      10,
    );
    const retry =
      Number.isFinite(raw) && raw > 0 ? Math.min(raw, 3600) : 900;
    const url = req.nextUrl.clone();
    url.pathname = internalPath(pathname);
    return NextResponse.rewrite(url, {
      status: 429,
      headers: { "Retry-After": String(retry) },
    });
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
