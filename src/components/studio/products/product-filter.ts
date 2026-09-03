import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";

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
  stock: z.enum(["in", "out"]).optional().catch(undefined),
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
  stock?: string;
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
    ...(filter.stock === "in" ? { inStock: true } : {}),
    ...(filter.stock === "out" ? { inStock: false } : {}),
    ...(filter.demo === "1" ? { isDemo: true } : {}),
  };
}
