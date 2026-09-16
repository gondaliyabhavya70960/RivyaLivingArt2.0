import "server-only";

import { db } from "@/lib/db";
import {
  buildProductWhere,
  CARD_SELECT,
  toShopProductItem,
  type ShopProductItem,
} from "@/lib/shop";
import { demoWhere } from "@/lib/demo-content";

/**
 * The categories a piece has to sit in to count as large-format work.
 *
 * Classification is CATEGORY MEMBERSHIP and nothing else. `Product.sizeTier`
 * now exists (docs/plan/07 step 2) and this where DELIBERATELY still
 * classifies by category: the catalogue is untiered until step 3's backlog
 * is worked, so a `sizeTier: LARGE_FORMAT` clause would empty this band into
 * its invitation state on the live site. Widening it to
 * `OR: [category, sizeTier]` is a query-semantics change that needs its own
 * step; this one only changes what a piece RENDERS as (the collectible card,
 * passed by context on the page because this grid is tier-homogeneous by
 * construction).
 *
 * These are owner-seeded rows (`prisma/seed.ts`), not `CANONICAL_CATEGORIES`
 * — that array is only the importer's fallback shelves. Category slugs are a
 * plain unique String, not a closed union, so this tuple is declared as a
 * plain list and the query survives a category the owner has renamed or
 * removed. The list itself lives in the pure `catalog-size-tier.ts`, which
 * files the backlog by the same three slugs — one set, two readers.
 */
export { LARGE_FORMAT_CATEGORY_SLUGS } from "@/lib/catalog-size-tier";
import { LARGE_FORMAT_CATEGORY_SLUGS } from "@/lib/catalog-size-tier";

/**
 * Published pieces in the large-format categories, best-first, as card rows.
 *
 * `featured` ORDERS, it never gates: it is a site-wide flag that also promotes
 * a row into the homepage's featured band and the default shop sort, so
 * treating it as "is a statement piece" would couple two unrelated decisions.
 *
 * The row is the shop's own `CARD_SELECT` + `toShopProductItem` (E step 7):
 * the page used to hand-roll a tile over a select of its own, which was a
 * second copy of the card-row shape. `materials` and `dimensions` are
 * deliberately NOT in `TRANSLATABLE_FIELDS.product`, so they render as the
 * owner typed them in all nine locales, beside a translated label rather
 * than inside a translated sentence, and are never parsed, sorted or
 * compared — this page makes no claim about how large "large" is.
 */
export async function fetchLargeFormatPieces(
  locale: string,
  take = 6,
): Promise<ShopProductItem[]> {
  const rows = await db.product.findMany({
    where: {
      // buildProductWhere({}) is exactly { status: PUBLISHED, demo gate } with
      // no `category` and no `AND` key, so this sibling cannot collide with it.
      ...buildProductWhere({}, await demoWhere()),
      category: { slug: { in: [...LARGE_FORMAT_CATEGORY_SLUGS] } },
    },
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    take,
    select: CARD_SELECT,
  });

  return rows.map((row) => toShopProductItem(row, locale));
}
