import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Search } from "lucide-react";

import { Button } from "@/components/storefront/button";
import { SITE } from "@/lib/constants";
import { buildWaLink, defaultWaGreeting } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Page not found — Rivya Living Art",
  description:
    "The page you followed has moved, or was never poured. Search the studio, or start from one of our collections.",
  // Belt-and-braces beside the ENG-813 status fix: even if some render path
  // ever commits a 200 before notFound() unwinds again, the page never
  // enters the index as a soft-404.
  robots: { index: false },
};

/**
 * The 404 — REDESIGN.md §11.11:
 *
 * > "**This piece isn't here.** + search field + four popular collections +
 * > WhatsApp. **No cartoon.**"
 *
 * So the outlined giant "404" watermark and the cured-pour underlay are gone.
 * They were the cartoon — decoration standing where the way out should be.
 * What replaces them is the four things the spec names, in the order a lost
 * visitor needs them: say what happened, offer the search, offer the four
 * real doorways, offer a human.
 *
 * ## Why the search is a plain form
 *
 * This boundary renders OUTSIDE the `(v2)` route group, so it has no header,
 * no footer and — crucially — no mounted `SearchOverlay`. Calling `openSearch`
 * here would be a button wired to nothing. The field is therefore a real GET
 * form submitting to `/search?q=`, which works with no JavaScript at all and
 * lands on the full results page rather than a transient overlay. On a dead
 * end, the durable destination is the right one.
 *
 * ## Why the collections are hard-coded
 *
 * The boundary must not depend on the database: a 404 raised *because* the
 * database is unreachable would then fail inside its own handler. All four
 * slugs are real category rows and were checked against the live catalogue —
 * they are destinations, not guesses.
 *
 * ## Two exports
 *
 * `NotFoundPanel` is the markup with all copy injected; the default export is
 * the localized page. `app/global-not-found.tsx` renders the panel with
 * {@link EN_NOT_FOUND} because it owns its own `<html>` and has no locale, no
 * routing context and no message provider to read.
 */

/** Real category rows, verified against the catalogue (§11.11). */
const COLLECTIONS = [
  { key: "varmala", href: "/shop/varmala-preservation" },
  { key: "frames", href: "/shop/wedding-photo-frames" },
  { key: "decor", href: "/shop/resin-home-decor" },
  { key: "gifts", href: "/shop/gift-collections" },
] as const;

export type NotFoundCopy = {
  eyebrow: string;
  heading: string;
  body: string;
  searchLabel: string;
  searchPlaceholder: string;
  searchSubmit: string;
  collectionsLabel: string;
  collections: Record<(typeof COLLECTIONS)[number]["key"], string>;
  home: string;
  whatsapp: string;
  openInNewTab: string;
};

/** The English baseline — used verbatim by the locale-less global boundary. */
export const EN_NOT_FOUND: NotFoundCopy = {
  eyebrow: "404",
  heading: "This piece isn't here.",
  body: "The page you followed has moved, or was never poured. Search the studio, or start from one of these.",
  searchLabel: "Search the studio",
  searchPlaceholder: "Pieces, journal, portfolio…",
  searchSubmit: "Search",
  collectionsLabel: "Popular collections",
  collections: {
    varmala: "Varmala preservation",
    frames: "Wedding photo frames",
    decor: "Resin home decor",
    gifts: "Gift collections",
  },
  home: "Back to the collection",
  whatsapp: "Ask on WhatsApp",
  openInNewTab: "(opens in new tab)",
};

