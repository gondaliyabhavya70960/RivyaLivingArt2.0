import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { PLACEHOLDER_ASSET_PREFIX } from "@/lib/placeholder-assets";
import { PRODUCT_SIZE_TIERS } from "@/lib/product-size-tier";

/**
 * The studio product list's filter contract — ONE definition shared by the
 * server page (URL searchParams → where clause), the client list (tab state,
 * "select all matching" payloads) and the bulk server actions (re-validating
 * a client-sent filter before building the SAME where clause server-side).
 * A raw Prisma `where` never crosses the client boundary (audit L-AD1).
 *
 * Plain module on purpose: no "use client" / "use server" directive, so both
 * the RSC page and the actions file can import it (audit C4 pattern).
 */

/** Status tabs. The list DEFAULTS to Published (audit M-A1) — an absent
 *  `status` param means PUBLISHED; "ALL" is the explicit everything tab.
 *  REVIEW and ARCHIVED (10 remnants) join DRAFT/PUBLISHED/ALL — every public
 *  reader still treats anything but PUBLISHED as invisible (B0). */
export const PRODUCT_STATUS_TABS = [
  "PUBLISHED",
  "REVIEW",
  "DRAFT",
  "ARCHIVED",
  "ALL",
] as const;
export type ProductStatusTab = (typeof PRODUCT_STATUS_TABS)[number];

export const productListFilterSchema = z.object({
  q: z.string().trim().min(1).max(200).optional().catch(undefined),
  status: z.enum(PRODUCT_STATUS_TABS).optional().catch(undefined),
  /** Category id (cuid) from the category filter select. */
  category: z.string().trim().min(1).max(64).optional().catch(undefined),
  tier: z.enum(["1", "2", "3", "4"]).optional().catch(undefined),
  /**
   * The owner's product tier, plus "NONE" for the rows that have none.
   *
   * "NONE" IS THE POINT OF THIS FILTER, not an afterthought. The column
   * shipped nullable against a catalogue of ~4,385 existing rows, so the
   * backlog IS the default state; a filter that could only select the three
   * tiers would show the owner everything they have already done and nothing
   * they still have to do.
   */
  sizeTier: z
    .enum(["NONE", ...PRODUCT_SIZE_TIERS])
    .optional()
    .catch(undefined),
  stock: z.enum(["in", "out"]).optional().catch(undefined),
  /**
   * The photography worklist (plan §3 S4) — the two states that stop a row
   * being publishable, as a filter the owner can pin as a saved view.
   *
   * `placeholder` is deliberately "HAS a placeholder image", not "the COVER
   * is one". The cover is the image with the lowest `order` and Prisma has
   * no predicate for the related row that sorts first — the bulk publish
   * guard reads covers in TS for exactly this reason, and a list cannot,
   * because it pages and counts in the database. A superset that never
   * misses a blocked row is the right shape for a worklist; the exact set
   * would need a column, and a column for a path prefix is the thing
   * `placeholder-assets.ts` exists to avoid.
   */
  media: z.enum(["none", "placeholder"]).optional().catch(undefined),
  /** "1" narrows to Content Lab fixtures (`isDemo: true`) — 10 remnants'
   *  demo filter, present on every list that carries `isDemo` rows. */
  demo: z.literal("1").optional().catch(undefined),
});

export type ProductListFilter = z.infer<typeof productListFilterSchema>;

/** Sanitize raw searchParams (or a client payload) into a filter — invalid
 *  or unknown values are dropped, never errored, matching how the list page
 *  has always treated bad URL params. */
export function parseProductListFilter(raw: {
  q?: string;
  status?: string;
  category?: string;
  tier?: string;
  sizeTier?: string;
  stock?: string;
  media?: string;
  demo?: string;
}): ProductListFilter {
  const parsed = productListFilterSchema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}

/** Filter → Prisma where. Absent status means the Published default tab. */
export function buildProductWhere(
  filter: ProductListFilter,
): Prisma.ProductWhereInput {
  const status = filter.status ?? "PUBLISHED";
  return {
    ...(filter.q
      ? {
          OR: [
            { title: { contains: filter.q, mode: "insensitive" } },
            { slug: { contains: filter.q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(status !== "ALL" ? { status } : {}),
    ...(filter.category ? { categoryId: filter.category } : {}),
    ...(filter.tier ? { tier: Number(filter.tier) } : {}),
    // `sizeTier: null` is a REAL clause, so it cannot ride the truthiness
    // pattern the rest of this object uses — "NONE" has to be matched before
    // the generic branch or the untiered backlog is unselectable.
    ...(filter.sizeTier === "NONE"
      ? { sizeTier: null }
      : filter.sizeTier
        ? { sizeTier: filter.sizeTier }
        : {}),
    ...(filter.stock === "in" ? { inStock: true } : {}),
    ...(filter.stock === "out" ? { inStock: false } : {}),
    ...(filter.media === "none" ? { images: { none: {} } } : {}),
    ...(filter.media === "placeholder"
      ? {
          images: {
            some: { url: { startsWith: PLACEHOLDER_ASSET_PREFIX } },
          },
        }
      : {}),
    ...(filter.demo === "1" ? { isDemo: true } : {}),
  };
}
