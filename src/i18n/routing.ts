import { defineRouting } from "next-intl/routing";

import { defaultLocale, locales } from "./config";

/**
 * next-intl routing. `as-needed` keeps the default locale (English) on the
 * existing unprefixed URLs — so nothing customers already have bookmarked
 * changes — while every other locale gets a path prefix (`/hi/shop`, …).
 */
export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "as-needed",
  // Per-page hreflang now ships completely from generateMetadata + the
  // localized sitemap; next-intl's default Link response header is a third,
  // query-string-dropping channel that disagreed with the meta on paginated
  // URLs (/blog?page=N) and annotated noindex routes — off (SEO-510).
  alternateLinks: false,
  // Stays ON because it is what keeps the NEXT_LOCALE cookie alive: in
  // next-intl's `resolveLocale` this one flag gates the cookie (Prio 2) and
  // the `Accept-Language` header (Prio 3) together, and only the header is
  // unwanted. `src/proxy.ts` withholds that header instead, so a first visit
  // is English (audit §2.6 — an English auditor was served the whole site in
  // Chinese) while a language the visitor actually picked is still
  // remembered. Turning this to `false` would silently undo the memory too.
  localeDetection: true,
  // next-intl's default `NEXT_LOCALE` cookie carries no `maxAge`, which makes
  // it a SESSION cookie — the "memory" audit §2.6 asks for would have died the
  // moment the visitor closed the browser, and they would have been handed
  // English again on the next visit having already told us otherwise. A year,
  // which is what the choice is worth: it is a language, not a preference that
  // goes stale.
  localeCookie: { name: "NEXT_LOCALE", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 },
});
