"use server";

import { z } from "zod";

import {
  buildProductWhere,
  fetchProductsBySlugs,
  fetchProductsPage,
  SORTS,
  type ShopPage,
  type ShopProductItem,
} from "@/lib/shop";
import { defaultLocale } from "@/i18n/config";
import { demoWhere } from "@/lib/demo-content";

// Public (unauthenticated) read actions for the shop's infinite scroll and
// the localStorage wishlist panel. Read-only against the PUBLISHED/non-DEMO
// catalog, so no rate limit — but inputs are zod-validated and page sizes
// are capped server-side.

const loadMoreSchema = z.object({
  filters: z.object({
    q: z.string().trim().max(120).optional(),
    category: z.string().trim().max(120).optional(),
    occasion: z.string().trim().max(60).optional(),
    band: z.string().trim().max(30).optional(),
    type: z.string().trim().max(20).optional(),
    stock: z.string().trim().max(10).optional(),
  }),
  sort: z.enum(SORTS),
  cursor: z.string().min(1).max(64).optional(),
  locale: z.string().max(10).optional(),
});

export type LoadMoreProductsInput = z.input<typeof loadMoreSchema>;

/** Next page of shop results for {@link ShopExplorer}'s infinite scroll. */
export async function loadMoreProducts(
  input: LoadMoreProductsInput,
): Promise<ShopPage> {
  const empty: ShopPage = { items: [], nextCursor: null, total: 0 };
  try {
    const parsed = loadMoreSchema.safeParse(input);
    if (!parsed.success) return empty;

    const { filters, sort, cursor, locale } = parsed.data;
    return await fetchProductsPage({
      where: buildProductWhere(filters, await demoWhere()),
      sort,
      cursor,
      take: 24, // hard cap — clients cannot request bigger pages (matches the lib default)
      locale: locale ?? defaultLocale,
      // Cursor pages only feed the infinite scroll, which consumes items +
      // nextCursor and discards the total — skip the count(*) (a full
      // ILIKE scan when a text filter is set) on every batch (M-P2). The
      // ShopPage then carries `total: -1`.
      withTotal: !cursor,
    });
  } catch (error) {
    console.error("loadMoreProducts failed:", error);
    return empty;
  }
}

const wishlistItemsSchema = z.object({
  slugs: z.array(z.string().trim().min(1).max(160)).max(48),
  locale: z.string().max(10).optional(),
});

export type FetchWishlistItemsInput = z.input<typeof wishlistItemsSchema>;

/**
 * Card data for the wishlist panel's saved slugs (localStorage — the
 * client sends its slug list). PUBLISHED only, capped at 48; returned in
 * the given slug order so the panel mirrors the visitor's save order.
 */
export async function fetchWishlistItems(
  input: FetchWishlistItemsInput,
): Promise<ShopProductItem[]> {
  try {
    const parsed = wishlistItemsSchema.safeParse(input);
    if (!parsed.success) return [];
    const { slugs, locale } = parsed.data;
    return await fetchProductsBySlugs(
      slugs,
      locale ?? defaultLocale,
      await demoWhere(),
    );
  } catch (error) {
    console.error("fetchWishlistItems failed:", error);
    return [];
  }
}