export function NotFoundPanel({
  copy = EN_NOT_FOUND,
}: {
  copy?: NotFoundCopy;
}) {
  const waHref = buildWaLink(defaultWaGreeting(), SITE.whatsappNumber);

  return (
    /* The route-group split moved <main id="main-content"> into the group
       layouts, which do not wrap this boundary — provide the skip-link target
       here so the root layout's anchor never dangles. */
    <main id="main-content" className="flex-1">
      <section
        data-theme="navy"
        className="flex min-h-svh items-center bg-obsidian text-mineral"
      >
        <div className="u-shell grid gap-16 py-24 lg:grid-cols-12 lg:gap-x-16">
          <div className="flex flex-col gap-6 lg:col-span-6">
            <p className="u-micro flex items-center gap-3 text-champagne">
              <span aria-hidden className="block h-px w-6 bg-champagne" />
              {copy.eyebrow}
            </p>
            <h1 className="max-w-[12ch] font-display text-h1 leading-h1 tracking-display text-mineral">
              {copy.heading}
            </h1>
            <p className="u-lede font-body text-body leading-relaxed text-mist">
              {copy.body}
            </p>

            {/* A real GET form: no overlay is mounted on this boundary, and a
                dead end deserves a destination that works without JS. */}
            <form
              action="/search"
              method="get"
              role="search"
              className="mt-2 flex flex-col gap-3"
            >
              <label
                htmlFor="not-found-search"
                className="font-body text-16 font-medium text-mineral"
              >
                {copy.searchLabel}
              </label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex flex-1 items-center gap-3 border-b border-hairline-dk focus-within:border-champagne">
                  <Search
                    aria-hidden
                    strokeWidth={1.5}
                    className="size-5 shrink-0 text-mist"
                  />
                  <input
                    id="not-found-search"
                    type="search"
                    name="q"
                    autoComplete="off"
                    placeholder={copy.searchPlaceholder}
                    className="h-14 w-full min-w-0 bg-transparent font-body text-16 text-mineral placeholder:text-mist"
                  />
                </div>
                <Button type="submit" size="md" className="shrink-0">
                  {copy.searchSubmit}
                </Button>
              </div>
            </form>

            <div className="mt-2 flex flex-wrap items-center gap-4">
              {/* Points at /shop, not /. The word was the audit's finding
                  (§2.7 — "Back to the studio" reads as the admin panel,
                  because /studio IS the admin panel), and the destination is
                  the other half of the same fix: a visitor who 404s did so
                  from a piece or a category, and the catalogue is the useful
                  landing. The home page is still one click away in the header.
                  "Search the studio" and "Message the studio" stay as they
                  are — those mean the atelier, which is correct. */}
              <Button variant="secondary" size="md" asChild>
                <Link href="/shop">{copy.home}</Link>
              </Button>
              <Button variant="secondary" size="md" asChild>
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-wa-source="not_found"
                >
                  {copy.whatsapp}
                  <span className="sr-only"> {copy.openInNewTab}</span>
                </a>
              </Button>
            </div>
          </div>

          {/* The four doorways — mono index, hairline-ruled, no photography
              and no icons: a boundary loads nothing it does not need. */}
          <nav
            aria-label={copy.collectionsLabel}
            className="lg:col-span-4 lg:col-start-9"
          >
            <p className="u-micro border-t border-hairline-dk pt-4">
              {copy.collectionsLabel}
            </p>
            <ul className="mt-2 flex flex-col">
              {COLLECTIONS.map((collection) => (
                <li key={collection.key}>
                  <Link
                    href={collection.href}
                    className="group flex min-h-14 items-center justify-between gap-4 border-b border-hairline-dk font-body text-body text-mineral transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:text-champagne motion-reduce:transition-none"
                  >
                    {copy.collections[collection.key]}
                    <ArrowRight
                      aria-hidden
                      strokeWidth={1.5}
                      className="size-4 shrink-0 text-mist transition-colors duration-(--dur-fast) ease-(--ease-settle) group-hover:text-champagne motion-reduce:transition-none rtl:-scale-x-100"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>
    </main>
  );
}

export default async function NotFound() {
  const t = await getTranslations("NotFound");
  const tCommon = await getTranslations("Common");

  return (
    <NotFoundPanel
      copy={{
        eyebrow: t("eyebrow"),
        heading: t("heading"),
        body: t("body"),
        searchLabel: t("searchLabel"),
        searchPlaceholder: t("searchPlaceholder"),
        searchSubmit: t("searchSubmit"),
        collectionsLabel: t("collectionsLabel"),
        collections: {
          varmala: t("collections.varmala"),
          frames: t("collections.frames"),
          decor: t("collections.decor"),
          gifts: t("collections.gifts"),
        },
        home: t("home"),
        whatsapp: t("whatsapp"),
        openInNewTab: tCommon("openInNewTab"),
      }}
    />
  );
}
