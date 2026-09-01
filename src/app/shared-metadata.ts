import type { Metadata } from "next";
import { SITE } from "@/lib/constants";

/**
 * Site-wide metadata defaults, shared by BOTH root layouts ([locale] public
 * and /studio) since the app split into per-tree root layouts so `<html
 * lang/dir>` can be server-rendered per locale (I18N-901 structural fix).
 * metadataBase makes every relative canonical/hreflang/OG URL absolute.
 */
export const SHARED_METADATA: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — Handcrafted Resin Art & Commissions`,
    template: `%s · ${SITE.name}`,
  },
  description:
    "Bespoke resin art, large-format commissions, nameplates and heirloom pieces — handcrafted to order in India. Every piece an heirloom you'll keep forever.",
  // OG/Twitter defaults inherit to every route via the Metadata API, so shares
  // of the home/shop/about pages carry a proper title, type and card (SEO-006).
  // The image must be EXPLICIT here: a config-level `openGraph` replaces the
  // previously resolved openGraph wholesale, so the root file-based
  // opengraph-image is silently dropped for every segment below this one
  // (Part 0 audit A3-001 — verified against the live render). No `url`: og:url
  // defaulting to the homepage misattributes every non-root share; scrapers
  // fall back to the fetched URL when it's absent (A3-002). og:locale is set
  // per request in the [locale] layout (A3-003).
  openGraph: {
    type: "website",
    siteName: SITE.name,
    images: ["/opengraph-image"],
  },
  twitter: { card: "summary_large_image" },
};

/** Open Graph locale codes per supported locale (A3-003). */
export const OG_LOCALES: Record<string, string> = {
  en: "en_IN",
  hi: "hi_IN",
  gu: "gu_IN",
  ar: "ar_AR",
  es: "es_ES",
  de: "de_DE",
  fr: "fr_FR",
  zh: "zh_CN",
  ja: "ja_JP",
};

/**
 * Base openGraph fields for DETAIL pages (product/blog/portfolio), which
 * define their own page-level `openGraph` and therefore REPLACE the layout's
 * resolved value wholesale — losing siteName/locale/type unless re-spread
 * (re-audit R-010; the same mechanism as A3-001). Spread FIRST, then page
 * specifics.
 */
export function detailOpenGraph(locale: string) {
  return {
    type: "website" as const,
    siteName: SITE.name,
    locale: OG_LOCALES[locale] ?? "en_IN",
  };
}
