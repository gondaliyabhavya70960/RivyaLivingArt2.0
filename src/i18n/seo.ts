import type { Metadata } from "next";

import { getPathname } from "./navigation";
import { routing } from "./routing";

/**
 * The href shapes `getPathname` accepts when no `pathnames` map is configured:
 * a plain pathname string (all locales share the same path, only the prefix
 * differs under `localePrefix: "as-needed"`).
 */
type Href = string;

/**
 * Full `alternates` block for a public page: a self-referential canonical for
 * the active locale plus the hreflang `languages` map across every supported
 * locale and an `x-default` pointing at the unprefixed English URL.
 *
 * Every public page's `generateMetadata` should return
 * `alternates: localeAlternates(path, locale)` instead of a bare
 * `{ canonical }` — a page-level `alternates` shallow-overrides the layout's,
 * so a canonical-only object silently drops the hreflang map (every
 * indexable page complies since the I4 sweep — see `[locale]/layout.tsx`).
 *
 * Relative paths resolve against `metadataBase` from the root layout.
 */
export function localeAlternates(
  href: Href,
  locale: string,
): NonNullable<Metadata["alternates"]> {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) {
    languages[l] = getPathname({ href, locale: l });
  }
  languages["x-default"] = getPathname({
    href,
    locale: routing.defaultLocale,
  });

  return {
    canonical: getPathname({ href, locale }),
    languages,
  };
}

/**
 * Canonical-only variant for noindex routes (/search, /whatsapp-order):
 * hreflang annotations on/to permanently non-indexable pages are ignored by
 * Google and surface as Search Console errors, so those pages keep just a
 * localized self-canonical (SEO-511/SEO-512).
 */
export function localeCanonical(
  href: Href,
  locale: string,
): NonNullable<Metadata["alternates"]> {
  return { canonical: getPathname({ href, locale }) };
}

/**
 * Absolute-URL variant for the sitemap: every locale's URL for `href`, keyed
 * by locale, resolved against `base` (no trailing slash). The sitemap emits
 * one entry per locale per route, each carrying this same reciprocal map, so
 * every variant's hreflang cluster is fully described (Google requires the
 * annotations to be reciprocal).
 */
export function localeUrlMap(href: Href, base: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) {
    languages[l] = `${base}${getPathname({ href, locale: l })}`;
  }
  languages["x-default"] = `${base}${getPathname({
    href,
    locale: routing.defaultLocale,
  })}`;
  return languages;
}
