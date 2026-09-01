import { FOOTER_LINKS, NAV_LINKS, SECONDARY_NAV_LINKS } from "@/lib/constants";

/**
 * The site's navigation menus, as data.
 *
 * Header links, the mobile drawer's second group and the footer's four columns
 * were `as const` arrays in `constants.ts`: their labels were already editable
 * (they resolve through the `Nav.*` catalogue, which the copy layer owns) but
 * their **hrefs, order and existence** were not. Adding a "Workshops" link to
 * the footer meant a deploy.
 *
 * Same contract as the image slots, the copy catalogue and the form options:
 * the bundled arrays below are the seed AND the fallback, so the chrome renders
 * its shipped menus before anyone opens the studio and a database hiccup
 * degrades to them rather than to a site with no navigation.
 *
 * Plain module, no server imports.
 */

export const NAV_MENUS = [
  "header",
  "header-secondary",
  "footer-explore",
  "footer-studio",
  "footer-journal",
  "footer-legal",
] as const;

export type NavMenuKey = (typeof NAV_MENUS)[number];

/** One resolved link, ready to render. */
export type NavLink = {
  /** Stable key — also the `Nav.*` message key and the mega-menu hook. */
  key: string;
  label: string;
  href: string;
  newTab: boolean;
};

export type NavMenuSet = Record<NavMenuKey, NavLink[]>;

/** What the owner is editing, in their words — the studio screen's sections. */
export const NAV_MENU_LABELS: Record<
  NavMenuKey,
  { title: string; where: string }
> = {
  header: {
    title: "Header",
    where: "The four links across the top of every page",
  },
  "header-secondary": {
    title: "Menu drawer · second group",
    where: "Below the divider when the menu opens on a phone",
  },
  "footer-explore": { title: "Footer · Explore", where: "First footer column" },
  "footer-studio": { title: "Footer · Studio", where: "Second footer column" },
  "footer-journal": {
    title: "Footer · Journal",
    where: "Third footer column",
  },
  "footer-legal": {
    title: "Footer · Legal",
    where: "The small print under the footer columns",
  },
};

/**
 * The shipped menus, verbatim from the arrays they replace.
 *
 * Keys must stay byte-identical: each one is a `Nav.*` message key, so a typo
 * here silently swaps a link's label for its own key path. `header`'s "shop"
 * key additionally drives the mega menu.
 */
export const NAV_MENU_DEFAULTS: Record<
  NavMenuKey,
  readonly { key: string; href: string }[]
> = {
  header: NAV_LINKS.map(({ key, href }) => ({ key, href })),
  "header-secondary": SECONDARY_NAV_LINKS.map(({ key, href }) => ({
    key,
    href,
  })),
  "footer-explore": FOOTER_LINKS.explore.map(({ key, href }) => ({
    key,
    href,
  })),
  "footer-studio": FOOTER_LINKS.studio.map(({ key, href }) => ({ key, href })),
  "footer-journal": FOOTER_LINKS.journal.map(({ key, href }) => ({
    key,
    href,
  })),
  "footer-legal": FOOTER_LINKS.legal.map(({ key, href }) => ({ key, href })),
};

export function isNavMenuKey(value: string): value is NavMenuKey {
  return (NAV_MENUS as readonly string[]).includes(value);
}

/* ═══════════════════════ href validation ═══════════════════════ */

/**
 * Storefront routes a link may point at.
 *
 * A nav item pointing at a route that does not exist is a 404 the owner
 * shipped themselves, and it is the single most likely mistake on this screen
 * — so the href is checked at save time rather than discovered by a visitor.
 *
 * Locale prefixes are NOT included: `Link` from `@/i18n/navigation` adds them,
 * so a stored href is always the unprefixed path.
 */
export const KNOWN_ROUTES = [
  "/",
  "/shop",
  "/bespoke",
  "/about",
  "/process",
  "/large-resin-art",
  "/workshops",
  "/projects",
  "/journal",
  "/faq",
  "/contact",
  "/search",
  "/privacy",
  "/terms",
  "/shop/wishlist",
] as const;

/**
 * Why an href is refused, phrased for the person who typed it.
 * Returns null when it is fine.
 *
 * Deliberately permissive in three places, each for a reason the storefront
 * actually relies on:
 *  - `/shop#collections` — a fragment onto a known route; the footer ships one.
 *  - `/journal?category=…`  — a query onto a known route; the footer ships two.
 *  - `/shop/<slug>`, `/product/<slug>`, `/projects/<slug>`, `/journal/<slug>` —
 *    dynamic segments whose validity is a content question, not a routing one.
 */
export function describeHrefProblem(href: string): string | null {
  const trimmed = href.trim();
  if (!trimmed) return "Give the link a destination.";

  if (/^https?:\/\//i.test(trimmed)) return null; // external, owner's call
  if (trimmed.startsWith("mailto:") || trimmed.startsWith("tel:")) return null;

  if (!trimmed.startsWith("/")) {
    return "A link to this site starts with “/” — for example /workshops.";
  }

  // Split off the fragment and query before matching the path.
  const path = trimmed.split(/[?#]/)[0];

  if ((KNOWN_ROUTES as readonly string[]).includes(path)) return null;

  const dynamic = /^\/(shop|product|projects|journal|p)\/[^/]+$/;
  if (dynamic.test(path)) return null;

  return `There is no page at ${path}. Pick one of the site's pages, or paste a full https:// address.`;
}

/** Resolve a stored label blob for one locale; empty means "use the catalogue". */
export function resolveNavLabel(
  label: unknown,
  locale: string,
): string | undefined {
  if (!label || typeof label !== "object" || Array.isArray(label)) {
    return undefined;
  }
  const map = label as Record<string, unknown>;
  const exact = map[locale];
  if (typeof exact === "string" && exact.trim()) return exact.trim();
  const english = map.en;
  if (typeof english === "string" && english.trim()) return english.trim();
  return undefined;
}
