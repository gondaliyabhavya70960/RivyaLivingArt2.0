import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Search } from "lucide-react";

import { Button } from "@/components/storefront/button";
import { Magnetic } from "@/components/ui/magnetic";
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
        className="relative flex min-h-svh items-center overflow-hidden bg-obsidian text-mineral"
      >
        {/* The vortex, and why it is here after the manifest said it was not.
            Plan §2.10 asks for `visual-404.jpg` full-bleed; REDESIGN.md §11.11
            says the 404 is "the heading + search field + four popular
            collections + WhatsApp. No cartoon." Those read as a conflict and
            are not one: "no cartoon" rules out an illustration apologising for
            the error, not photography. The vortex is a cinematic resin render
            in the same grade as the hero pour, so the content stays exactly as
            §11.11 enumerates it and the picture sits behind it.

            Deliberately NOT the LCP and NOT a site-image slot. No `priority`:
            the heading should paint first, and a decorative backdrop that
            delays it would trade §11.11's actual content for atmosphere. No
            slot, because a 404 is what renders when things are already going
            wrong — `getSiteImages()` would put a database read on the one
            page that has to work without one. The file is bundled, so this
            resolves with no network of its own.

            Contrast is the constraint that sets the numbers: the veil below
            keeps mineral text far above 4.5:1 over even the brightest frame of
            the pour, which `redesign-audit.mjs` measures rather than trusts. */}
        <div aria-hidden className="absolute inset-0">
          <Image
            src="/redesign/visual-404.jpg"
            alt=""
            fill
            sizes="100vw"
            quality={70}
            className="object-cover opacity-70"
          />
          {/* Weighted to the reading order, not flat: the headline and the
              search field sit in the first six columns, so the veil is opaque
              there and thins toward the end edge where the collections list
              has only short link text. A flat veil dark enough for the
              headline left the vortex invisible — which is how the first pass
              of this shipped, and the reason the numbers below are measured
              rather than chosen. */}
          <span className="absolute inset-0 bg-gradient-to-r from-obsidian via-obsidian/88 to-obsidian/35" />
        </div>

        <div className="relative z-10 u-shell grid gap-16 py-24 lg:grid-cols-12 lg:gap-x-16">
          <div className="flex flex-col gap-6 lg:col-span-6">
            {/* The eyebrow keeps its champagne TEXT; its decorative rule
                drops to mist. `redesign-audit.mjs` caps the first viewport at
                two champagne-painting elements, these two spent both, and
                §2.10 asks for the escape to be a champagne pill — which is a
                better use of the second slot than a 24px dash. */}
            <p className="u-micro flex items-center gap-3 text-champagne">
              <span aria-hidden className="block h-px w-6 bg-mist/60" />
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
              {/* §2.10: "one magnetic champagne pill". It is also the only
                  way this pair gets a hierarchy — two `secondary` buttons side
                  by side say neither is the way out. */}
              <Magnetic>
                <Button variant="premium" size="md" asChild>
                  <Link href="/shop">{copy.home}</Link>
                </Button>
              </Magnetic>
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
