import { cache } from "react";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { localize } from "@/lib/localize";
import {
  CATALOG_GROUPS,
  type CatalogGroup,
  type CatalogNav,
} from "@/lib/catalog-taxonomy";

const PER_GROUP = 6;

/**
 * Merchandising order for the mega-menu (audit M-S1): raw published-count
 * ordering buried the flagship crafts under bulk-imported volume (Resin Home
 * Decor at 664 pieces outranked Varmala Preservation at 11 — the craft the
 * home hero anchors on). Slugs listed here lead their group's column in this
 * order whenever they have a single published piece; everything unlisted
 * follows, ordered by published count (the tiebreaker). Supplies/print have
 * no flagship inversion, so their lists stay empty (pure count order).
 */
const MERCH_ORDER: Record<CatalogGroup, readonly string[]> = {
  art: [
    "varmala-preservation",
    "gift-collections",
    "resin-trays-serving-platters",
    "resin-furniture-surfaces",
    "wedding-photo-frames",
    "art-craft-pieces",
  ],
  supplies: [],
  print: [],
};

/**
 * Cache tag for the mega-menu data below. Revalidated by the category
 * mutation actions (src/actions/categories.ts) so studio edits reach the
 * header within a request instead of the 300s TTL. The product mutation
 * actions (src/actions/products.ts) also call
 * `revalidateTag(CATALOG_NAV_TAG, "max")` on product create/update/delete,
 * since publishing/unpublishing products changes the per-category counts.
 */
export const CATALOG_NAV_TAG = "catalog-nav";

const EMPTY_NAV: CatalogNav = { art: [], supplies: [], print: [] };

/**
 * The uncached read, wrapped in `unstable_cache` (M-P4): the layout calls
 * this on every public render site-wide, and the per-category published
 * `_count` over 4,373+ products is identical for every visitor. 300s TTL +
 * tag invalidation from the studio actions. Pure DB read — nothing here may
 * touch per-request APIs (cookies/headers), which `unstable_cache` cannot
 * close over. Errors are handled OUTSIDE the wrapper so a DB hiccup is
 * never cached as an empty nav for 300s.
 */
const readCatalogNav = unstable_cache(
  async (locale: string): Promise<CatalogNav> => {
    const nav: CatalogNav = { art: [], supplies: [], print: [] };
    const categories = await db.category.findMany({
      select: {
        slug: true,
        name: true,
        translations: true,
        _count: {
          select: { products: { where: { status: "PUBLISHED" } } },
        },
      },
    });
    for (const group of ["art", "supplies", "print"] as const) {
      const merch = MERCH_ORDER[group];
      // Curated rank first (M-S1); unlisted slugs share one rank so the
      // published count decides among them.
      const rank = (slug: string) => {
        const i = merch.indexOf(slug);
        return i === -1 ? merch.length : i;
      };
      nav[group] = categories
        .filter((c) =>
          (CATALOG_GROUPS[group].slugs as readonly string[]).includes(c.slug),
        )
        .filter((c) => c._count.products > 0)
        .sort(
          (a, b) =>
            rank(a.slug) - rank(b.slug) ||
            b._count.products - a._count.products,
        )
        .slice(0, PER_GROUP)
        .map((c) => ({
          slug: c.slug,
          name: localize(c, locale, ["name"]).name,
          count: c._count.products,
        }));
    }
    return nav;
  },
  ["catalog-nav"],
  // 24h, not 300: a route's ISR interval is min(segment revalidate, every
  // cached read it renders with) — the layout renders this on ALL routes, so
  // a 300s TTL here silently capped the PDP's revalidate=86400 (M-P6) back
  // to 5m. Freshness comes from the tag (invalidated on every category and
  // product mutation); the TTL is only the safety net.
  { revalidate: 86400, tags: [CATALOG_NAV_TAG] },
);

/**
 * Categories for the header mega-menu, grouped by catalog ecosystem and
 * ordered by published-product count (top 6 per group). Cross-request cached
 * for 300s (see {@link readCatalogNav}), deduped per request via React cache
 * — the layout calls this on every public render.
 */
export const getCatalogNav = cache(
  async (locale: string): Promise<CatalogNav> => {
    try {
      return await readCatalogNav(locale);
    } catch {
      // Header chrome must never crash a render on a DB hiccup — the mega-menu
      // simply collapses to the plain Shop link.
      return EMPTY_NAV;
    }
  },
);
