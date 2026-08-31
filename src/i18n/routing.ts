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
  // Real translations landed for all 9 locales (I2a/I2b-1…6 + I3 catalog
  // localization), so Accept-Language negotiation is on: a first-time
  // non-English browser is redirected to its language root and the choice is
  // remembered in the NEXT_LOCALE cookie (the switcher always overrides).
  localeDetection: true,
});
