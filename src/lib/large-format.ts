import "server-only";

import { db } from "@/lib/db";
import { localize } from "@/lib/localize";
import { buildProductWhere } from "@/lib/shop";
import { demoWhere } from "@/lib/demo-content";

/**
 * The categories a piece has to sit in to count as large-format work.
 *
 * Classification is CATEGORY MEMBERSHIP and nothing else. `Product` has no
 * "statement piece" column and this page does not add one: the owner already
 * classifies by moving a product into a category, and a second, parallel flag
 * would be a second source of truth for the same fact.
 *
 * These are owner-seeded rows (`prisma/seed.ts`), not `CANONICAL_CATEGORIES`
 * — that array is only the importer's fallback shelves. Category slugs are a
 * plain unique String, not a closed union, so this tuple is declared locally
 * and the query survives a category the owner has renamed or removed.
 */
export const LARGE_FORMAT_CATEGORY_SLUGS = [
  "resin-furniture-surfaces",
  "sculptures-objets",
] as const;

export type LargeFormatPiece = {
  id: string;
  slug: string;
  title: string;
  categoryName: string;
  image: { url: string; alt: string | null } | null;
  /** Owner-typed free text. Rendered as written, never parsed. */
  materials: string | null;
  dimensions: string | null;
};

/**
 * Published pieces in the large-format categories, best-first.
 *
 * `featured` ORDERS, it never gates: it is a site-wide flag that also promotes
 * a row into the homepage's featured band and the default shop sort, so
 * treating it as "is a statement piece" would couple two unrelated decisions.
 *
 * `materials` and `dimensions` are deliberately NOT in
 * `TRANSLATABLE_FIELDS.product`, so they render as the owner typed them in all
 * nine locales. They are shown beside a translated label rather than inside a
 * translated sentence, and are never parsed, sorted or compared — this page
 * makes no claim about how large "large" is.
 */
export async function fetchLargeFormatPieces(
  locale: string,
  take = 6,
): Promise<LargeFormatPiece[]> {
  const rows = await db.product.findMany({
    where: {
      // buildProductWhere({}) is exactly { status: PUBLISHED, demo gate } with
      // no `category` and no `AND` key, so this sibling cannot collide with it.
      ...buildProductWhere({}, await demoWhere()),
      category: { slug: { in: [...LARGE_FORMAT_CATEGORY_SLUGS] } },
    },
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    take,
    select: {
      id: true,
      slug: true,
      title: true,
      materials: true,
      dimensions: true,
      translations: true,
      category: { select: { name: true, translations: true } },
      images: {
        orderBy: { order: "asc" },
        take: 1,
        select: { url: true, alt: true },
      },
    },
  });

  return rows.map((row) => {
    const p = localize(row, locale, ["title"]);
    // The literal ["name"], not TRANSLATABLE_FIELDS.category — that is
    // ["name","description"] and the select above omits description.
    const c = localize(row.category, locale, ["name"]);
    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      categoryName: c.name,
      image: row.images[0] ?? null,
      materials: row.materials?.trim() || null,
      dimensions: row.dimensions?.trim() || null,
    };
  });
}
